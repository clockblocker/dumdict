import type {
	V0DumlingId,
	V0LemmaKindFor,
	V0LemmaSubKindFor,
	V0Lemma,
	V0Surface,
	V0SupportedLang,
} from "../dumling-compat";
import type { V0DumdictResult } from "./errors";
import type { V0LexicalRelation } from "./relations/lexical";
import type { V0MorphologicalRelation } from "./relations/morphological";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type V0RelationFamily = "lexical" | "morphological";

export type V0PendingLemmaId<L extends V0SupportedLang> = string & {
	readonly __pendingLemmaIdBrand: unique symbol;
	readonly __language?: L;
};

export type V0LexicalRelations<L extends V0SupportedLang> = Prettify<
	Partial<Record<V0LexicalRelation, V0DumlingId<"Lemma", L>[]>>
>;

export type V0MorphologicalRelations<L extends V0SupportedLang> = Prettify<
	Partial<Record<V0MorphologicalRelation, V0DumlingId<"Lemma", L>[]>>
>;

export type V0LemmaEntry<L extends V0SupportedLang> = {
	id: V0DumlingId<"Lemma", L>;
	lemma: V0Lemma<L>;
	lexicalRelations: V0LexicalRelations<L>;
	morphologicalRelations: V0MorphologicalRelations<L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type V0SurfaceEntry<L extends V0SupportedLang> = {
	id: V0DumlingId<"Surface", L>;
	surface: V0Surface<L>;
	ownerLemmaId: V0DumlingId<"Lemma", L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type V0PendingLemmaRefInputCase<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK>,
> = {
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: LSK;
};

export type V0PendingLemmaRefInput<L extends V0SupportedLang> = {
	[LK in V0LemmaKindFor<L>]: {
		[LSK in V0LemmaSubKindFor<L, LK>]: V0PendingLemmaRefInputCase<L, LK, LSK>;
	}[V0LemmaSubKindFor<L, LK>];
}[V0LemmaKindFor<L>];

export type V0PendingLemmaRef<L extends V0SupportedLang> = V0PendingLemmaRefInput<L> & {
	pendingId: V0PendingLemmaId<L>;
	language: L;
};

export type V0PendingLemmaRelation<L extends V0SupportedLang> = {
	sourceLemmaId: V0DumlingId<"Lemma", L>;
	relationFamily: V0RelationFamily;
	relation: V0LexicalRelation | V0MorphologicalRelation;
	targetPendingId: V0PendingLemmaId<L>;
};

export type V0LookupResult<L extends V0SupportedLang> = {
	lemmas: Record<V0DumlingId<"Lemma", L>, V0LemmaEntry<L>>;
	surfaces: Record<V0DumlingId<"Surface", L>, V0SurfaceEntry<L>>;
};

export type V0DictionarySnapshotData<L extends V0SupportedLang> = {
	language: L;
	revision: string;
	lemmas: V0LemmaEntry<L>[];
	surfaces: V0SurfaceEntry<L>[];
	pendingRefs: V0PendingLemmaRef<L>[];
	pendingRelations: V0PendingLemmaRelation<L>[];
};

export type V0ReadDictionarySnapshot<L extends V0SupportedLang> =
	V0DictionarySnapshotData<L> & {
		authority: "read";
		completeness: "partial" | "full";
	};

export type V0AuthoritativeWriteSnapshot<L extends V0SupportedLang> =
	V0DictionarySnapshotData<L> & {
		authority: "write";
		completeness: "full";
	};

export type V0ReadableDictionarySnapshot<L extends V0SupportedLang> =
	| V0ReadDictionarySnapshot<L>
	| V0AuthoritativeWriteSnapshot<L>;

export type V0ChangePrecondition<L extends V0SupportedLang> =
	| { kind: "snapshotRevisionMatches"; revision: string }
	| { kind: "lemmaExists"; lemmaId: V0DumlingId<"Lemma", L> }
	| { kind: "lemmaMissing"; lemmaId: V0DumlingId<"Lemma", L> }
	| { kind: "surfaceExists"; surfaceId: V0DumlingId<"Surface", L> }
	| { kind: "surfaceMissing"; surfaceId: V0DumlingId<"Surface", L> }
	| { kind: "pendingRefExists"; pendingId: V0PendingLemmaId<L> }
	| { kind: "pendingRefMissing"; pendingId: V0PendingLemmaId<L> };

export type V0PlannedChangeOp<L extends V0SupportedLang> =
	| {
			type: "createLemma";
			entry: V0LemmaEntry<L>;
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "patchLemma";
			lemmaId: V0DumlingId<"Lemma", L>;
			ops: V0LemmaEntryPatchOp<L>[];
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "deleteLemma";
			id: V0DumlingId<"Lemma", L>;
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "createSurface";
			entry: V0SurfaceEntry<L>;
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "patchSurface";
			surfaceId: V0DumlingId<"Surface", L>;
			ops: V0SurfaceEntryPatchOp<L>[];
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "deleteSurface";
			id: V0DumlingId<"Surface", L>;
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "createPendingRef";
			ref: V0PendingLemmaRef<L>;
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "deletePendingRef";
			pendingId: V0PendingLemmaId<L>;
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "createPendingRelation";
			relation: V0PendingLemmaRelation<L>;
			preconditions?: V0ChangePrecondition<L>[];
	  }
	| {
			type: "deletePendingRelation";
			relation: V0PendingLemmaRelation<L>;
			preconditions?: V0ChangePrecondition<L>[];
	  };

export type V0NewLemmaPayload<L extends V0SupportedLang> = {
	lemma: V0Lemma<L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type V0OwnedSurfacePayload<L extends V0SupportedLang> = {
	surface: V0Surface<L>;
	ownerLemmaId: V0DumlingId<"Lemma", L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type V0IntentRelationTarget<L extends V0SupportedLang> =
	| { kind: "existing"; lemmaId: V0DumlingId<"Lemma", L> }
	| { kind: "pending"; ref: V0PendingLemmaRefInput<L> };

export type V0MutationIntentV1<L extends V0SupportedLang> =
	| {
			version: "v1";
			kind: "appendLemmaAttestation";
			lemmaId: V0DumlingId<"Lemma", L>;
			attestation: string;
	  }
	| {
			version: "v1";
			kind: "insertLemma";
			entry: V0NewLemmaPayload<L>;
			ownedSurfaces?: V0OwnedSurfacePayload<L>[];
			initialRelations?: Array<
				| {
						relationFamily: "lexical";
						relation: V0LexicalRelation;
						target: V0IntentRelationTarget<L>;
				  }
				| {
						relationFamily: "morphological";
						relation: V0MorphologicalRelation;
						target: V0IntentRelationTarget<L>;
				  }
			>;
	  }
	| {
			version: "v1";
			kind: "resolvePendingLemma";
			pendingId: V0PendingLemmaId<L>;
			lemmaId: V0DumlingId<"Lemma", L>;
	  }
	| {
			version: "v1";
			kind: "upsertOwnedSurface";
			entry: V0OwnedSurfacePayload<L>;
	  }
	| {
			version: "v1-extension";
			namespace: string;
			kind: string;
			payload: unknown;
	  };

export type V0LemmaRelationTarget<L extends V0SupportedLang> =
	| { kind: "existing"; lemmaId: V0DumlingId<"Lemma", L> }
	| { kind: "pending"; ref: V0PendingLemmaRefInput<L> };

export type V0LemmaEntryPatchOp<L extends V0SupportedLang> =
	| { op: "addTranslation"; value: string }
	| { op: "removeTranslation"; value: string }
	| { op: "addAttestation"; value: string }
	| { op: "removeAttestation"; value: string }
	| { op: "setNotes"; value: string }
	| {
			op: "addLexicalRelation";
			relation: V0LexicalRelation;
			target: V0LemmaRelationTarget<L>;
	  }
	| {
			op: "removeLexicalRelation";
			relation: V0LexicalRelation;
			target: V0LemmaRelationTarget<L>;
	  }
	| {
			op: "addMorphologicalRelation";
			relation: V0MorphologicalRelation;
			target: V0LemmaRelationTarget<L>;
	  }
	| {
			op: "removeMorphologicalRelation";
			relation: V0MorphologicalRelation;
			target: V0LemmaRelationTarget<L>;
	  };

export type V0SurfaceEntryPatchOp<_L extends V0SupportedLang> =
	| { op: "addTranslation"; value: string }
	| { op: "removeTranslation"; value: string }
	| { op: "addAttestation"; value: string }
	| { op: "removeAttestation"; value: string }
	| { op: "setNotes"; value: string };

export type V0Dumdict<L extends V0SupportedLang> = {
	readonly language: L;
	exportAuthoritativeSnapshot(
		revision: string,
	): V0DumdictResult<V0AuthoritativeWriteSnapshot<L>>;
	lookupBySurface(surface: string): V0DumdictResult<V0LookupResult<L>>;
	lookupLemmasBySurface(
		surface: string,
	): V0DumdictResult<Record<V0DumlingId<"Lemma", L>, V0LemmaEntry<L>>>;
	getLemmaEntry(id: V0DumlingId<"Lemma", L>): V0DumdictResult<V0LemmaEntry<L>>;
	getSurfaceEntry(
		id: V0DumlingId<"Surface", L>,
	): V0DumdictResult<V0SurfaceEntry<L>>;
	getOwnedSurfaceEntries(
		lemmaId: V0DumlingId<"Lemma", L>,
	): V0DumdictResult<Record<V0DumlingId<"Surface", L>, V0SurfaceEntry<L>>>;
	getPendingLemmaRef(
		pendingId: V0PendingLemmaId<L>,
	): V0DumdictResult<V0PendingLemmaRef<L>>;
	listPendingLemmaRefs(): V0DumdictResult<
		Record<V0PendingLemmaId<L>, V0PendingLemmaRef<L>>
	>;
	listPendingRelationsForLemma(
		lemmaId: V0DumlingId<"Lemma", L>,
	): V0DumdictResult<V0PendingLemmaRelation<L>[]>;
	upsertLemmaEntry(entry: V0LemmaEntry<L>): V0DumdictResult<V0LemmaEntry<L>>;
	upsertSurfaceEntry(entry: V0SurfaceEntry<L>): V0DumdictResult<V0SurfaceEntry<L>>;
	patchLemmaEntry(
		id: V0DumlingId<"Lemma", L>,
		ops: V0LemmaEntryPatchOp<L> | V0LemmaEntryPatchOp<L>[],
	): V0DumdictResult<V0LemmaEntry<L>>;
	patchSurfaceEntry(
		id: V0DumlingId<"Surface", L>,
		ops: V0SurfaceEntryPatchOp<L> | V0SurfaceEntryPatchOp<L>[],
	): V0DumdictResult<V0SurfaceEntry<L>>;
	removePendingRelation(edge: V0PendingLemmaRelation<L>): V0DumdictResult<void>;
	resolvePendingLemma(
		pendingId: V0PendingLemmaId<L>,
		lemmaId: V0DumlingId<"Lemma", L>,
	): V0DumdictResult<V0LemmaEntry<L>>;
	deleteLemmaEntry(id: V0DumlingId<"Lemma", L>): V0DumdictResult<void>;
	deleteSurfaceEntry(id: V0DumlingId<"Surface", L>): V0DumdictResult<void>;
};
