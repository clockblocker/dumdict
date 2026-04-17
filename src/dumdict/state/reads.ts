import type { DumlingId, SupportedLang } from "dumling";
import { sortIds, toSortedRecord } from "../domain/collections";
import type { LemmaEntry, SurfaceEntry } from "../public";
import { cloneLemmaEntry, cloneSurfaceEntry } from "./clone";
import type { InternalState } from "./state";

export function collectLemmaRecord<L extends SupportedLang>(
	state: InternalState<L>,
	lemmaIds: Iterable<DumlingId<"Lemma", L>>,
) {
	const entries: [DumlingId<"Lemma", L>, LemmaEntry<L>][] = [];
	for (const lemmaId of sortIds([...lemmaIds])) {
		const entry = state.lemmasById.get(lemmaId);
		if (!entry) {
			continue;
		}

		entries.push([lemmaId, cloneLemmaEntry(entry)]);
	}

	return toSortedRecord(entries);
}

export function collectSurfaceRecord<L extends SupportedLang>(
	state: InternalState<L>,
	surfaceIds: Iterable<DumlingId<"Surface", L>>,
) {
	const entries: [DumlingId<"Surface", L>, SurfaceEntry<L>][] = [];
	for (const surfaceId of sortIds([...surfaceIds])) {
		const entry = state.surfacesById.get(surfaceId);
		if (!entry) {
			continue;
		}

		entries.push([surfaceId, cloneSurfaceEntry(entry)]);
	}

	return toSortedRecord(entries);
}
