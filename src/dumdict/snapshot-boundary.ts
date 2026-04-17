import type { DumlingId, SupportedLang } from "dumling";
import { err, ok } from "neverthrow";
import { makeDumdict } from "./impl/make-dumdict";
import { InMemoryDumdict } from "./impl/in-memory-dumdict";
import {
	assertLemmaIdMatchesDictionaryLanguage,
	assertPendingIdMatchesDictionaryLanguage,
	assertSurfaceIdMatchesDictionaryLanguage,
	pendingRefMatchesLemmaIdentityTuple,
	validateLemmaEntry,
	validateSurfaceEntry,
} from "./domain/validation";
import { getLemmaLanguage, getSurfaceLanguage } from "./domain/runtime-accessors";
import { sortIds } from "./domain/collections";
import { makePendingRelationKey } from "./domain/pending";
import { type DumdictResult, makeError } from "./errors";
import type {
	AuthoritativeWriteSnapshot,
	Dumdict,
	LemmaEntryPatchOp,
	PendingLemmaRef,
	PendingLemmaRelation,
	ReadableDictionarySnapshot,
} from "./public";
import { lexicalRelationKeys } from "./relations/lexical";
import type { LexicalRelation } from "./relations/lexical";
import { morphologicalRelationKeys } from "./relations/morphological";
import type { MorphologicalRelation } from "./relations/morphological";
import { sortPendingRelations } from "./state/pending-store";

type SnapshotValidationMode = "readable" | "authoritative-write";

function isEmptySnapshot<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
) {
	return (
		snapshot.lemmas.length === 0 &&
		snapshot.surfaces.length === 0 &&
		snapshot.pendingRefs.length === 0 &&
		snapshot.pendingRelations.length === 0
	);
}

function inferSnapshotLanguage<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
): SupportedLang | undefined {
	const firstLemma = snapshot.lemmas[0];
	if (firstLemma) {
		return getLemmaLanguage(firstLemma.lemma);
	}

	const firstSurface = snapshot.surfaces[0];
	if (firstSurface) {
		return getSurfaceLanguage(firstSurface.surface);
	}

	const firstPendingRef = snapshot.pendingRefs[0];
	if (firstPendingRef) {
		return firstPendingRef.language;
	}

	const firstPendingRelation = snapshot.pendingRelations[0];
	if (firstPendingRelation) {
		const segments = firstPendingRelation.targetPendingId.split(":");
		const encodedLanguage = segments[2];
		if (!encodedLanguage) {
			return undefined;
		}

		try {
			const language = decodeURIComponent(encodedLanguage);
			if (
				language === "English" ||
				language === "German" ||
				language === "Hebrew"
			) {
				return language;
			}
		} catch {
			return undefined;
		}
	}

	return undefined;
}

function validateSnapshotShape<L extends SupportedLang>(
	snapshot: ReadableDictionarySnapshot<L>,
	mode: SnapshotValidationMode,
): DumdictResult<SupportedLang | undefined> {
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

	const inferredLanguage = inferSnapshotLanguage(snapshot);
	if (!inferredLanguage && isEmptySnapshot(snapshot)) {
		return ok(undefined);
	}

	if (!inferredLanguage) {
		return err(
			makeError(
				"InvariantViolation",
				"Could not infer snapshot language from non-empty snapshot contents.",
			),
		);
	}

	return ok(inferredLanguage);
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

	return assertPendingIdMatchesDictionaryLanguage(language, pendingRef.pendingId);
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
	if (!language) {
		return ok(undefined);
	}

	const lemmaIds = new Set<DumlingId<"Lemma", L>>();
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
	}

	const surfaceIds = new Set<DumlingId<"ResolvedSurface", L>>();
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

	const language = inferSnapshotLanguage(snapshot) as L | undefined;
	if (!language) {
		return err(
			makeError(
				"InvariantViolation",
				"Cannot hydrate an empty authoritative snapshot without an inferable language.",
			),
		);
	}

	const dict = makeDumdict(language);
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
	if (!(dict instanceof InMemoryDumdict)) {
		return err(
			makeError(
				"InvariantViolation",
				"Snapshot export is currently supported only for the bundled in-memory dumdict implementation.",
			),
		);
	}

	const snapshot = dict.exportAuthoritativeSnapshot(revision);
	const validationResult = validateAuthoritativeWriteSnapshot(snapshot);
	if (validationResult.isErr()) {
		return err(validationResult.error);
	}

	return ok(snapshot);
}
