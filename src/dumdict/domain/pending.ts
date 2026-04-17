import type { SupportedLang } from "dumling";
import type {
	PendingLemmaId,
	PendingLemmaRef,
	PendingLemmaRefInput,
	PendingLemmaRelation,
} from "../public";

export function derivePendingLemmaId<L extends SupportedLang>(
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

export function makePendingLemmaRef<L extends SupportedLang>(
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

export function makePendingRelationKey<L extends SupportedLang>(
	edge: PendingLemmaRelation<L>,
) {
	return [
		edge.sourceLemmaId,
		edge.relationFamily,
		edge.relation,
		edge.targetPendingId,
	].join("\u0000");
}
