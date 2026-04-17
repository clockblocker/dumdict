import {
	type DumlingId,
	dumling,
	type Lemma,
	type ResolvedSurface,
	type SupportedLang,
	type UniversalLemmaKind,
	type UniversalLemmaSubKind,
} from "dumling";
import { err, ok, type Result } from "neverthrow";
import {
	getInverseLexicalRelation,
	type LexicalRelation,
	LexicalRelation as LexicalRelationSchema,
} from "./relations/lexical";
import {
	getInverseMorphologicalRelation,
	type MorphologicalRelation,
	MorphologicalRelation as MorphologicalRelationSchema,
} from "./relations/morphological";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

type LemmaRuntimeShape<L extends SupportedLang> = Lemma<L> & {
	canonicalLemma: string;
	language: L;
	lemmaKind: UniversalLemmaKind;
	morphemeKind?: UniversalLemmaSubKind;
	phrasemeKind?: UniversalLemmaSubKind;
	pos?: UniversalLemmaSubKind;
};

type ResolvedSurfaceRuntimeShape<L extends SupportedLang> =
	ResolvedSurface<L> & {
		lemma: Lemma<L>;
		language: L;
		normalizedFullSurface: string;
	};

const lexicalRelationKeys = [...LexicalRelationSchema.options].sort();
const morphologicalRelationKeys = [
	...MorphologicalRelationSchema.options,
].sort();

type RelationFamily = "lexical" | "morphological";

export type PendingLemmaId<L extends SupportedLang> = string & {
	readonly __pendingLemmaIdBrand: unique symbol;
	readonly __language?: L;
};

export type LexicalRelations<L extends SupportedLang> = Prettify<
	Partial<Record<LexicalRelation, DumlingId<"Lemma", L>[]>>
>;

export type MorphologicalRelations<L extends SupportedLang> = Prettify<
	Partial<Record<MorphologicalRelation, DumlingId<"Lemma", L>[]>>
>;

export type LemmaEntry<L extends SupportedLang> = {
	id: DumlingId<"Lemma", L>;
	lemma: Lemma<L>;
	lexicalRelations: LexicalRelations<L>;
	morphologicalRelations: MorphologicalRelations<L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type SurfaceEntry<L extends SupportedLang> = {
	id: DumlingId<"ResolvedSurface", L>;
	surface: ResolvedSurface<L>;
	ownerLemmaId: DumlingId<"Lemma", L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type PendingLemmaRefInput<L extends SupportedLang> = {
	canonicalLemma: string;
	lemmaKind: UniversalLemmaKind;
	lemmaSubKind: UniversalLemmaSubKind;
};

export type PendingLemmaRef<L extends SupportedLang> = {
	pendingId: PendingLemmaId<L>;
	language: L;
	canonicalLemma: string;
	lemmaKind: UniversalLemmaKind;
	lemmaSubKind: UniversalLemmaSubKind;
};

export type PendingLemmaRelation<L extends SupportedLang> = {
	sourceLemmaId: DumlingId<"Lemma", L>;
	relationFamily: RelationFamily;
	relation: LexicalRelation | MorphologicalRelation;
	targetPendingId: PendingLemmaId<L>;
};

export type LookupResult<L extends SupportedLang> = {
	lemmas: Record<DumlingId<"Lemma", L>, LemmaEntry<L>>;
	surfaces: Record<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>;
};

export type LemmaRelationTarget<L extends SupportedLang> =
	| { kind: "existing"; lemmaId: DumlingId<"Lemma", L> }
	| { kind: "pending"; ref: PendingLemmaRefInput<L> };

export type LemmaEntryPatchOp<L extends SupportedLang> =
	| { op: "addTranslation"; value: string }
	| { op: "removeTranslation"; value: string }
	| { op: "addAttestation"; value: string }
	| { op: "removeAttestation"; value: string }
	| { op: "setNotes"; value: string }
	| {
			op: "addLexicalRelation";
			relation: LexicalRelation;
			target: LemmaRelationTarget<L>;
	  }
	| {
			op: "removeLexicalRelation";
			relation: LexicalRelation;
			target: LemmaRelationTarget<L>;
	  }
	| {
			op: "addMorphologicalRelation";
			relation: MorphologicalRelation;
			target: LemmaRelationTarget<L>;
	  }
	| {
			op: "removeMorphologicalRelation";
			relation: MorphologicalRelation;
			target: LemmaRelationTarget<L>;
	  };

export type SurfaceEntryPatchOp<L extends SupportedLang> =
	| { op: "addTranslation"; value: string }
	| { op: "removeTranslation"; value: string }
	| { op: "addAttestation"; value: string }
	| { op: "removeAttestation"; value: string }
	| { op: "setNotes"; value: string };

export type DumdictErrorCode =
	| "LemmaEntryNotFound"
	| "SurfaceEntryNotFound"
	| "PendingRefNotFound"
	| "OwnerLemmaNotFound"
	| "PendingRelationNotFound"
	| "RelationTargetNotFound"
	| "PendingResolutionMismatch"
	| "LanguageMismatch"
	| "InvalidOwnership"
	| "InvalidPatchOp"
	| "SelfRelationForbidden"
	| "InvariantViolation"
	| "DecodeFailed";

export type DumdictError = {
	code: DumdictErrorCode;
	message: string;
	cause?: unknown;
};

export type DumdictResult<T> = Result<T, DumdictError>;

export type Dumdict<L extends SupportedLang> = {
	readonly language: L;
	lookupBySurface(surface: string): DumdictResult<LookupResult<L>>;
	lookupLemmasBySurface(
		surface: string,
	): DumdictResult<Record<DumlingId<"Lemma", L>, LemmaEntry<L>>>;
	getLemmaEntry(id: DumlingId<"Lemma", L>): DumdictResult<LemmaEntry<L>>;
	getSurfaceEntry(
		id: DumlingId<"ResolvedSurface", L>,
	): DumdictResult<SurfaceEntry<L>>;
	getOwnedSurfaceEntries(
		lemmaId: DumlingId<"Lemma", L>,
	): DumdictResult<Record<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>>;
	getPendingLemmaRef(
		pendingId: PendingLemmaId<L>,
	): DumdictResult<PendingLemmaRef<L>>;
	listPendingLemmaRefs(): DumdictResult<
		Record<PendingLemmaId<L>, PendingLemmaRef<L>>
	>;
	listPendingRelationsForLemma(
		lemmaId: DumlingId<"Lemma", L>,
	): DumdictResult<PendingLemmaRelation<L>[]>;
	upsertLemmaEntry(entry: LemmaEntry<L>): DumdictResult<LemmaEntry<L>>;
	upsertSurfaceEntry(entry: SurfaceEntry<L>): DumdictResult<SurfaceEntry<L>>;
	patchLemmaEntry(
		id: DumlingId<"Lemma", L>,
		ops: LemmaEntryPatchOp<L> | LemmaEntryPatchOp<L>[],
	): DumdictResult<LemmaEntry<L>>;
	patchSurfaceEntry(
		id: DumlingId<"ResolvedSurface", L>,
		ops: SurfaceEntryPatchOp<L> | SurfaceEntryPatchOp<L>[],
	): DumdictResult<SurfaceEntry<L>>;
	removePendingRelation(edge: PendingLemmaRelation<L>): DumdictResult<void>;
	resolvePendingLemma(
		pendingId: PendingLemmaId<L>,
		lemmaId: DumlingId<"Lemma", L>,
	): DumdictResult<LemmaEntry<L>>;
	deleteLemmaEntry(id: DumlingId<"Lemma", L>): DumdictResult<void>;
	deleteSurfaceEntry(id: DumlingId<"ResolvedSurface", L>): DumdictResult<void>;
};

type InternalState<L extends SupportedLang> = {
	lemmasById: Map<DumlingId<"Lemma", L>, LemmaEntry<L>>;
	surfacesById: Map<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>;
	surfaceIdsByOwnerLemmaId: Map<
		DumlingId<"Lemma", L>,
		Set<DumlingId<"ResolvedSurface", L>>
	>;
	lemmaLookupIndex: Map<string, Set<DumlingId<"Lemma", L>>>;
	surfaceLookupIndex: Map<string, Set<DumlingId<"ResolvedSurface", L>>>;
	pendingLemmaRefsById: Map<PendingLemmaId<L>, PendingLemmaRef<L>>;
	pendingRelationsBySourceLemmaId: Map<
		DumlingId<"Lemma", L>,
		Map<string, PendingLemmaRelation<L>>
	>;
	pendingRelationsByPendingId: Map<
		PendingLemmaId<L>,
		Map<string, PendingLemmaRelation<L>>
	>;
};

function makeError(
	code: DumdictErrorCode,
	message: string,
	cause?: unknown,
): DumdictError {
	return { code, message, cause };
}

function makeEmptyState<L extends SupportedLang>(): InternalState<L> {
	return {
		lemmasById: new Map(),
		surfacesById: new Map(),
		surfaceIdsByOwnerLemmaId: new Map(),
		lemmaLookupIndex: new Map(),
		surfaceLookupIndex: new Map(),
		pendingLemmaRefsById: new Map(),
		pendingRelationsBySourceLemmaId: new Map(),
		pendingRelationsByPendingId: new Map(),
	};
}

function cloneMapOfSets<K, V>(input: Map<K, Set<V>>): Map<K, Set<V>> {
	const next = new Map<K, Set<V>>();
	for (const [key, values] of input) {
		next.set(key, new Set(values));
	}
	return next;
}

function cloneMapOfMaps<K, IK, V>(
	input: Map<K, Map<IK, V>>,
): Map<K, Map<IK, V>> {
	const next = new Map<K, Map<IK, V>>();
	for (const [key, values] of input) {
		next.set(key, new Map(values));
	}
	return next;
}

function cloneState<L extends SupportedLang>(
	state: InternalState<L>,
): InternalState<L> {
	return {
		lemmasById: new Map(
			Array.from(state.lemmasById, ([id, entry]) => [
				id,
				cloneLemmaEntry(entry),
			]),
		),
		surfacesById: new Map(
			Array.from(state.surfacesById, ([id, entry]) => [
				id,
				cloneSurfaceEntry(entry),
			]),
		),
		surfaceIdsByOwnerLemmaId: cloneMapOfSets(state.surfaceIdsByOwnerLemmaId),
		lemmaLookupIndex: cloneMapOfSets(state.lemmaLookupIndex),
		surfaceLookupIndex: cloneMapOfSets(state.surfaceLookupIndex),
		pendingLemmaRefsById: new Map(
			Array.from(state.pendingLemmaRefsById, ([id, ref]) => [
				id,
				clonePendingLemmaRef(ref),
			]),
		),
		pendingRelationsBySourceLemmaId: cloneMapOfMaps(
			state.pendingRelationsBySourceLemmaId,
		),
		pendingRelationsByPendingId: cloneMapOfMaps(
			state.pendingRelationsByPendingId,
		),
	};
}

function normalizeLowercase(input: string) {
	return input.normalize("NFC").toLowerCase();
}

function makeLookupKey(input: string) {
	return normalizeLowercase(input);
}

function sortStrings(values: readonly string[]) {
	return Array.from(new Set(values)).sort((left, right) =>
		left.localeCompare(right),
	);
}

function sortIds<T extends string>(values: readonly T[]) {
	return Array.from(new Set(values)).sort((left, right) =>
		left.localeCompare(right),
	);
}

function toSortedRecord<K extends string, V>(
	entries: readonly (readonly [K, V])[],
) {
	return Object.fromEntries(
		[...entries].sort(([left], [right]) => left.localeCompare(right)),
	) as Record<K, V>;
}

function cloneRelationRecord<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relationKeys: readonly R[],
) {
	const entries: [R, DumlingId<"Lemma", L>[]][] = [];
	for (const relationKey of relationKeys) {
		const values = record[relationKey];
		if (!values || values.length === 0) {
			continue;
		}

		entries.push([relationKey, sortIds(values)]);
	}

	return toSortedRecord(entries);
}

function cloneLemmaEntry<L extends SupportedLang>(
	entry: LemmaEntry<L>,
): LemmaEntry<L> {
	return {
		id: entry.id,
		lemma: structuredClone(entry.lemma),
		lexicalRelations: cloneRelationRecord(
			entry.lexicalRelations,
			lexicalRelationKeys,
		),
		morphologicalRelations: cloneRelationRecord(
			entry.morphologicalRelations,
			morphologicalRelationKeys,
		),
		attestedTranslations: sortStrings(entry.attestedTranslations),
		attestations: sortStrings(entry.attestations),
		notes: entry.notes,
	};
}

function cloneSurfaceEntry<L extends SupportedLang>(
	entry: SurfaceEntry<L>,
): SurfaceEntry<L> {
	return {
		id: entry.id,
		surface: structuredClone(entry.surface),
		ownerLemmaId: entry.ownerLemmaId,
		attestedTranslations: sortStrings(entry.attestedTranslations),
		attestations: sortStrings(entry.attestations),
		notes: entry.notes,
	};
}

function clonePendingLemmaRef<L extends SupportedLang>(
	ref: PendingLemmaRef<L>,
): PendingLemmaRef<L> {
	return { ...ref };
}

function asLemmaRuntimeShape<L extends SupportedLang>(lemma: Lemma<L>) {
	return lemma as LemmaRuntimeShape<L>;
}

function asResolvedSurfaceRuntimeShape<L extends SupportedLang>(
	surface: ResolvedSurface<L>,
) {
	return surface as ResolvedSurfaceRuntimeShape<L>;
}

function getLemmaCanonicalLemma<L extends SupportedLang>(lemma: Lemma<L>) {
	return asLemmaRuntimeShape(lemma).canonicalLemma;
}

function getLemmaLanguage<L extends SupportedLang>(lemma: Lemma<L>) {
	return asLemmaRuntimeShape(lemma).language;
}

function getLemmaSubKind<L extends SupportedLang>(lemma: Lemma<L>) {
	const runtimeLemma = asLemmaRuntimeShape(lemma);
	switch (runtimeLemma.lemmaKind) {
		case "Lexeme":
			return runtimeLemma.pos!;
		case "Morpheme":
			return runtimeLemma.morphemeKind!;
		case "Phraseme":
			return runtimeLemma.phrasemeKind!;
	}
}

function getLemmaKind<L extends SupportedLang>(lemma: Lemma<L>) {
	return asLemmaRuntimeShape(lemma).lemmaKind;
}

function getSurfaceLanguage<L extends SupportedLang>(
	surface: ResolvedSurface<L>,
) {
	return asResolvedSurfaceRuntimeShape(surface).language;
}

function getSurfaceNormalizedFullSurface<L extends SupportedLang>(
	surface: ResolvedSurface<L>,
) {
	return asResolvedSurfaceRuntimeShape(surface).normalizedFullSurface;
}

function getSurfaceLemma<L extends SupportedLang>(surface: ResolvedSurface<L>) {
	return asResolvedSurfaceRuntimeShape(surface).lemma;
}

function derivePendingLemmaId<L extends SupportedLang>(
	language: L,
	input: PendingLemmaRefInput<L>,
): PendingLemmaId<L> {
	return [
		"pending",
		"v1",
		encodeURIComponent(language),
		encodeURIComponent(input.canonicalLemma),
		encodeURIComponent(input.lemmaKind),
		encodeURIComponent(input.lemmaSubKind),
	].join(":") as PendingLemmaId<L>;
}

function makePendingLemmaRef<L extends SupportedLang>(
	language: L,
	input: PendingLemmaRefInput<L>,
): PendingLemmaRef<L> {
	return {
		pendingId: derivePendingLemmaId(language, input),
		language,
		canonicalLemma: input.canonicalLemma,
		lemmaKind: input.lemmaKind,
		lemmaSubKind: input.lemmaSubKind,
	};
}

function makePendingRelationKey<L extends SupportedLang>(
	edge: PendingLemmaRelation<L>,
) {
	return [
		edge.sourceLemmaId,
		edge.relationFamily,
		edge.relation,
		edge.targetPendingId,
	].join("\u0000");
}

function sortPendingRelations<L extends SupportedLang>(
	relations: Iterable<PendingLemmaRelation<L>>,
) {
	return [...relations].sort((left, right) => {
		const familyOrder = left.relationFamily.localeCompare(right.relationFamily);
		if (familyOrder !== 0) {
			return familyOrder;
		}

		const relationOrder = left.relation.localeCompare(right.relation);
		if (relationOrder !== 0) {
			return relationOrder;
		}

		const targetOrder = left.targetPendingId.localeCompare(
			right.targetPendingId,
		);
		if (targetOrder !== 0) {
			return targetOrder;
		}

		return left.sourceLemmaId.localeCompare(right.sourceLemmaId);
	});
}

function ensureLookupBucket<K extends string>(
	index: Map<string, Set<K>>,
	key: string,
): Set<K> {
	const existing = index.get(key);
	if (existing) {
		return existing;
	}

	const created = new Set<K>();
	index.set(key, created);
	return created;
}

function addLookupValue<K extends string>(
	index: Map<string, Set<K>>,
	key: string,
	value: K,
) {
	ensureLookupBucket(index, key).add(value);
}

function removeLookupValue<K extends string>(
	index: Map<string, Set<K>>,
	key: string,
	value: K,
) {
	const bucket = index.get(key);
	if (!bucket) {
		return;
	}

	bucket.delete(value);
	if (bucket.size === 0) {
		index.delete(key);
	}
}

function replaceLemmaEntryDirect<L extends SupportedLang>(
	state: InternalState<L>,
	entry: LemmaEntry<L>,
) {
	const canonicalEntry = cloneLemmaEntry(entry);
	const existing = state.lemmasById.get(canonicalEntry.id);
	if (existing) {
		removeLookupValue(
			state.lemmaLookupIndex,
			makeLookupKey(getLemmaCanonicalLemma(existing.lemma)),
			existing.id,
		);
	}

	state.lemmasById.set(canonicalEntry.id, canonicalEntry);
	addLookupValue(
		state.lemmaLookupIndex,
		makeLookupKey(getLemmaCanonicalLemma(canonicalEntry.lemma)),
		canonicalEntry.id,
	);
}

function deleteLemmaEntryDirect<L extends SupportedLang>(
	state: InternalState<L>,
	lemmaId: DumlingId<"Lemma", L>,
) {
	const existing = state.lemmasById.get(lemmaId);
	if (!existing) {
		return;
	}

	state.lemmasById.delete(lemmaId);
	removeLookupValue(
		state.lemmaLookupIndex,
		makeLookupKey(getLemmaCanonicalLemma(existing.lemma)),
		lemmaId,
	);
}

function replaceSurfaceEntryDirect<L extends SupportedLang>(
	state: InternalState<L>,
	entry: SurfaceEntry<L>,
) {
	const canonicalEntry = cloneSurfaceEntry(entry);
	const existing = state.surfacesById.get(canonicalEntry.id);
	if (existing) {
		removeLookupValue(
			state.surfaceLookupIndex,
			makeLookupKey(getSurfaceNormalizedFullSurface(existing.surface)),
			existing.id,
		);

		const ownedSurfaceIds = state.surfaceIdsByOwnerLemmaId.get(
			existing.ownerLemmaId,
		);
		ownedSurfaceIds?.delete(existing.id);
		if (ownedSurfaceIds && ownedSurfaceIds.size === 0) {
			state.surfaceIdsByOwnerLemmaId.delete(existing.ownerLemmaId);
		}
	}

	state.surfacesById.set(canonicalEntry.id, canonicalEntry);
	addLookupValue(
		state.surfaceLookupIndex,
		makeLookupKey(getSurfaceNormalizedFullSurface(canonicalEntry.surface)),
		canonicalEntry.id,
	);

	const ownerBucket =
		state.surfaceIdsByOwnerLemmaId.get(canonicalEntry.ownerLemmaId) ??
		new Set();
	ownerBucket.add(canonicalEntry.id);
	state.surfaceIdsByOwnerLemmaId.set(canonicalEntry.ownerLemmaId, ownerBucket);
}

function deleteSurfaceEntryDirect<L extends SupportedLang>(
	state: InternalState<L>,
	surfaceId: DumlingId<"ResolvedSurface", L>,
) {
	const existing = state.surfacesById.get(surfaceId);
	if (!existing) {
		return;
	}

	state.surfacesById.delete(surfaceId);
	removeLookupValue(
		state.surfaceLookupIndex,
		makeLookupKey(getSurfaceNormalizedFullSurface(existing.surface)),
		surfaceId,
	);

	const ownerBucket = state.surfaceIdsByOwnerLemmaId.get(existing.ownerLemmaId);
	ownerBucket?.delete(surfaceId);
	if (ownerBucket && ownerBucket.size === 0) {
		state.surfaceIdsByOwnerLemmaId.delete(existing.ownerLemmaId);
	}
}

function getMutableLemmaEntry<L extends SupportedLang>(
	state: InternalState<L>,
	lemmaId: DumlingId<"Lemma", L>,
) {
	const entry = state.lemmasById.get(lemmaId);
	if (!entry) {
		return undefined;
	}

	return entry;
}

function ensureRelationSet<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relation: R,
) {
	const existing = record[relation];
	if (existing) {
		return existing;
	}

	const created: DumlingId<"Lemma", L>[] = [];
	record[relation] = created;
	return created;
}

function addRelationValue<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relation: R,
	targetId: DumlingId<"Lemma", L>,
) {
	const values = ensureRelationSet(record, relation);
	if (!values.includes(targetId)) {
		values.push(targetId);
		values.sort((left, right) => left.localeCompare(right));
	}
}

function removeRelationValue<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relation: R,
	targetId: DumlingId<"Lemma", L>,
) {
	const values = record[relation];
	if (!values) {
		return;
	}

	const filtered = values.filter((value) => value !== targetId);
	if (filtered.length === 0) {
		delete record[relation];
		return;
	}

	record[relation] = filtered;
}

function addResolvedLexicalRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: LexicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	addRelationValue(sourceEntry.lexicalRelations, relation, targetLemmaId);
	addRelationValue(
		targetEntry.lexicalRelations,
		getInverseLexicalRelation(relation),
		sourceLemmaId,
	);
}

function removeResolvedLexicalRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: LexicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	removeRelationValue(sourceEntry.lexicalRelations, relation, targetLemmaId);
	removeRelationValue(
		targetEntry.lexicalRelations,
		getInverseLexicalRelation(relation),
		sourceLemmaId,
	);
}

function addResolvedMorphologicalRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: MorphologicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	addRelationValue(sourceEntry.morphologicalRelations, relation, targetLemmaId);
	addRelationValue(
		targetEntry.morphologicalRelations,
		getInverseMorphologicalRelation(relation),
		sourceLemmaId,
	);
}

function removeResolvedMorphologicalRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: MorphologicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	removeRelationValue(
		sourceEntry.morphologicalRelations,
		relation,
		targetLemmaId,
	);
	removeRelationValue(
		targetEntry.morphologicalRelations,
		getInverseMorphologicalRelation(relation),
		sourceLemmaId,
	);
}

function removeAllResolvedRelationsForLemma<L extends SupportedLang>(
	state: InternalState<L>,
	entry: LemmaEntry<L>,
) {
	for (const relation of lexicalRelationKeys) {
		const targetIds = [...(entry.lexicalRelations[relation] ?? [])];
		for (const targetId of targetIds) {
			removeResolvedLexicalRelationEdge(state, entry.id, relation, targetId);
		}
	}

	for (const relation of morphologicalRelationKeys) {
		const targetIds = [...(entry.morphologicalRelations[relation] ?? [])];
		for (const targetId of targetIds) {
			removeResolvedMorphologicalRelationEdge(
				state,
				entry.id,
				relation,
				targetId,
			);
		}
	}
}

function addPendingRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	ref: PendingLemmaRef<L>,
	edge: PendingLemmaRelation<L>,
) {
	state.pendingLemmaRefsById.set(ref.pendingId, clonePendingLemmaRef(ref));

	const edgeKey = makePendingRelationKey(edge);
	const bySource =
		state.pendingRelationsBySourceLemmaId.get(edge.sourceLemmaId) ?? new Map();
	bySource.set(edgeKey, edge);
	state.pendingRelationsBySourceLemmaId.set(edge.sourceLemmaId, bySource);

	const byPending =
		state.pendingRelationsByPendingId.get(edge.targetPendingId) ?? new Map();
	byPending.set(edgeKey, edge);
	state.pendingRelationsByPendingId.set(edge.targetPendingId, byPending);
}

function removePendingRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	edge: PendingLemmaRelation<L>,
) {
	const edgeKey = makePendingRelationKey(edge);

	const bySource = state.pendingRelationsBySourceLemmaId.get(
		edge.sourceLemmaId,
	);
	bySource?.delete(edgeKey);
	if (bySource && bySource.size === 0) {
		state.pendingRelationsBySourceLemmaId.delete(edge.sourceLemmaId);
	}

	const byPending = state.pendingRelationsByPendingId.get(edge.targetPendingId);
	byPending?.delete(edgeKey);
	if (byPending && byPending.size === 0) {
		state.pendingRelationsByPendingId.delete(edge.targetPendingId);
		state.pendingLemmaRefsById.delete(edge.targetPendingId);
	}
}

function collectLemmaRecord<L extends SupportedLang>(
	state: InternalState<L>,
	lemmaIds: Iterable<DumlingId<"Lemma", L>>,
) {
	const entries: [DumlingId<"Lemma", L>, LemmaEntry<L>][] = [];
	for (const lemmaId of sortIds([...lemmaIds])) {
		const entry = state.lemmasById.get(lemmaId);
		if (!entry) {
			continue;
		}

		entries.push([lemmaId, cloneLemmaEntry(entry)]);
	}

	return toSortedRecord(entries);
}

function collectSurfaceRecord<L extends SupportedLang>(
	state: InternalState<L>,
	surfaceIds: Iterable<DumlingId<"ResolvedSurface", L>>,
) {
	const entries: [DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>][] = [];
	for (const surfaceId of sortIds([...surfaceIds])) {
		const entry = state.surfacesById.get(surfaceId);
		if (!entry) {
			continue;
		}

		entries.push([surfaceId, cloneSurfaceEntry(entry)]);
	}

	return toSortedRecord(entries);
}

function inferLemmaIdLanguage(lemmaId: string) {
	for (const language of ["English", "German", "Hebrew"] as const) {
		if (
			dumling.idCodec
				.forLanguage(language)
				.tryToDecodeAs("Lemma", lemmaId)
				.isOk()
		) {
			return language;
		}
	}

	return undefined;
}

function inferSurfaceIdLanguage(surfaceId: string) {
	for (const language of ["English", "German", "Hebrew"] as const) {
		if (
			dumling.idCodec
				.forLanguage(language)
				.tryToDecodeAs("ResolvedSurface", surfaceId)
				.isOk()
		) {
			return language;
		}
	}

	return undefined;
}

class InMemoryDumdict<L extends SupportedLang> implements Dumdict<L> {
	readonly language: L;

	#state: InternalState<L>;

	constructor(language: L) {
		this.language = language;
		this.#state = makeEmptyState();
	}

	lookupBySurface(surface: string): DumdictResult<LookupResult<L>> {
		const lookupKey = makeLookupKey(surface);
		const lemmaIds = this.#state.lemmaLookupIndex.get(lookupKey) ?? new Set();
		const surfaceIds =
			this.#state.surfaceLookupIndex.get(lookupKey) ?? new Set();

		return ok({
			lemmas: collectLemmaRecord(this.#state, lemmaIds),
			surfaces: collectSurfaceRecord(this.#state, surfaceIds),
		});
	}

	lookupLemmasBySurface(
		surface: string,
	): DumdictResult<Record<DumlingId<"Lemma", L>, LemmaEntry<L>>> {
		const lookupKey = makeLookupKey(surface);
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
		const idResult = this.#assertLemmaIdMatchesDictionaryLanguage(id);
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
		const idResult = this.#assertSurfaceIdMatchesDictionaryLanguage(id);
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
		const lemmaIdResult = this.#assertLemmaIdMatchesDictionaryLanguage(lemmaId);
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
		const lemmaIdResult = this.#assertLemmaIdMatchesDictionaryLanguage(lemmaId);
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
		const entryResult = this.#validateLemmaEntry(entry);
		if (entryResult.isErr()) {
			return err(entryResult.error);
		}

		const draft = cloneState(this.#state);
		const existing = draft.lemmasById.get(entry.id);
		const relationValidation = this.#validateResolvedRelationTargets(
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

		for (const relation of lexicalRelationKeys) {
			for (const targetLemmaId of sortIds(
				entry.lexicalRelations[relation] ?? [],
			)) {
				addResolvedLexicalRelationEdge(
					draft,
					entry.id,
					relation,
					targetLemmaId,
				);
			}
		}

		for (const relation of morphologicalRelationKeys) {
			for (const targetLemmaId of sortIds(
				entry.morphologicalRelations[relation] ?? [],
			)) {
				addResolvedMorphologicalRelationEdge(
					draft,
					entry.id,
					relation,
					targetLemmaId,
				);
			}
		}

		this.#state = draft;
		return ok(cloneLemmaEntry(draft.lemmasById.get(entry.id)!));
	}

	upsertSurfaceEntry(entry: SurfaceEntry<L>): DumdictResult<SurfaceEntry<L>> {
		const entryResult = this.#validateSurfaceEntry(entry);
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
		return ok(cloneSurfaceEntry(draft.surfacesById.get(entry.id)!));
	}

	patchLemmaEntry(
		id: DumlingId<"Lemma", L>,
		ops: LemmaEntryPatchOp<L> | LemmaEntryPatchOp<L>[],
	): DumdictResult<LemmaEntry<L>> {
		const lemmaIdResult = this.#assertLemmaIdMatchesDictionaryLanguage(id);
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
		return ok(cloneLemmaEntry(draft.lemmasById.get(id)!));
	}

	patchSurfaceEntry(
		id: DumlingId<"ResolvedSurface", L>,
		ops: SurfaceEntryPatchOp<L> | SurfaceEntryPatchOp<L>[],
	): DumdictResult<SurfaceEntry<L>> {
		const surfaceIdResult = this.#assertSurfaceIdMatchesDictionaryLanguage(id);
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
		return ok(cloneSurfaceEntry(draft.surfacesById.get(id)!));
	}

	removePendingRelation(edge: PendingLemmaRelation<L>): DumdictResult<void> {
		const lemmaIdResult = this.#assertLemmaIdMatchesDictionaryLanguage(
			edge.sourceLemmaId,
		);
		if (lemmaIdResult.isErr()) {
			return err(lemmaIdResult.error);
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
		const lemmaIdResult = this.#assertLemmaIdMatchesDictionaryLanguage(lemmaId);
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

		if (!this.#pendingRefMatchesLemma(pendingRef, lemmaEntry.lemma)) {
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
		return ok(cloneLemmaEntry(draft.lemmasById.get(lemmaId)!));
	}

	deleteLemmaEntry(id: DumlingId<"Lemma", L>): DumdictResult<void> {
		const lemmaIdResult = this.#assertLemmaIdMatchesDictionaryLanguage(id);
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
		const surfaceIdResult = this.#assertSurfaceIdMatchesDictionaryLanguage(id);
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

	#assertLemmaIdMatchesDictionaryLanguage(id: DumlingId<"Lemma", L>) {
		const language = inferLemmaIdLanguage(id);
		if (!language) {
			return err(
				makeError(
					"DecodeFailed",
					`Could not decode lemma ID ${id} as a supported dumling lemma ID.`,
				),
			);
		}

		if (language !== this.language) {
			return err(
				makeError(
					"LanguageMismatch",
					`Lemma ID ${id} belongs to ${language}, not ${this.language}.`,
				),
			);
		}

		return ok(undefined);
	}

	#assertSurfaceIdMatchesDictionaryLanguage(
		id: DumlingId<"ResolvedSurface", L>,
	) {
		const language = inferSurfaceIdLanguage(id);
		if (!language) {
			return err(
				makeError(
					"DecodeFailed",
					`Could not decode surface ID ${id} as a supported dumling resolved-surface ID.`,
				),
			);
		}

		if (language !== this.language) {
			return err(
				makeError(
					"LanguageMismatch",
					`Surface ID ${id} belongs to ${language}, not ${this.language}.`,
				),
			);
		}

		return ok(undefined);
	}

	#validateLemmaEntry(entry: LemmaEntry<L>) {
		if (getLemmaLanguage(entry.lemma) !== this.language) {
			return err(
				makeError(
					"LanguageMismatch",
					`Lemma entry payload language ${getLemmaLanguage(entry.lemma)} does not match ${this.language}.`,
				),
			);
		}

		const idLanguageResult = this.#assertLemmaIdMatchesDictionaryLanguage(
			entry.id,
		);
		if (idLanguageResult.isErr()) {
			return idLanguageResult;
		}

		const derivedId = dumling.idCodec
			.forLanguage(this.language)
			.makeDumlingIdFor(entry.lemma);
		if (entry.id !== derivedId) {
			return err(
				makeError(
					"InvariantViolation",
					`Lemma entry ID ${entry.id} does not match the Dumling ID derived from its lemma payload.`,
				),
			);
		}

		return ok(undefined);
	}

	#validateSurfaceEntry(entry: SurfaceEntry<L>) {
		if (getSurfaceLanguage(entry.surface) !== this.language) {
			return err(
				makeError(
					"LanguageMismatch",
					`Surface entry payload language ${getSurfaceLanguage(entry.surface)} does not match ${this.language}.`,
				),
			);
		}

		const surfaceIdResult = this.#assertSurfaceIdMatchesDictionaryLanguage(
			entry.id,
		);
		if (surfaceIdResult.isErr()) {
			return surfaceIdResult;
		}

		const ownerIdResult = this.#assertLemmaIdMatchesDictionaryLanguage(
			entry.ownerLemmaId,
		);
		if (ownerIdResult.isErr()) {
			return ownerIdResult;
		}

		const derivedSurfaceId = dumling.idCodec
			.forLanguage(this.language)
			.makeDumlingIdFor(entry.surface);
		if (entry.id !== derivedSurfaceId) {
			return err(
				makeError(
					"InvariantViolation",
					`Surface entry ID ${entry.id} does not match the Dumling ID derived from its surface payload.`,
				),
			);
		}

		const derivedOwnerLemmaId = dumling.idCodec
			.forLanguage(this.language)
			.makeDumlingIdFor(getSurfaceLemma(entry.surface));
		if (entry.ownerLemmaId !== derivedOwnerLemmaId) {
			return err(
				makeError(
					"InvalidOwnership",
					`Surface entry owner ${entry.ownerLemmaId} does not match the lemma encoded inside the surface payload.`,
				),
			);
		}

		return ok(undefined);
	}

	#validateResolvedRelationTargets(
		sourceLemmaId: DumlingId<"Lemma", L>,
		lexicalRelations: LexicalRelations<L>,
		morphologicalRelations: MorphologicalRelations<L>,
		state: InternalState<L>,
	) {
		for (const relation of lexicalRelationKeys) {
			for (const targetLemmaId of lexicalRelations[relation] ?? []) {
				const relationResult = this.#validateExistingRelationTarget(
					sourceLemmaId,
					targetLemmaId,
					state,
				);
				if (relationResult.isErr()) {
					return relationResult;
				}
			}
		}

		for (const relation of morphologicalRelationKeys) {
			for (const targetLemmaId of morphologicalRelations[relation] ?? []) {
				const relationResult = this.#validateExistingRelationTarget(
					sourceLemmaId,
					targetLemmaId,
					state,
				);
				if (relationResult.isErr()) {
					return relationResult;
				}
			}
		}

		return ok(undefined);
	}

	#validateExistingRelationTarget(
		sourceLemmaId: DumlingId<"Lemma", L>,
		targetLemmaId: DumlingId<"Lemma", L>,
		state: InternalState<L>,
	) {
		const targetLanguageResult =
			this.#assertLemmaIdMatchesDictionaryLanguage(targetLemmaId);
		if (targetLanguageResult.isErr()) {
			return targetLanguageResult;
		}

		if (sourceLemmaId === targetLemmaId) {
			return err(
				makeError(
					"SelfRelationForbidden",
					`Lemma ${sourceLemmaId} cannot relate to itself.`,
				),
			);
		}

		if (!state.lemmasById.has(targetLemmaId)) {
			return err(
				makeError(
					"RelationTargetNotFound",
					`Relation target lemma ${targetLemmaId} was not found in ${this.language} dumdict.`,
				),
			);
		}

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
			const targetResult = this.#validateExistingRelationTarget(
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
			this.#pendingRefMatchesLemmaIdentityTuple(pendingRef, entry.lemma)
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
			const targetResult = this.#validateExistingRelationTarget(
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
			this.#pendingRefMatchesLemmaIdentityTuple(pendingRef, entry.lemma)
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

	#pendingRefMatchesLemma(pendingRef: PendingLemmaRef<L>, lemma: Lemma<L>) {
		return this.#pendingRefMatchesLemmaIdentityTuple(pendingRef, lemma);
	}

	#pendingRefMatchesLemmaIdentityTuple(
		pendingRef: Pick<
			PendingLemmaRef<L>,
			"canonicalLemma" | "lemmaKind" | "lemmaSubKind"
		>,
		lemma: Lemma<L>,
	) {
		return (
			pendingRef.canonicalLemma === getLemmaCanonicalLemma(lemma) &&
			pendingRef.lemmaKind === getLemmaKind(lemma) &&
			pendingRef.lemmaSubKind === getLemmaSubKind(lemma)
		);
	}
}

export function makeDumdict<L extends SupportedLang>(language: L): Dumdict<L> {
	return new InMemoryDumdict(language);
}
