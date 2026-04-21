import type { V0SupportedLang } from "../../dumling-compat";
import { makePendingRelationKey } from "../domain/pending";
import type { V0PendingLemmaRef, V0PendingLemmaRelation } from "../public";
import { clonePendingLemmaRef } from "./clone";
import type { V0InternalState } from "./state";

export function sortPendingRelations<L extends V0SupportedLang>(
	relations: Iterable<V0PendingLemmaRelation<L>>,
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

export function addPendingRelationEdge<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	ref: V0PendingLemmaRef<L>,
	edge: V0PendingLemmaRelation<L>,
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

export function removePendingRelationEdge<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	edge: V0PendingLemmaRelation<L>,
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
