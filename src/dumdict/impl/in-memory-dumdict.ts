import { type DumlingId, dumling, type SupportedLang } from "dumling";
import { err, ok } from "neverthrow";
import { sortIds, sortStrings, toSortedRecord } from "../domain/collections";
import { makePendingLemmaRef, makePendingRelationKey } from "../domain/pending";
import {
	assertLemmaIdMatchesDictionaryLanguage,
	assertPendingIdMatchesDictionaryLanguage,
	assertSurfaceIdMatchesDictionaryLanguage,
	pendingRefMatchesLemma,
	pendingRefMatchesLemmaIdentityTuple,
	validateExistingRelationTarget,
	validateLemmaEntry,
	validateResolvedRelationTargets,
	validateSurfaceEntry,
} from "../domain/validation";
import { type DumdictResult, makeError } from "../errors";
import type {
	AuthoritativeWriteSnapshot,
	Dumdict,
	LemmaEntry,
	LemmaEntryPatchOp,
	LemmaRelationTarget,
	PendingLemmaId,
	PendingLemmaRef,
	PendingLemmaRelation,
	SurfaceEntry,
	SurfaceEntryPatchOp,
} from "../public";
import type { LexicalRelation } from "../relations/lexical";
import type { MorphologicalRelation } from "../relations/morphological";
import {
	cloneLemmaEntry,
	clonePendingLemmaRef,
	cloneState,
	cloneSurfaceEntry,
} from "../state/clone";
import {
	deleteLemmaEntryDirect,
	replaceLemmaEntryDirect,
} from "../state/lemma-store";
import {
	addPendingRelationEdge,
	removePendingRelationEdge,
	sortPendingRelations,
} from "../state/pending-store";
import { collectLemmaRecord, collectSurfaceRecord } from "../state/reads";
import {
	addResolvedLexicalRelationEdge,
	addResolvedMorphologicalRelationEdge,
	removeAllResolvedRelationsForLemma,
	removeResolvedLexicalRelationEdge,
	removeResolvedMorphologicalRelationEdge,
} from "../state/relation-store";
import { type InternalState, makeEmptyState } from "../state/state";
import {
	deleteSurfaceEntryDirect,
	replaceSurfaceEntryDirect,
} from "../state/surface-store";

export class InMemoryDumdict<L extends SupportedLang> implements Dumdict<L> {
	readonly language: L;

	#state: InternalState<L>;

	constructor(language: L) {
		this.language = language;
		this.#state = makeEmptyState();
	}

	exportAuthoritativeSnapshot(
		revision: string,
	): AuthoritativeWriteSnapshot<L> {
		const state = cloneState(this.#state);
		const lemmas = collectLemmaRecord(state, state.lemmasById.keys());
		const surfaces = collectSurfaceRecord(state, state.surfacesById.keys());
		const pendingRefs = toSortedRecord(
			sortIds([...state.pendingLemmaRefsById.keys()]).map((pendingId) => {
				const ref = state.pendingLemmaRefsById.get(pendingId);
				if (!ref) {
					throw new Error(`Missing pending ref ${pendingId} during export.`);
				}

				return [pendingId, clonePendingLemmaRef(ref)] as const;
			}),
		);
		const pendingRelations = sortPendingRelations(
			[...state.pendingRelationsBySourceLemmaId.values()].flatMap((bySource) =>
				[...bySource.values()].map((relation) => ({ ...relation })),
			),
		);

		return {
			authority: "write",
			completeness: "full",
			revision,
			lemmas: Object.values(lemmas),
			surfaces: Object.values(surfaces),
			pendingRefs: Object.values(pendingRefs),
			pendingRelations,
		};
	}

	lookupBySurface(surface: string) {
		const lookupKey = surface.normalize("NFC").toLowerCase();
		const lemmaIds = this.#state.lemmaLookupIndex.get(lookupKey) ?? new Set();
		const surfaceIds =
			this.#state.surfaceLookupIndex.get(lookupKey) ?? new Set();

		return ok({
			lemmas: collectLemmaRecord(this.#state, lemmaIds),
			surfaces: collectSurfaceRecord(this.#state, surfaceIds),
		});
	}

	lookupLemmasBySurface(surface: string) {
		const lookupKey = surface.normalize("NFC").toLowerCase();
		const lemmaIds = new Set(this.#state.lemmaLookupIndex.get(lookupKey) ?? []);
		const surfaceIds =
			this.#state.surfaceLookupIndex.get(lookupKey) ?? new Set();

		for (const surfaceId of surfaceIds) {
			const surfaceEntry = this.#state.surfacesById.get(surfaceId);
			if (surfaceEntry) {
				lemmaIds.add(surfaceEntry.ownerLemmaId);
			}
		}

		return ok(collectLemmaRecord(this.#state, lemmaIds));
	}

	getLemmaEntry(id: DumlingId<"Lemma", L>): DumdictResult<LemmaEntry<L>> {
		const idResult = assertLemmaIdMatchesDictionaryLanguage(this.language, id);
		if (idResult.isErr()) {
			return err(idResult.error);
		}

		const entry = this.#state.lemmasById.get(id);
		if (!entry) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${id} was not found in ${this.language} dumdict.`,
				),
			);
		}

		return ok(cloneLemmaEntry(entry));
	}

	getSurfaceEntry(
		id: DumlingId<"ResolvedSurface", L>,
	): DumdictResult<SurfaceEntry<L>> {
		const idResult = assertSurfaceIdMatchesDictionaryLanguage(
			this.language,
			id,
		);
		if (idResult.isErr()) {
			return err(idResult.error);
		}

		const entry = this.#state.surfacesById.get(id);
		if (!entry) {
			return err(
				makeError(
					"SurfaceEntryNotFound",
					`Surface entry ${id} was not found in ${this.language} dumdict.`,
				),
			);
		}

		return ok(cloneSurfaceEntry(entry));
	}

	getOwnedSurfaceEntries(
		lemmaId: DumlingId<"Lemma", L>,
	): DumdictResult<Record<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>> {
		const lemmaIdResult = assertLemmaIdMatchesDictionaryLanguage(
			this.language,
			lemmaId,
		);
		if (lemmaIdResult.isErr()) {
			return err(lemmaIdResult.error);
		}

		if (!this.#state.lemmasById.has(lemmaId)) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${lemmaId} was not found in ${this.language} dumdict.`,
				),
			);
		}

		const surfaceIds =
			this.#state.surfaceIdsByOwnerLemmaId.get(lemmaId) ?? new Set();
		return ok(collectSurfaceRecord(this.#state, surfaceIds));
	}

	getPendingLemmaRef(
		pendingId: PendingLemmaId<L>,
	): DumdictResult<PendingLemmaRef<L>> {
		const pendingIdResult = assertPendingIdMatchesDictionaryLanguage(
			this.language,
			pendingId,
		);
		if (pendingIdResult.isErr()) {
			return err(pendingIdResult.error);
		}

		const ref = this.#state.pendingLemmaRefsById.get(pendingId);
		if (!ref) {
			return err(
				makeError(
					"PendingRefNotFound",
					`Pending lemma ref ${pendingId} was not found in ${this.language} dumdict.`,
				),
			);
		}

		return ok(clonePendingLemmaRef(ref));
	}

	listPendingLemmaRefs(): DumdictResult<
		Record<PendingLemmaId<L>, PendingLemmaRef<L>>
	> {
		const entries: [PendingLemmaId<L>, PendingLemmaRef<L>][] = [];
		for (const pendingId of sortIds([
			...this.#state.pendingLemmaRefsById.keys(),
		])) {
			const ref = this.#state.pendingLemmaRefsById.get(pendingId);
			if (ref) {
				entries.push([pendingId, clonePendingLemmaRef(ref)]);
			}
		}

		return ok(toSortedRecord(entries));
	}

	listPendingRelationsForLemma(
		lemmaId: DumlingId<"Lemma", L>,
	): DumdictResult<PendingLemmaRelation<L>[]> {
		const lemmaIdResult = assertLemmaIdMatchesDictionaryLanguage(
			this.language,
			lemmaId,
		);
		if (lemmaIdResult.isErr()) {
			return err(lemmaIdResult.error);
		}

		if (!this.#state.lemmasById.has(lemmaId)) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${lemmaId} was not found in ${this.language} dumdict.`,
				),
			);
		}

		const edges = this.#state.pendingRelationsBySourceLemmaId.get(lemmaId);
		return ok(sortPendingRelations(edges?.values() ?? []));
	}

	upsertLemmaEntry(entry: LemmaEntry<L>): DumdictResult<LemmaEntry<L>> {
		const entryResult = validateLemmaEntry(this.language, entry);
		if (entryResult.isErr()) {
			return err(entryResult.error);
		}

		const draft = cloneState(this.#state);
		const existing = draft.lemmasById.get(entry.id);
		const relationValidation = validateResolvedRelationTargets(
			this.language,
			entry.id,
			entry.lexicalRelations,
			entry.morphologicalRelations,
			draft,
		);
		if (relationValidation.isErr()) {
			return err(relationValidation.error);
		}

		if (existing) {
			removeAllResolvedRelationsForLemma(draft, existing);
		}

		replaceLemmaEntryDirect(draft, {
			...entry,
			lexicalRelations: {},
			morphologicalRelations: {},
		});

		for (const [relation, targetIds] of Object.entries(
			entry.lexicalRelations,
		) as [LexicalRelation, DumlingId<"Lemma", L>[]][]) {
			for (const targetLemmaId of sortIds(targetIds ?? [])) {
				addResolvedLexicalRelationEdge(
					draft,
					entry.id,
					relation,
					targetLemmaId,
				);
			}
		}

		for (const [relation, targetIds] of Object.entries(
			entry.morphologicalRelations,
		) as [MorphologicalRelation, DumlingId<"Lemma", L>[]][]) {
			for (const targetLemmaId of sortIds(targetIds ?? [])) {
				addResolvedMorphologicalRelationEdge(
					draft,
					entry.id,
					relation,
					targetLemmaId,
				);
			}
		}

		this.#state = draft;
		const storedEntry = draft.lemmasById.get(entry.id);
		if (!storedEntry) {
			return err(
				makeError(
					"InvariantViolation",
					`Lemma entry ${entry.id} disappeared after upsert.`,
				),
			);
		}

		return ok(cloneLemmaEntry(storedEntry));
	}

	upsertSurfaceEntry(entry: SurfaceEntry<L>): DumdictResult<SurfaceEntry<L>> {
		const entryResult = validateSurfaceEntry(this.language, entry);
		if (entryResult.isErr()) {
			return err(entryResult.error);
		}

		const draft = cloneState(this.#state);
		const existing = draft.surfacesById.get(entry.id);
		if (existing) {
			const sameSurface =
				dumling.idCodec
					.forLanguage(this.language)
					.makeDumlingIdFor(existing.surface) ===
				dumling.idCodec
					.forLanguage(this.language)
					.makeDumlingIdFor(entry.surface);
			if (!sameSurface || existing.ownerLemmaId !== entry.ownerLemmaId) {
				return err(
					makeError(
						"InvariantViolation",
						`Surface entry ${entry.id} cannot mutate immutable identity-bearing fields.`,
					),
				);
			}
		}

		if (!draft.lemmasById.has(entry.ownerLemmaId)) {
			return err(
				makeError(
					"OwnerLemmaNotFound",
					`Owner lemma ${entry.ownerLemmaId} does not exist in ${this.language} dumdict.`,
				),
			);
		}

		replaceSurfaceEntryDirect(draft, entry);
		this.#state = draft;
		const storedEntry = draft.surfacesById.get(entry.id);
		if (!storedEntry) {
			return err(
				makeError(
					"InvariantViolation",
					`Surface entry ${entry.id} disappeared after upsert.`,
				),
			);
		}

		return ok(cloneSurfaceEntry(storedEntry));
	}

	patchLemmaEntry(
		id: DumlingId<"Lemma", L>,
		ops: LemmaEntryPatchOp<L> | LemmaEntryPatchOp<L>[],
	): DumdictResult<LemmaEntry<L>> {
		const lemmaIdResult = assertLemmaIdMatchesDictionaryLanguage(
			this.language,
			id,
		);
		if (lemmaIdResult.isErr()) {
			return err(lemmaIdResult.error);
		}

		const draft = cloneState(this.#state);
		const entry = draft.lemmasById.get(id);
		if (!entry) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${id} was not found in ${this.language} dumdict.`,
				),
			);
		}

		const opList = Array.isArray(ops) ? ops : [ops];
		for (const op of opList) {
			const opResult = this.#applyLemmaPatchOp(draft, entry, op);
			if (opResult.isErr()) {
				return err(opResult.error);
			}
		}

		replaceLemmaEntryDirect(draft, entry);
		this.#state = draft;
		const storedEntry = draft.lemmasById.get(id);
		if (!storedEntry) {
			return err(
				makeError(
					"InvariantViolation",
					`Lemma entry ${id} disappeared after patch.`,
				),
			);
		}

		return ok(cloneLemmaEntry(storedEntry));
	}

	patchSurfaceEntry(
		id: DumlingId<"ResolvedSurface", L>,
		ops: SurfaceEntryPatchOp<L> | SurfaceEntryPatchOp<L>[],
	): DumdictResult<SurfaceEntry<L>> {
		const surfaceIdResult = assertSurfaceIdMatchesDictionaryLanguage(
			this.language,
			id,
		);
		if (surfaceIdResult.isErr()) {
			return err(surfaceIdResult.error);
		}

		const draft = cloneState(this.#state);
		const entry = draft.surfacesById.get(id);
		if (!entry) {
			return err(
				makeError(
					"SurfaceEntryNotFound",
					`Surface entry ${id} was not found in ${this.language} dumdict.`,
				),
			);
		}

		const opList = Array.isArray(ops) ? ops : [ops];
		for (const op of opList) {
			switch (op.op) {
				case "addTranslation":
					entry.attestedTranslations = sortStrings([
						...entry.attestedTranslations,
						op.value,
					]);
					break;
				case "removeTranslation":
					entry.attestedTranslations = entry.attestedTranslations.filter(
						(value) => value !== op.value,
					);
					break;
				case "addAttestation":
					entry.attestations = sortStrings([...entry.attestations, op.value]);
					break;
				case "removeAttestation":
					entry.attestations = entry.attestations.filter(
						(value) => value !== op.value,
					);
					break;
				case "setNotes":
					entry.notes = op.value;
					break;
				default:
					return err(
						makeError(
							"InvalidPatchOp",
							`Unsupported surface patch operation ${(op as { op: string }).op}.`,
						),
					);
			}
		}

		replaceSurfaceEntryDirect(draft, entry);
		this.#state = draft;
		const storedEntry = draft.surfacesById.get(id);
		if (!storedEntry) {
			return err(
				makeError(
					"InvariantViolation",
					`Surface entry ${id} disappeared after patch.`,
				),
			);
		}

		return ok(cloneSurfaceEntry(storedEntry));
	}

	removePendingRelation(edge: PendingLemmaRelation<L>): DumdictResult<void> {
		const lemmaIdResult = assertLemmaIdMatchesDictionaryLanguage(
			this.language,
			edge.sourceLemmaId,
		);
		if (lemmaIdResult.isErr()) {
			return err(lemmaIdResult.error);
		}

		const pendingIdResult = assertPendingIdMatchesDictionaryLanguage(
			this.language,
			edge.targetPendingId,
		);
		if (pendingIdResult.isErr()) {
			return err(pendingIdResult.error);
		}

		const draft = cloneState(this.#state);
		const edgeKey = makePendingRelationKey(edge);
		const bySource = draft.pendingRelationsBySourceLemmaId.get(
			edge.sourceLemmaId,
		);
		if (!bySource || !bySource.has(edgeKey)) {
			return err(
				makeError(
					"PendingRelationNotFound",
					`Pending relation ${edgeKey} was not found in ${this.language} dumdict.`,
				),
			);
		}

		removePendingRelationEdge(draft, edge);
		this.#state = draft;
		return ok(undefined);
	}

	resolvePendingLemma(
		pendingId: PendingLemmaId<L>,
		lemmaId: DumlingId<"Lemma", L>,
	): DumdictResult<LemmaEntry<L>> {
		const pendingIdResult = assertPendingIdMatchesDictionaryLanguage(
			this.language,
			pendingId,
		);
		if (pendingIdResult.isErr()) {
			return err(pendingIdResult.error);
		}

		const lemmaIdResult = assertLemmaIdMatchesDictionaryLanguage(
			this.language,
			lemmaId,
		);
		if (lemmaIdResult.isErr()) {
			return err(lemmaIdResult.error);
		}

		const draft = cloneState(this.#state);
		const pendingRef = draft.pendingLemmaRefsById.get(pendingId);
		if (!pendingRef) {
			return err(
				makeError(
					"PendingRefNotFound",
					`Pending lemma ref ${pendingId} was not found in ${this.language} dumdict.`,
				),
			);
		}

		const lemmaEntry = draft.lemmasById.get(lemmaId);
		if (!lemmaEntry) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${lemmaId} was not found in ${this.language} dumdict.`,
				),
			);
		}

		if (!pendingRefMatchesLemma(pendingRef, lemmaEntry.lemma)) {
			return err(
				makeError(
					"PendingResolutionMismatch",
					`Pending lemma ref ${pendingId} does not match lemma entry ${lemmaId}.`,
				),
			);
		}

		const pendingEdges = sortPendingRelations(
			draft.pendingRelationsByPendingId.get(pendingId)?.values() ?? [],
		);
		for (const pendingEdge of pendingEdges) {
			if (pendingEdge.sourceLemmaId === lemmaId) {
				return err(
					makeError(
						"SelfRelationForbidden",
						`Resolving pending lemma ref ${pendingId} onto ${lemmaId} would create a self relation.`,
					),
				);
			}
		}

		for (const pendingEdge of pendingEdges) {
			if (pendingEdge.relationFamily === "lexical") {
				addResolvedLexicalRelationEdge(
					draft,
					pendingEdge.sourceLemmaId,
					pendingEdge.relation as LexicalRelation,
					lemmaId,
				);
			} else {
				addResolvedMorphologicalRelationEdge(
					draft,
					pendingEdge.sourceLemmaId,
					pendingEdge.relation as MorphologicalRelation,
					lemmaId,
				);
			}

			removePendingRelationEdge(draft, pendingEdge);
		}

		draft.pendingLemmaRefsById.delete(pendingId);
		this.#state = draft;
		const resolvedEntry = draft.lemmasById.get(lemmaId);
		if (!resolvedEntry) {
			return err(
				makeError(
					"InvariantViolation",
					`Lemma entry ${lemmaId} disappeared after resolving pending lemma ${pendingId}.`,
				),
			);
		}

		return ok(cloneLemmaEntry(resolvedEntry));
	}

	deleteLemmaEntry(id: DumlingId<"Lemma", L>): DumdictResult<void> {
		const lemmaIdResult = assertLemmaIdMatchesDictionaryLanguage(
			this.language,
			id,
		);
		if (lemmaIdResult.isErr()) {
			return err(lemmaIdResult.error);
		}

		const draft = cloneState(this.#state);
		const entry = draft.lemmasById.get(id);
		if (!entry) {
			return err(
				makeError(
					"LemmaEntryNotFound",
					`Lemma entry ${id} was not found in ${this.language} dumdict.`,
				),
			);
		}

		removeAllResolvedRelationsForLemma(draft, entry);

		for (const surfaceId of sortIds([
			...(draft.surfaceIdsByOwnerLemmaId.get(id) ?? new Set()),
		])) {
			deleteSurfaceEntryDirect(draft, surfaceId);
		}

		for (const pendingRelation of sortPendingRelations(
			draft.pendingRelationsBySourceLemmaId.get(id)?.values() ?? [],
		)) {
			removePendingRelationEdge(draft, pendingRelation);
		}

		deleteLemmaEntryDirect(draft, id);
		this.#state = draft;
		return ok(undefined);
	}

	deleteSurfaceEntry(id: DumlingId<"ResolvedSurface", L>): DumdictResult<void> {
		const surfaceIdResult = assertSurfaceIdMatchesDictionaryLanguage(
			this.language,
			id,
		);
		if (surfaceIdResult.isErr()) {
			return err(surfaceIdResult.error);
		}

		const draft = cloneState(this.#state);
		if (!draft.surfacesById.has(id)) {
			return err(
				makeError(
					"SurfaceEntryNotFound",
					`Surface entry ${id} was not found in ${this.language} dumdict.`,
				),
			);
		}

		deleteSurfaceEntryDirect(draft, id);
		this.#state = draft;
		return ok(undefined);
	}

	#applyLemmaPatchOp(
		state: InternalState<L>,
		entry: LemmaEntry<L>,
		op: LemmaEntryPatchOp<L>,
	) {
		switch (op.op) {
			case "addTranslation":
				entry.attestedTranslations = sortStrings([
					...entry.attestedTranslations,
					op.value,
				]);
				return ok(undefined);
			case "removeTranslation":
				entry.attestedTranslations = entry.attestedTranslations.filter(
					(value) => value !== op.value,
				);
				return ok(undefined);
			case "addAttestation":
				entry.attestations = sortStrings([...entry.attestations, op.value]);
				return ok(undefined);
			case "removeAttestation":
				entry.attestations = entry.attestations.filter(
					(value) => value !== op.value,
				);
				return ok(undefined);
			case "setNotes":
				entry.notes = op.value;
				return ok(undefined);
			case "addLexicalRelation":
				return this.#applyLexicalRelationPatch(
					state,
					entry,
					op.relation,
					op.target,
					true,
				);
			case "removeLexicalRelation":
				return this.#applyLexicalRelationPatch(
					state,
					entry,
					op.relation,
					op.target,
					false,
				);
			case "addMorphologicalRelation":
				return this.#applyMorphologicalRelationPatch(
					state,
					entry,
					op.relation,
					op.target,
					true,
				);
			case "removeMorphologicalRelation":
				return this.#applyMorphologicalRelationPatch(
					state,
					entry,
					op.relation,
					op.target,
					false,
				);
			default:
				return err(
					makeError(
						"InvalidPatchOp",
						`Unsupported lemma patch operation ${(op as { op: string }).op}.`,
					),
				);
		}
	}

	#applyLexicalRelationPatch(
		state: InternalState<L>,
		entry: LemmaEntry<L>,
		relation: LexicalRelation,
		target: LemmaRelationTarget<L>,
		shouldAdd: boolean,
	) {
		if (target.kind === "existing") {
			const targetResult = validateExistingRelationTarget(
				this.language,
				entry.id,
				target.lemmaId,
				state,
			);
			if (targetResult.isErr()) {
				return targetResult;
			}

			if (shouldAdd) {
				addResolvedLexicalRelationEdge(
					state,
					entry.id,
					relation,
					target.lemmaId,
				);
			} else {
				removeResolvedLexicalRelationEdge(
					state,
					entry.id,
					relation,
					target.lemmaId,
				);
			}

			return ok(undefined);
		}

		const pendingRef = makePendingLemmaRef(this.language, target.ref);
		if (
			shouldAdd &&
			pendingRefMatchesLemmaIdentityTuple(pendingRef, entry.lemma)
		) {
			return err(
				makeError(
					"SelfRelationForbidden",
					`Lemma ${entry.id} cannot relate to its own pending identity tuple.`,
				),
			);
		}

		const pendingEdge: PendingLemmaRelation<L> = {
			sourceLemmaId: entry.id,
			relationFamily: "lexical",
			relation,
			targetPendingId: pendingRef.pendingId,
		};

		if (shouldAdd) {
			addPendingRelationEdge(state, pendingRef, pendingEdge);
		} else {
			removePendingRelationEdge(state, pendingEdge);
		}

		return ok(undefined);
	}

	#applyMorphologicalRelationPatch(
		state: InternalState<L>,
		entry: LemmaEntry<L>,
		relation: MorphologicalRelation,
		target: LemmaRelationTarget<L>,
		shouldAdd: boolean,
	) {
		if (target.kind === "existing") {
			const targetResult = validateExistingRelationTarget(
				this.language,
				entry.id,
				target.lemmaId,
				state,
			);
			if (targetResult.isErr()) {
				return targetResult;
			}

			if (shouldAdd) {
				addResolvedMorphologicalRelationEdge(
					state,
					entry.id,
					relation,
					target.lemmaId,
				);
			} else {
				removeResolvedMorphologicalRelationEdge(
					state,
					entry.id,
					relation,
					target.lemmaId,
				);
			}

			return ok(undefined);
		}

		const pendingRef = makePendingLemmaRef(this.language, target.ref);
		if (
			shouldAdd &&
			pendingRefMatchesLemmaIdentityTuple(pendingRef, entry.lemma)
		) {
			return err(
				makeError(
					"SelfRelationForbidden",
					`Lemma ${entry.id} cannot relate to its own pending identity tuple.`,
				),
			);
		}

		const pendingEdge: PendingLemmaRelation<L> = {
			sourceLemmaId: entry.id,
			relationFamily: "morphological",
			relation,
			targetPendingId: pendingRef.pendingId,
		};

		if (shouldAdd) {
			addPendingRelationEdge(state, pendingRef, pendingEdge);
		} else {
			removePendingRelationEdge(state, pendingEdge);
		}

		return ok(undefined);
	}
}
