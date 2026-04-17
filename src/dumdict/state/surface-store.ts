import type { DumlingId, SupportedLang } from "dumling";
import { makeLookupKey } from "../domain/collections";
import { getSurfaceNormalizedFullSurface } from "../domain/runtime-accessors";
import type { SurfaceEntry } from "../public";
import { cloneSurfaceEntry } from "./clone";
import { addLookupValue, removeLookupValue } from "./indexes";
import type { InternalState } from "./state";

export function replaceSurfaceEntryDirect<L extends SupportedLang>(
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
		state.surfaceIdsByOwnerLemmaId.get(canonicalEntry.ownerLemmaId) ?? new Set();
	ownerBucket.add(canonicalEntry.id);
	state.surfaceIdsByOwnerLemmaId.set(canonicalEntry.ownerLemmaId, ownerBucket);
}

export function deleteSurfaceEntryDirect<L extends SupportedLang>(
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
