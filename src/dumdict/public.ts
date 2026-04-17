import type {
	DumlingId,
	Lemma,
	ResolvedSurface,
	SupportedLang,
	UniversalLemmaKind,
	UniversalLemmaSubKind,
} from "dumling";
import type { DumdictResult } from "./errors";
import type { LexicalRelation } from "./relations/lexical";
import type { MorphologicalRelation } from "./relations/morphological";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type RelationFamily = "lexical" | "morphological";

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

export type PendingLemmaRefInput<_L extends SupportedLang> = {
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

export type DictionarySnapshotData<L extends SupportedLang> = {
	language: L;
	revision: string;
	lemmas: LemmaEntry<L>[];
	surfaces: SurfaceEntry<L>[];
	pendingRefs: PendingLemmaRef<L>[];
	pendingRelations: PendingLemmaRelation<L>[];
};

export type ReadDictionarySnapshot<L extends SupportedLang> =
	DictionarySnapshotData<L> & {
		authority: "read";
		completeness: "partial" | "full";
	};

export type AuthoritativeWriteSnapshot<L extends SupportedLang> =
	DictionarySnapshotData<L> & {
		authority: "write";
		completeness: "full";
	};

export type ReadableDictionarySnapshot<L extends SupportedLang> =
	| ReadDictionarySnapshot<L>
	| AuthoritativeWriteSnapshot<L>;

export type ChangePrecondition<L extends SupportedLang> =
	| { kind: "snapshotRevisionMatches"; revision: string }
	| { kind: "lemmaExists"; lemmaId: DumlingId<"Lemma", L> }
	| { kind: "lemmaMissing"; lemmaId: DumlingId<"Lemma", L> }
	| { kind: "surfaceExists"; surfaceId: DumlingId<"ResolvedSurface", L> }
	| { kind: "surfaceMissing"; surfaceId: DumlingId<"ResolvedSurface", L> }
	| { kind: "pendingRefExists"; pendingId: PendingLemmaId<L> }
	| { kind: "pendingRefMissing"; pendingId: PendingLemmaId<L> };

export type PlannedChangeOp<L extends SupportedLang> =
	| {
			type: "createLemma";
			entry: LemmaEntry<L>;
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "patchLemma";
			lemmaId: DumlingId<"Lemma", L>;
			ops: LemmaEntryPatchOp<L>[];
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "deleteLemma";
			id: DumlingId<"Lemma", L>;
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "createSurface";
			entry: SurfaceEntry<L>;
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "patchSurface";
			surfaceId: DumlingId<"ResolvedSurface", L>;
			ops: SurfaceEntryPatchOp<L>[];
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "deleteSurface";
			id: DumlingId<"ResolvedSurface", L>;
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "createPendingRef";
			ref: PendingLemmaRef<L>;
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "deletePendingRef";
			pendingId: PendingLemmaId<L>;
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "createPendingRelation";
			relation: PendingLemmaRelation<L>;
			preconditions?: ChangePrecondition<L>[];
	  }
	| {
			type: "deletePendingRelation";
			relation: PendingLemmaRelation<L>;
			preconditions?: ChangePrecondition<L>[];
	  };

export type NewLemmaPayload<L extends SupportedLang> = {
	lemma: Lemma<L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type OwnedSurfacePayload<L extends SupportedLang> = {
	surface: ResolvedSurface<L>;
	ownerLemmaId: DumlingId<"Lemma", L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};

export type IntentRelationTarget<L extends SupportedLang> =
	| { kind: "existing"; lemmaId: DumlingId<"Lemma", L> }
	| { kind: "pending"; ref: PendingLemmaRefInput<L> };

export type MutationIntentV1<L extends SupportedLang> =
	| {
			version: "v1";
			kind: "appendLemmaAttestation";
			lemmaId: DumlingId<"Lemma", L>;
			attestation: string;
	  }
	| {
			version: "v1";
			kind: "insertLemma";
			entry: NewLemmaPayload<L>;
			ownedSurfaces?: OwnedSurfacePayload<L>[];
			initialRelations?: Array<
				| {
						relationFamily: "lexical";
						relation: LexicalRelation;
						target: IntentRelationTarget<L>;
				  }
				| {
						relationFamily: "morphological";
						relation: MorphologicalRelation;
						target: IntentRelationTarget<L>;
				  }
			>;
	  }
	| {
			version: "v1";
			kind: "resolvePendingLemma";
			pendingId: PendingLemmaId<L>;
			lemmaId: DumlingId<"Lemma", L>;
	  }
	| {
			version: "v1";
			kind: "upsertOwnedSurface";
			entry: OwnedSurfacePayload<L>;
	  }
	| {
			version: "v1-extension";
			namespace: string;
			kind: string;
			payload: unknown;
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

export type SurfaceEntryPatchOp<_L extends SupportedLang> =
	| { op: "addTranslation"; value: string }
	| { op: "removeTranslation"; value: string }
	| { op: "addAttestation"; value: string }
	| { op: "removeAttestation"; value: string }
	| { op: "setNotes"; value: string };

export type Dumdict<L extends SupportedLang> = {
	readonly language: L;
	exportAuthoritativeSnapshot(
		revision: string,
	): DumdictResult<AuthoritativeWriteSnapshot<L>>;
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
