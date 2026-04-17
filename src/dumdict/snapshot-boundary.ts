import { dumling, type DumlingId, type SupportedLang } from "dumling";
import { err, ok } from "neverthrow";
import { makeDumdict } from "./impl/make-dumdict";
import {
	assertLemmaIdMatchesDictionaryLanguage,
	assertPendingIdMatchesDictionaryLanguage,
	assertSurfaceIdMatchesDictionaryLanguage,
	pendingRefMatchesLemma,
	pendingRefMatchesLemmaIdentityTuple,
	validateLemmaEntry,
	validateSurfaceEntry,
} from "./domain/validation";
import {
	getLemmaCanonicalLemma,
	getLemmaLanguage,
	getSurfaceLanguage,
	getSurfaceNormalizedFullSurface,
} from "./domain/runtime-accessors";
import {
	makeLookupKey,
	sortIds,
	sortStrings,
	toSortedRecord,
} from "./domain/collections";
import { derivePendingLemmaId, makePendingRelationKey } from "./domain/pending";
import { type DumdictResult, makeError } from "./errors";
import type {
	AuthoritativeWriteSnapshot,
	ChangePrecondition,
	Dumdict,
	LemmaEntryPatchOp,
	LookupResult,
	MutationIntentV1,
	PendingLemmaRef,
	PendingLemmaRelation,
	PlannedChangeOp,
	ReadableDictionarySnapshot,
	SurfaceEntryPatchOp,
} from "./public";
import { getInverseLexicalRelation } from "./relations/lexical";
import { lexicalRelationKeys } from "./relations/lexical";
import type { LexicalRelation } from "./relations/lexical";
import { getInverseMorphologicalRelation } from "./relations/morphological";
import { morphologicalRelationKeys } from "./relations/morphological";
import type { MorphologicalRelation } from "./relations/morphological";
import { sortPendingRelations } from "./state/pending-store";

type SnapshotValidationMode = "readable" | "authoritative-write";

function validateSnapshotShape<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
	mode: SnapshotValidationMode,
): DumdictResult<L> {
	if (snapshot.authority === "write" && snapshot.completeness !== "full") {
		return err(
			makeError(
				"InvariantViolation",
				"Write snapshots must declare completeness === \"full\".",
			),
		);
	}

	if (
		snapshot.authority === "read" &&
		snapshot.completeness !== "partial" &&
		snapshot.completeness !== "full"
	) {
		return err(
			makeError(
				"InvariantViolation",
				"Read snapshots must declare completeness as \"partial\" or \"full\".",
			),
		);
	}

	if (
		mode === "authoritative-write" &&
		(snapshot.authority !== "write" || snapshot.completeness !== "full")
	) {
		return err(
			makeError(
				"InvariantViolation",
				"Authoritative write validation requires a write/full snapshot.",
			),
		);
	}

	return ok(snapshot.language);
}

function validatePendingRef<L extends SupportedLang>(
	language: L,
	pendingRef: PendingLemmaRef<L>,
): DumdictResult<void> {
	if (pendingRef.language !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`Pending lemma ref ${pendingRef.pendingId} belongs to ${pendingRef.language}, not ${language}.`,
			),
		);
	}

	const pendingIdResult = assertPendingIdMatchesDictionaryLanguage(
		language,
		pendingRef.pendingId,
	);
	if (pendingIdResult.isErr()) {
		return pendingIdResult;
	}

	const derivedPendingId = derivePendingLemmaId(language, {
		canonicalLemma: pendingRef.canonicalLemma,
		lemmaKind: pendingRef.lemmaKind,
		lemmaSubKind: pendingRef.lemmaSubKind,
	});
	if (pendingRef.pendingId !== derivedPendingId) {
		return err(
			makeError(
				"InvariantViolation",
				`Pending lemma ref ${pendingRef.pendingId} does not match its identity tuple; expected ${derivedPendingId}.`,
			),
		);
	}

	return ok(undefined);
}

function validateSnapshotInternal<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
	mode: SnapshotValidationMode,
): DumdictResult<void> {
	const shapeResult = validateSnapshotShape(snapshot, mode);
	if (shapeResult.isErr()) {
		return err(shapeResult.error);
	}

	const language = shapeResult.value;
	const lemmaIds = new Set<DumlingId<"Lemma", L>>();
	const lemmasById = new Map<DumlingId<"Lemma", L>, typeof snapshot.lemmas[number]>();
	for (const lemmaEntry of snapshot.lemmas) {
		const lemmaResult = validateLemmaEntry(language as L, lemmaEntry);
		if (lemmaResult.isErr()) {
			return lemmaResult;
		}

		if (lemmaIds.has(lemmaEntry.id)) {
			return err(
				makeError(
					"InvariantViolation",
					`Snapshot contains duplicate lemma entry ${lemmaEntry.id}.`,
				),
			);
		}

		lemmaIds.add(lemmaEntry.id);
		lemmasById.set(lemmaEntry.id, lemmaEntry);
	}

	const surfaceIds = new Set<DumlingId<"Surface", L>>();
	for (const surfaceEntry of snapshot.surfaces) {
		const surfaceResult = validateSurfaceEntry(language as L, surfaceEntry);
		if (surfaceResult.isErr()) {
			return surfaceResult;
		}

		if (surfaceIds.has(surfaceEntry.id)) {
			return err(
				makeError(
					"InvariantViolation",
					`Snapshot contains duplicate surface entry ${surfaceEntry.id}.`,
				),
			);
		}

		if (
			(mode === "authoritative-write" || snapshot.completeness === "full") &&
			!lemmaIds.has(surfaceEntry.ownerLemmaId)
		) {
			return err(
				makeError(
					"OwnerLemmaNotFound",
					`Surface entry ${surfaceEntry.id} references missing owner lemma ${surfaceEntry.ownerLemmaId}.`,
				),
			);
		}

		surfaceIds.add(surfaceEntry.id);
	}

	const pendingIds = new Set<string>();
	const pendingRefsById = new Map<string, PendingLemmaRef<L>>();
	for (const pendingRef of snapshot.pendingRefs) {
		const pendingResult = validatePendingRef(language as L, pendingRef);
		if (pendingResult.isErr()) {
			return pendingResult;
		}

		if (pendingIds.has(pendingRef.pendingId)) {
			return err(
				makeError(
					"InvariantViolation",
					`Snapshot contains duplicate pending ref ${pendingRef.pendingId}.`,
				),
			);
		}

		pendingIds.add(pendingRef.pendingId);
		pendingRefsById.set(pendingRef.pendingId, pendingRef);
	}

	const seenPendingRelations = new Set<string>();
	const referencedPendingIds = new Set<string>();
	for (const pendingRelation of snapshot.pendingRelations) {
		const sourceResult = assertLemmaIdMatchesDictionaryLanguage(
			language as L,
			pendingRelation.sourceLemmaId,
		);
		if (sourceResult.isErr()) {
			return sourceResult;
		}

		const pendingIdResult = assertPendingIdMatchesDictionaryLanguage(
			language as L,
			pendingRelation.targetPendingId,
		);
		if (pendingIdResult.isErr()) {
			return pendingIdResult;
		}

		const relationKey = makePendingRelationKey(pendingRelation);
		if (seenPendingRelations.has(relationKey)) {
			return err(
				makeError(
					"InvariantViolation",
					`Snapshot contains duplicate pending relation ${relationKey}.`,
				),
			);
		}
		seenPendingRelations.add(relationKey);
		referencedPendingIds.add(pendingRelation.targetPendingId);

		const targetPendingRef = pendingRefsById.get(pendingRelation.targetPendingId);
		const requiresClosure =
			mode === "authoritative-write" || snapshot.completeness === "full";
		if (requiresClosure && !lemmaIds.has(pendingRelation.sourceLemmaId)) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Pending relation source lemma ${pendingRelation.sourceLemmaId} is missing from the snapshot.`,
				),
			);
		}

		if (requiresClosure && !targetPendingRef) {
			return err(
				makeError(
					"PendingRefNotFound",
					`Pending relation target ${pendingRelation.targetPendingId} is missing from the snapshot.`,
				),
			);
		}

		if (
			targetPendingRef &&
			lemmaIds.has(pendingRelation.sourceLemmaId) &&
			pendingRefMatchesLemmaIdentityTuple(
				targetPendingRef,
				snapshot.lemmas.find(
					(entry) => entry.id === pendingRelation.sourceLemmaId,
				)!.lemma,
			)
		) {
			return err(
				makeError(
					"SelfRelationForbidden",
					`Lemma ${pendingRelation.sourceLemmaId} cannot relate to its own pending identity tuple.`,
				),
			);
		}

		if (
			pendingRelation.relationFamily === "lexical" &&
			!lexicalRelationKeys.includes(pendingRelation.relation as LexicalRelation)
		) {
			return err(
				makeError(
					"InvariantViolation",
					`Pending lexical relation ${pendingRelation.relation} is invalid.`,
				),
			);
		}

		if (
			pendingRelation.relationFamily === "morphological" &&
			!morphologicalRelationKeys.includes(
				pendingRelation.relation as MorphologicalRelation,
			)
		) {
			return err(
				makeError(
					"InvariantViolation",
					`Pending morphological relation ${pendingRelation.relation} is invalid.`,
				),
			);
		}
	}

	if (mode === "authoritative-write" || snapshot.completeness === "full") {
		for (const pendingRef of snapshot.pendingRefs) {
			if (!referencedPendingIds.has(pendingRef.pendingId)) {
				return err(
					makeError(
						"InvariantViolation",
						`Pending lemma ref ${pendingRef.pendingId} is orphaned and must not appear without at least one pending relation.`,
					),
				);
			}
		}
	}

	if (mode === "authoritative-write" || snapshot.completeness === "full") {
		for (const lemmaEntry of snapshot.lemmas) {
			for (const relation of lexicalRelationKeys) {
				for (const targetLemmaId of lemmaEntry.lexicalRelations[relation] ?? []) {
					const targetResult = assertLemmaIdMatchesDictionaryLanguage(
						language as L,
						targetLemmaId,
					);
					if (targetResult.isErr()) {
						return targetResult;
					}

					if (!lemmaIds.has(targetLemmaId)) {
						return err(
							makeError(
								"RelationTargetNotFound",
								`Lexical relation target ${targetLemmaId} is missing from the snapshot.`,
							),
						);
					}

					const targetEntry = lemmasById.get(targetLemmaId);
					const inverseRelation = getInverseLexicalRelation(relation);
					if (
						!targetEntry?.lexicalRelations[inverseRelation]?.includes(lemmaEntry.id)
					) {
						return err(
							makeError(
								"InvariantViolation",
								`Lexical relation ${lemmaEntry.id} --${relation}-> ${targetLemmaId} is missing reciprocal ${targetLemmaId} --${inverseRelation}-> ${lemmaEntry.id}.`,
							),
						);
					}
				}
			}

			for (const relation of morphologicalRelationKeys) {
				for (const targetLemmaId of lemmaEntry.morphologicalRelations[
					relation
				] ?? []) {
					const targetResult = assertLemmaIdMatchesDictionaryLanguage(
						language as L,
						targetLemmaId,
					);
					if (targetResult.isErr()) {
						return targetResult;
					}

					if (!lemmaIds.has(targetLemmaId)) {
						return err(
							makeError(
								"RelationTargetNotFound",
								`Morphological relation target ${targetLemmaId} is missing from the snapshot.`,
							),
						);
					}

					const targetEntry = lemmasById.get(targetLemmaId);
					const inverseRelation = getInverseMorphologicalRelation(relation);
					if (
						!targetEntry?.morphologicalRelations[inverseRelation]?.includes(
							lemmaEntry.id,
						)
					) {
						return err(
							makeError(
								"InvariantViolation",
								`Morphological relation ${lemmaEntry.id} --${relation}-> ${targetLemmaId} is missing reciprocal ${targetLemmaId} --${inverseRelation}-> ${lemmaEntry.id}.`,
							),
						);
					}
				}
			}
		}
	}

	return ok(undefined);
}

export function validateReadableSnapshot<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
) {
	return validateSnapshotInternal(snapshot, "readable");
}

export function validateAuthoritativeWriteSnapshot<L extends SupportedLang>(
	snapshot: AuthoritativeWriteSnapshot<L>,
) {
	return validateSnapshotInternal(snapshot, "authoritative-write");
}

export function hydrateSnapshot<L extends SupportedLang>(
	snapshot: AuthoritativeWriteSnapshot<L>,
): DumdictResult<Dumdict<L>> {
	const validationResult = validateAuthoritativeWriteSnapshot(snapshot);
	if (validationResult.isErr()) {
		return err(validationResult.error);
	}

	const dict = makeDumdict(snapshot.language);
	for (const lemmaEntry of snapshot.lemmas.toSorted((left, right) =>
		left.id.localeCompare(right.id),
	)) {
		const result = dict.upsertLemmaEntry({
			...lemmaEntry,
			lexicalRelations: {},
			morphologicalRelations: {},
		});
		if (result.isErr()) {
			return err(result.error);
		}
	}

	for (const surfaceEntry of snapshot.surfaces.toSorted((left, right) =>
		left.id.localeCompare(right.id),
	)) {
		const result = dict.upsertSurfaceEntry(surfaceEntry);
		if (result.isErr()) {
			return err(result.error);
		}
	}

	for (const lemmaEntry of snapshot.lemmas.toSorted((left, right) =>
		left.id.localeCompare(right.id),
	)) {
		const ops: LemmaEntryPatchOp<L>[] = [];
		for (const relation of lexicalRelationKeys) {
			for (const targetLemmaId of sortIds(
				lemmaEntry.lexicalRelations[relation] ?? [],
			)) {
				ops.push({
					op: "addLexicalRelation",
					relation,
					target: { kind: "existing", lemmaId: targetLemmaId },
				});
			}
		}

		for (const relation of morphologicalRelationKeys) {
			for (const targetLemmaId of sortIds(
				lemmaEntry.morphologicalRelations[relation] ?? [],
			)) {
				ops.push({
					op: "addMorphologicalRelation",
					relation,
					target: { kind: "existing", lemmaId: targetLemmaId },
				});
			}
		}

		if (ops.length === 0) {
			continue;
		}

		const result = dict.patchLemmaEntry(lemmaEntry.id, ops);
		if (result.isErr()) {
			return err(result.error);
		}
	}

	const pendingRefsById = new Map(
		snapshot.pendingRefs.map((pendingRef) => [pendingRef.pendingId, pendingRef]),
	);

	for (const pendingRelation of sortPendingRelations(snapshot.pendingRelations)) {
		const pendingRef = pendingRefsById.get(pendingRelation.targetPendingId);
		if (!pendingRef) {
			return err(
				makeError(
					"PendingRefNotFound",
					`Pending relation target ${pendingRelation.targetPendingId} is missing from the snapshot.`,
				),
			);
		}

		const op: LemmaEntryPatchOp<L> =
			pendingRelation.relationFamily === "lexical"
				? {
						op: "addLexicalRelation",
						relation: pendingRelation.relation as LexicalRelation,
						target: {
							kind: "pending",
							ref: {
								canonicalLemma: pendingRef.canonicalLemma,
								lemmaKind: pendingRef.lemmaKind,
								lemmaSubKind: pendingRef.lemmaSubKind,
							},
						},
					}
				: {
						op: "addMorphologicalRelation",
						relation: pendingRelation.relation as MorphologicalRelation,
						target: {
							kind: "pending",
							ref: {
								canonicalLemma: pendingRef.canonicalLemma,
								lemmaKind: pendingRef.lemmaKind,
								lemmaSubKind: pendingRef.lemmaSubKind,
							},
						},
					};

		const result = dict.patchLemmaEntry(pendingRelation.sourceLemmaId, op);
		if (result.isErr()) {
			return err(result.error);
		}
	}

	return ok(dict);
}

export function exportSnapshot<L extends SupportedLang>(
	dict: Dumdict<L>,
	revision: string,
): DumdictResult<AuthoritativeWriteSnapshot<L>> {
	const snapshotResult = dict.exportAuthoritativeSnapshot(revision);
	if (snapshotResult.isErr()) {
		return err(snapshotResult.error);
	}

	const validationResult = validateAuthoritativeWriteSnapshot(snapshotResult.value);
	if (validationResult.isErr()) {
		return err(validationResult.error);
	}

	return ok(snapshotResult.value);
}

export function lookupBySurface<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
	surface: string,
): DumdictResult<LookupResult<L>> {
	const validationResult = validateReadableSnapshot(snapshot);
	if (validationResult.isErr()) {
		return err(validationResult.error);
	}

	const lookupKey = makeLookupKey(surface);
	const lemmaEntries = snapshot.lemmas
		.filter(
			(entry) => makeLookupKey(getLemmaCanonicalLemma(entry.lemma)) === lookupKey,
		)
		.map((entry) => [entry.id, structuredClone(entry)] as const);
	const surfaceEntries = snapshot.surfaces
		.filter(
			(entry) =>
				makeLookupKey(getSurfaceNormalizedFullSurface(entry.surface)) ===
				lookupKey,
		)
		.map((entry) => [entry.id, structuredClone(entry)] as const);

	return ok({
		lemmas: toSortedRecord(lemmaEntries),
		surfaces: toSortedRecord(surfaceEntries),
	});
}

export function lookupLemmasBySurface<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
	surface: string,
): DumdictResult<Record<DumlingId<"Lemma", L>, (typeof snapshot.lemmas)[number]>> {
	const lookupResult = lookupBySurface(snapshot, surface);
	if (lookupResult.isErr()) {
		return err(lookupResult.error);
	}

	const lemmaEntries = new Map(Object.entries(lookupResult.value.lemmas));
	const lemmasById = new Map(snapshot.lemmas.map((entry) => [entry.id, entry]));
	for (const surfaceEntry of Object.values(lookupResult.value.surfaces)) {
		const ownerLemma = lemmasById.get(surfaceEntry.ownerLemmaId);
		if (ownerLemma) {
			lemmaEntries.set(ownerLemma.id, structuredClone(ownerLemma));
		}
	}

	return ok(
		toSortedRecord(
			[...lemmaEntries.entries()].map(([lemmaId, entry]) => [
				lemmaId as DumlingId<"Lemma", L>,
				entry,
			]),
		),
	);
}

function checkPrecondition<L extends SupportedLang>(
	snapshot: AuthoritativeWriteSnapshot<L>,
	precondition: ChangePrecondition<L>,
	stagedPendingRefs?: ReadonlyMap<string, PendingLemmaRef<L>>,
): DumdictResult<void> {
	switch (precondition.kind) {
		case "snapshotRevisionMatches":
			if (snapshot.revision !== precondition.revision) {
				return err(
					makeError(
						"InvariantViolation",
						`Snapshot revision ${snapshot.revision} does not match required revision ${precondition.revision}.`,
					),
				);
			}
			return ok(undefined);
		case "lemmaExists":
			if (snapshot.lemmas.some((entry) => entry.id === precondition.lemmaId)) {
				return ok(undefined);
			}
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${precondition.lemmaId} was not found in the snapshot.`,
				),
			);
		case "lemmaMissing":
			if (snapshot.lemmas.every((entry) => entry.id !== precondition.lemmaId)) {
				return ok(undefined);
			}
			return err(
				makeError(
					"InvariantViolation",
					`Lemma entry ${precondition.lemmaId} already exists in the snapshot.`,
				),
			);
		case "surfaceExists":
			if (
				snapshot.surfaces.some((entry) => entry.id === precondition.surfaceId)
			) {
				return ok(undefined);
			}
			return err(
				makeError(
					"SurfaceEntryNotFound",
					`Surface entry ${precondition.surfaceId} was not found in the snapshot.`,
				),
			);
		case "surfaceMissing":
			if (
				snapshot.surfaces.every((entry) => entry.id !== precondition.surfaceId)
			) {
				return ok(undefined);
			}
			return err(
				makeError(
					"InvariantViolation",
					`Surface entry ${precondition.surfaceId} already exists in the snapshot.`,
				),
			);
		case "pendingRefExists":
			if (
				stagedPendingRefs?.has(precondition.pendingId) ||
				snapshot.pendingRefs.some(
					(ref) => ref.pendingId === precondition.pendingId,
				)
			) {
				return ok(undefined);
			}
			return err(
				makeError(
					"PendingRefNotFound",
					`Pending lemma ref ${precondition.pendingId} was not found in the snapshot.`,
				),
			);
		case "pendingRefMissing":
			if (
				!(stagedPendingRefs?.has(precondition.pendingId) ?? false) &&
				snapshot.pendingRefs.every(
					(ref) => ref.pendingId !== precondition.pendingId,
				)
			) {
				return ok(undefined);
			}
			return err(
				makeError(
					"InvariantViolation",
					`Pending lemma ref ${precondition.pendingId} already exists in the snapshot.`,
				),
			);
	}
}

function validateIntentAgainstSnapshot<L extends SupportedLang>(
	snapshot: AuthoritativeWriteSnapshot<L>,
	intent: MutationIntentV1<L>,
): DumdictResult<void> {
	if (intent.version !== "v1") {
		return ok(undefined);
	}

	if (intent.kind === "appendLemmaAttestation") {
		return assertLemmaIdMatchesDictionaryLanguage(
			snapshot.language,
			intent.lemmaId,
		);
	}

	if (intent.kind === "insertLemma") {
		const lemmaLanguage = getLemmaLanguage(intent.entry.lemma);
		const lemmaId = dumling.idCodec
			.forLanguage(lemmaLanguage)
			.makeDumlingIdFor(intent.entry.lemma) as DumlingId<"Lemma", L>;
		const lemmaEntryResult = validateLemmaEntry(snapshot.language, {
			id: lemmaId,
			lemma: intent.entry.lemma,
			lexicalRelations: {},
			morphologicalRelations: {},
			attestedTranslations: intent.entry.attestedTranslations,
			attestations: intent.entry.attestations,
			notes: intent.entry.notes,
		});
		if (lemmaEntryResult.isErr()) {
			return lemmaEntryResult;
		}

		for (const ownedSurface of intent.ownedSurfaces ?? []) {
			const surfaceLanguage = getSurfaceLanguage(ownedSurface.surface);
			const surfaceId = dumling.idCodec
				.forLanguage(surfaceLanguage)
				.makeDumlingIdFor(ownedSurface.surface) as DumlingId<"Surface", L>;
			const surfaceEntryResult = validateSurfaceEntry(snapshot.language, {
				id: surfaceId,
				surface: ownedSurface.surface,
				ownerLemmaId: ownedSurface.ownerLemmaId,
				attestedTranslations: ownedSurface.attestedTranslations,
				attestations: ownedSurface.attestations,
				notes: ownedSurface.notes,
			});
			if (surfaceEntryResult.isErr()) {
				return surfaceEntryResult;
			}
		}

		for (const relation of intent.initialRelations ?? []) {
			if (relation.target.kind !== "existing") {
				continue;
			}

			const targetResult = assertLemmaIdMatchesDictionaryLanguage(
				snapshot.language,
				relation.target.lemmaId,
			);
			if (targetResult.isErr()) {
				return targetResult;
			}
		}

		return ok(undefined);
	}

	if (intent.kind === "upsertOwnedSurface") {
		if (getSurfaceLanguage(intent.entry.surface) !== snapshot.language) {
			return err(
				makeError(
					"LanguageMismatch",
					`Surface entry payload language ${getSurfaceLanguage(intent.entry.surface)} does not match ${snapshot.language}.`,
				),
			);
		}

		const ownerIdResult = assertLemmaIdMatchesDictionaryLanguage(
			snapshot.language,
			intent.entry.ownerLemmaId,
		);
		if (ownerIdResult.isErr()) {
			return ownerIdResult;
		}

		if (
			snapshot.lemmas.every(
				(entry) => entry.id !== intent.entry.ownerLemmaId,
			)
		) {
			return err(
				makeError(
					"OwnerLemmaNotFound",
					`Owner lemma ${intent.entry.ownerLemmaId} was not found in the snapshot.`,
				),
			);
		}

		return ok(undefined);
	}

	if (intent.kind === "resolvePendingLemma") {
		const pendingIdResult = assertPendingIdMatchesDictionaryLanguage(
			snapshot.language,
			intent.pendingId,
		);
		if (pendingIdResult.isErr()) {
			return pendingIdResult;
		}

		return assertLemmaIdMatchesDictionaryLanguage(
			snapshot.language,
			intent.lemmaId,
		);
	}

	return ok(undefined);
}

export function applyPlannedChanges<L extends SupportedLang>(
	snapshot: AuthoritativeWriteSnapshot<L>,
	changes: PlannedChangeOp<L>[],
	options?: { nextRevision?: string },
): DumdictResult<AuthoritativeWriteSnapshot<L>> {
	const validationResult = validateAuthoritativeWriteSnapshot(snapshot);
	if (validationResult.isErr()) {
		return err(validationResult.error);
	}

	let currentSnapshot = snapshot;
	const stagedPendingRefs = new Map<string, PendingLemmaRef<L>>();

	const dictResult = hydrateSnapshot(snapshot);
	if (dictResult.isErr()) {
		return err(dictResult.error);
	}

	const dict = dictResult.value;
	for (const change of changes) {
		for (const precondition of change.preconditions ?? []) {
			const result = checkPrecondition(
				currentSnapshot,
				precondition,
				stagedPendingRefs,
			);
			if (result.isErr()) {
				return err(result.error);
			}
		}

		switch (change.type) {
			case "createLemma": {
				const result = dict.upsertLemmaEntry(change.entry);
				if (result.isErr()) {
					return err(result.error);
				}
				break;
			}
			case "patchLemma": {
				const result = dict.patchLemmaEntry(change.lemmaId, change.ops);
				if (result.isErr()) {
					return err(result.error);
				}
				break;
			}
			case "deleteLemma": {
				const result = dict.deleteLemmaEntry(change.id);
				if (result.isErr()) {
					return err(result.error);
				}
				break;
			}
			case "createSurface": {
				const result = dict.upsertSurfaceEntry(change.entry);
				if (result.isErr()) {
					return err(result.error);
				}
				break;
			}
			case "patchSurface": {
				const result = dict.patchSurfaceEntry(change.surfaceId, change.ops);
				if (result.isErr()) {
					return err(result.error);
				}
				break;
			}
			case "deleteSurface": {
				const result = dict.deleteSurfaceEntry(change.id);
				if (result.isErr()) {
					return err(result.error);
				}
				break;
			}
			case "createPendingRef":
				stagedPendingRefs.set(change.ref.pendingId, change.ref);
				break;
			case "deletePendingRef":
				return err(
					makeError(
						"InvariantViolation",
						"deletePendingRef is not a valid standalone v1 change; pending refs are removed automatically when their last pending relation is deleted.",
					),
				);
			case "createPendingRelation": {
				const pendingRef =
					stagedPendingRefs.get(change.relation.targetPendingId) ??
					currentSnapshot.pendingRefs.find(
						(ref) => ref.pendingId === change.relation.targetPendingId,
					);
				if (!pendingRef) {
					return err(
						makeError(
							"PendingRefNotFound",
							`Pending lemma ref ${change.relation.targetPendingId} was not found in the snapshot.`,
						),
					);
				}

				const op: LemmaEntryPatchOp<L> =
					change.relation.relationFamily === "lexical"
						? {
								op: "addLexicalRelation",
								relation: change.relation.relation as LexicalRelation,
								target: {
									kind: "pending",
									ref: {
										canonicalLemma: pendingRef.canonicalLemma,
										lemmaKind: pendingRef.lemmaKind,
										lemmaSubKind: pendingRef.lemmaSubKind,
									},
								},
							}
						: {
								op: "addMorphologicalRelation",
								relation:
									change.relation.relation as MorphologicalRelation,
								target: {
									kind: "pending",
									ref: {
										canonicalLemma: pendingRef.canonicalLemma,
										lemmaKind: pendingRef.lemmaKind,
										lemmaSubKind: pendingRef.lemmaSubKind,
									},
								},
							};

				const result = dict.patchLemmaEntry(change.relation.sourceLemmaId, op);
				if (result.isErr()) {
					return err(result.error);
				}
				stagedPendingRefs.delete(change.relation.targetPendingId);
				break;
			}
			case "deletePendingRelation": {
				const result = dict.removePendingRelation(change.relation);
				if (result.isErr()) {
					return err(result.error);
				}
				break;
			}
		}

		if (change.type === "createPendingRef") {
			continue;
		}

		const currentSnapshotResult = exportSnapshot(dict, snapshot.revision);
		if (currentSnapshotResult.isErr()) {
			return err(currentSnapshotResult.error);
		}
		currentSnapshot = currentSnapshotResult.value;
		for (const pendingRef of currentSnapshot.pendingRefs) {
			stagedPendingRefs.delete(pendingRef.pendingId);
		}
	}

	const exportResult = exportSnapshot(
		dict,
		options?.nextRevision ?? snapshot.revision,
	);
	if (exportResult.isErr()) {
		return err(exportResult.error);
	}

	const nextSnapshot = exportResult.value;
	for (const pendingId of stagedPendingRefs.keys()) {
		if (!nextSnapshot.pendingRefs.some((ref) => ref.pendingId === pendingId)) {
			return err(
				makeError(
					"InvariantViolation",
					`Pending lemma ref ${pendingId} was created without any pending relation in the same batch; standalone pending refs are not valid in v1.`,
				),
			);
		}
	}

	return ok(nextSnapshot);
}

export function plan<L extends SupportedLang>(
	snapshot: AuthoritativeWriteSnapshot<L>,
	intent: MutationIntentV1<L>,
): DumdictResult<PlannedChangeOp<L>[]> {
	const validationResult = validateAuthoritativeWriteSnapshot(snapshot);
	if (validationResult.isErr()) {
		return err(validationResult.error);
	}

	const intentValidationResult = validateIntentAgainstSnapshot(snapshot, intent);
	if (intentValidationResult.isErr()) {
		return err(intentValidationResult.error);
	}

	if (intent.version === "v1" && intent.kind === "appendLemmaAttestation") {
		return ok([
			{
				type: "patchLemma",
				lemmaId: intent.lemmaId,
				ops: [{ op: "addAttestation", value: intent.attestation }],
				preconditions: [
					{
						kind: "snapshotRevisionMatches",
						revision: snapshot.revision,
					},
					{
						kind: "lemmaExists",
						lemmaId: intent.lemmaId,
					},
				],
			},
		]);
	}

	if (intent.version === "v1" && intent.kind === "insertLemma") {
		const language = getLemmaLanguage(intent.entry.lemma);
		const lemmaId = dumling.idCodec.forLanguage(language).makeDumlingIdFor(
			intent.entry.lemma,
		) as DumlingId<"Lemma", L>;
		const changes: PlannedChangeOp<L>[] = [
			{
				type: "createLemma",
				entry: {
					id: lemmaId,
					lemma: intent.entry.lemma,
					lexicalRelations: {},
					morphologicalRelations: {},
					attestedTranslations: intent.entry.attestedTranslations,
					attestations: intent.entry.attestations,
					notes: intent.entry.notes,
				},
				preconditions: [
					{
						kind: "snapshotRevisionMatches",
						revision: snapshot.revision,
					},
					{
						kind: "lemmaMissing",
						lemmaId,
					},
				],
			},
		];

		for (const ownedSurface of intent.ownedSurfaces ?? []) {
			if (ownedSurface.ownerLemmaId !== lemmaId) {
				return err(
					makeError(
						"InvariantViolation",
						`insertLemma owned surface ${getSurfaceNormalizedFullSurface(ownedSurface.surface)} must belong to the inserted lemma ${lemmaId}, not ${ownedSurface.ownerLemmaId}.`,
					),
				);
			}

			const surfaceId = dumling.idCodec
				.forLanguage(language)
				.makeDumlingIdFor(ownedSurface.surface) as DumlingId<
				"Surface",
				L
			>;

			changes.push({
				type: "createSurface",
				entry: {
					id: surfaceId,
					surface: ownedSurface.surface,
					ownerLemmaId: lemmaId,
					attestedTranslations: ownedSurface.attestedTranslations,
					attestations: ownedSurface.attestations,
					notes: ownedSurface.notes,
				},
				preconditions: [
					{
						kind: "snapshotRevisionMatches",
						revision: snapshot.revision,
					},
					{
						kind: "surfaceMissing",
						surfaceId,
					},
				],
			});
		}

		const relationOps: LemmaEntryPatchOp<L>[] = [];
		const relationPreconditions: ChangePrecondition<L>[] = [
			{
				kind: "snapshotRevisionMatches",
				revision: snapshot.revision,
			},
		];
		const reciprocalChanges: PlannedChangeOp<L>[] = [];

		for (const relation of intent.initialRelations ?? []) {
			if (relation.relationFamily === "lexical") {
				relationOps.push({
					op: "addLexicalRelation",
					relation: relation.relation,
					target: relation.target,
				});
			} else {
				relationOps.push({
					op: "addMorphologicalRelation",
					relation: relation.relation,
					target: relation.target,
				});
			}

			if (relation.target.kind === "existing") {
				relationPreconditions.push({
					kind: "lemmaExists",
					lemmaId: relation.target.lemmaId,
				});

				reciprocalChanges.push({
					type: "patchLemma",
					lemmaId: relation.target.lemmaId,
					ops: [
						relation.relationFamily === "lexical"
							? {
									op: "addLexicalRelation",
									relation: getInverseLexicalRelation(relation.relation),
									target: { kind: "existing", lemmaId },
								}
							: {
									op: "addMorphologicalRelation",
									relation: getInverseMorphologicalRelation(relation.relation),
									target: { kind: "existing", lemmaId },
								},
					],
					preconditions: [
						{
							kind: "snapshotRevisionMatches",
							revision: snapshot.revision,
						},
						{
							kind: "lemmaExists",
							lemmaId: relation.target.lemmaId,
						},
					],
				});
			}
		}

		if (relationOps.length > 0) {
			changes.push({
				type: "patchLemma",
				lemmaId,
				ops: relationOps,
				preconditions: relationPreconditions,
			});
		}
		changes.push(...reciprocalChanges);

		return ok(changes);
	}

	if (intent.version === "v1" && intent.kind === "upsertOwnedSurface") {
		const language = getSurfaceLanguage(intent.entry.surface);
		const surfaceId = dumling.idCodec
			.forLanguage(language)
			.makeDumlingIdFor(intent.entry.surface) as DumlingId<
			"Surface",
			L
		>;
		const existingSurface = snapshot.surfaces.find(
			(entry) => entry.id === surfaceId,
		);

		if (!existingSurface) {
			return ok([
				{
					type: "createSurface",
					entry: {
						id: surfaceId,
						surface: intent.entry.surface,
						ownerLemmaId: intent.entry.ownerLemmaId,
						attestedTranslations: intent.entry.attestedTranslations,
						attestations: intent.entry.attestations,
						notes: intent.entry.notes,
					},
					preconditions: [
						{
							kind: "snapshotRevisionMatches",
							revision: snapshot.revision,
						},
						{
							kind: "surfaceMissing",
							surfaceId,
						},
					],
				},
			]);
		}

		if (existingSurface.ownerLemmaId !== intent.entry.ownerLemmaId) {
			return err(
				makeError(
					"InvariantViolation",
					`Surface ${surfaceId} is owned by ${existingSurface.ownerLemmaId}, not ${intent.entry.ownerLemmaId}.`,
				),
			);
		}

		const ops: SurfaceEntryPatchOp<L>[] = [];
		for (const value of sortStrings(intent.entry.attestedTranslations)) {
			if (!existingSurface.attestedTranslations.includes(value)) {
				ops.push({ op: "addTranslation", value });
			}
		}
		for (const value of sortStrings(existingSurface.attestedTranslations)) {
			if (!intent.entry.attestedTranslations.includes(value)) {
				ops.push({ op: "removeTranslation", value });
			}
		}
		for (const value of sortStrings(intent.entry.attestations)) {
			if (!existingSurface.attestations.includes(value)) {
				ops.push({ op: "addAttestation", value });
			}
		}
		for (const value of sortStrings(existingSurface.attestations)) {
			if (!intent.entry.attestations.includes(value)) {
				ops.push({ op: "removeAttestation", value });
			}
		}
		if (existingSurface.notes !== intent.entry.notes) {
			ops.push({ op: "setNotes", value: intent.entry.notes });
		}

		return ok(
			ops.length === 0
				? []
				: [
						{
							type: "patchSurface",
							surfaceId,
							ops,
							preconditions: [
								{
									kind: "snapshotRevisionMatches",
									revision: snapshot.revision,
								},
								{
									kind: "surfaceExists",
									surfaceId,
								},
							],
						},
				  ],
		);
	}

	if (intent.version === "v1" && intent.kind === "resolvePendingLemma") {
		const pendingRef = snapshot.pendingRefs.find(
			(ref) => ref.pendingId === intent.pendingId,
		);
		if (!pendingRef) {
			return err(
				makeError(
					"PendingRefNotFound",
					`Pending lemma ref ${intent.pendingId} was not found in the snapshot.`,
				),
			);
		}

		const lemmaEntry = snapshot.lemmas.find((entry) => entry.id === intent.lemmaId);
		if (!lemmaEntry) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${intent.lemmaId} was not found in the snapshot.`,
				),
			);
		}

		if (!pendingRefMatchesLemma(pendingRef, lemmaEntry.lemma)) {
			return err(
				makeError(
					"PendingResolutionMismatch",
					`Pending lemma ref ${intent.pendingId} does not match lemma entry ${intent.lemmaId}.`,
				),
			);
		}

		const pendingRelations = sortPendingRelations(
			snapshot.pendingRelations.filter(
				(relation) => relation.targetPendingId === intent.pendingId,
			),
		);
		for (const pendingRelation of pendingRelations) {
			if (pendingRelation.sourceLemmaId === intent.lemmaId) {
				return err(
					makeError(
						"SelfRelationForbidden",
						`Resolving pending lemma ref ${intent.pendingId} onto ${intent.lemmaId} would create a self relation.`,
					),
				);
			}
		}

		const changes: PlannedChangeOp<L>[] = [];
		const resolvedTargetOps: LemmaEntryPatchOp<L>[] = [];
		const resolvedTargetPreconditions: ChangePrecondition<L>[] = [
			{
				kind: "snapshotRevisionMatches",
				revision: snapshot.revision,
			},
			{
				kind: "pendingRefExists",
				pendingId: intent.pendingId,
			},
			{
				kind: "lemmaExists",
				lemmaId: intent.lemmaId,
			},
		];
		const seenResolvedSourceLemmaIds = new Set<DumlingId<"Lemma", L>>();
		const deletions: PlannedChangeOp<L>[] = [];
		for (const pendingRelation of pendingRelations) {
			const patchOp: LemmaEntryPatchOp<L> =
				pendingRelation.relationFamily === "lexical"
					? {
							op: "addLexicalRelation",
							relation: pendingRelation.relation as LexicalRelation,
							target: { kind: "existing", lemmaId: intent.lemmaId },
						}
					: {
							op: "addMorphologicalRelation",
							relation: pendingRelation.relation as MorphologicalRelation,
							target: { kind: "existing", lemmaId: intent.lemmaId },
						};

			changes.push({
				type: "patchLemma",
				lemmaId: pendingRelation.sourceLemmaId,
				ops: [patchOp],
				preconditions: [
					{
						kind: "snapshotRevisionMatches",
						revision: snapshot.revision,
					},
					{
						kind: "pendingRefExists",
						pendingId: intent.pendingId,
					},
					{
						kind: "lemmaExists",
						lemmaId: pendingRelation.sourceLemmaId,
					},
					{
						kind: "lemmaExists",
						lemmaId: intent.lemmaId,
					},
				],
			});
			if (!seenResolvedSourceLemmaIds.has(pendingRelation.sourceLemmaId)) {
				resolvedTargetPreconditions.push({
					kind: "lemmaExists",
					lemmaId: pendingRelation.sourceLemmaId,
				});
				seenResolvedSourceLemmaIds.add(pendingRelation.sourceLemmaId);
			}

			resolvedTargetOps.push(
				pendingRelation.relationFamily === "lexical"
					? {
							op: "addLexicalRelation",
							relation: getInverseLexicalRelation(
								pendingRelation.relation as LexicalRelation,
							),
							target: {
								kind: "existing",
								lemmaId: pendingRelation.sourceLemmaId,
							},
						}
					: {
							op: "addMorphologicalRelation",
							relation: getInverseMorphologicalRelation(
								pendingRelation.relation as MorphologicalRelation,
							),
							target: {
								kind: "existing",
								lemmaId: pendingRelation.sourceLemmaId,
							},
						},
			);

			deletions.push({
				type: "deletePendingRelation",
				relation: pendingRelation,
				preconditions: [
					{
						kind: "snapshotRevisionMatches",
						revision: snapshot.revision,
					},
					{
						kind: "pendingRefExists",
						pendingId: intent.pendingId,
					},
				],
			});
		}

		if (resolvedTargetOps.length > 0) {
			changes.push({
				type: "patchLemma",
				lemmaId: intent.lemmaId,
				ops: resolvedTargetOps,
				preconditions: resolvedTargetPreconditions,
			});
		}

		changes.push(...deletions);

		return ok(changes);
	}

	return err(
		makeError(
			"InvariantViolation",
			`Mutation intent ${intent.kind} is not implemented yet in plan(...).`,
		),
	);
}
