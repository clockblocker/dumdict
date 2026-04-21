import type {
	LemmaKindFor,
	LemmaSubKindFor,
	SupportedLanguage,
} from "../dumling";
import type {
	LexicalRelation,
	MorphologicalRelation,
	RelationFamily,
} from "./relations";
import type { DumlingId } from "../dumling";

export type PendingLemmaId<L extends SupportedLanguage> = string & {
	readonly __pendingLemmaIdBrand?: unique symbol;
	readonly __language?: L;
};

export type PendingLemmaIdentity<L extends SupportedLanguage> = {
	language: L;
	canonicalLemma: string;
	lemmaKind: LemmaKindFor<L>;
	lemmaSubKind: LemmaSubKindFor<L, LemmaKindFor<L>>;
};

export type PendingLemmaRef<L extends SupportedLanguage> = PendingLemmaIdentity<L> & {
	pendingId: PendingLemmaId<L>;
};

export type PendingLemmaRelation<L extends SupportedLanguage> = {
	sourceLemmaId: DumlingId<"Lemma", L>;
	relationFamily: RelationFamily;
	relation: LexicalRelation | MorphologicalRelation;
	targetPendingId: PendingLemmaId<L>;
};

