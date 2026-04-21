import type { V0DumlingId, V0SupportedLang } from "../../dumling-compat";
import type {
	V0LemmaEntry,
	V0PendingLemmaId,
	V0PendingLemmaRef,
	V0PendingLemmaRelation,
	V0SurfaceEntry,
} from "../public";

export type V0InternalState<L extends V0SupportedLang> = {
	lemmasById: Map<V0DumlingId<"Lemma", L>, V0LemmaEntry<L>>;
	surfacesById: Map<V0DumlingId<"Surface", L>, V0SurfaceEntry<L>>;
	surfaceIdsByOwnerLemmaId: Map<
		V0DumlingId<"Lemma", L>,
		Set<V0DumlingId<"Surface", L>>
	>;
	lemmaLookupIndex: Map<string, Set<V0DumlingId<"Lemma", L>>>;
	surfaceLookupIndex: Map<string, Set<V0DumlingId<"Surface", L>>>;
	pendingLemmaRefsById: Map<V0PendingLemmaId<L>, V0PendingLemmaRef<L>>;
	pendingRelationsBySourceLemmaId: Map<
		V0DumlingId<"Lemma", L>,
		Map<string, V0PendingLemmaRelation<L>>
	>;
	pendingRelationsByPendingId: Map<
		V0PendingLemmaId<L>,
		Map<string, V0PendingLemmaRelation<L>>
	>;
};

export function makeEmptyState<L extends V0SupportedLang>(): V0InternalState<L> {
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
