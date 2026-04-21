import type { V0SupportedLang } from "../../dumling-compat";
import type {
	V0PendingLemmaId,
	V0PendingLemmaRef,
	V0PendingLemmaRefInput,
	V0PendingLemmaRelation,
} from "../public";

export function derivePendingLemmaId<L extends V0SupportedLang>(
	language: L,
	input: V0PendingLemmaRefInput<L>,
): V0PendingLemmaId<L> {
	return [
		"pending",
		"v1",
		encodeURIComponent(language),
		encodeURIComponent(input.canonicalLemma),
		encodeURIComponent(input.lemmaKind),
		encodeURIComponent(input.lemmaSubKind),
	].join(":") as V0PendingLemmaId<L>;
}

export function makePendingLemmaRef<L extends V0SupportedLang>(
	language: L,
	input: V0PendingLemmaRefInput<L>,
): V0PendingLemmaRef<L> {
	return {
		pendingId: derivePendingLemmaId(language, input),
		language,
		canonicalLemma: input.canonicalLemma,
		lemmaKind: input.lemmaKind,
		lemmaSubKind: input.lemmaSubKind,
	};
}

export function makePendingRelationKey<L extends V0SupportedLang>(
	edge: V0PendingLemmaRelation<L>,
) {
	return [
		edge.sourceLemmaId,
		edge.relationFamily,
		edge.relation,
		edge.targetPendingId,
	].join("\u0000");
}
