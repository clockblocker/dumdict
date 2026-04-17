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
