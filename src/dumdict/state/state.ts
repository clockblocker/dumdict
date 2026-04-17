import type { DumlingId, SupportedLang } from "dumling";
import type {
	LemmaEntry,
	PendingLemmaId,
	PendingLemmaRef,
	PendingLemmaRelation,
	SurfaceEntry,
} from "../public";

export type InternalState<L extends SupportedLang> = {
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

export function makeEmptyState<L extends SupportedLang>(): InternalState<L> {
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
