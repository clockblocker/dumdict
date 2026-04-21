import type { V0DumlingId, V0SupportedLang } from "../../dumling-compat";
import { sortIds, toSortedRecord } from "../domain/collections";
import type { V0LemmaEntry, V0SurfaceEntry } from "../public";
import { cloneLemmaEntry, cloneSurfaceEntry } from "./clone";
import type { V0InternalState } from "./state";

export function collectLemmaRecord<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	lemmaIds: Iterable<V0DumlingId<"Lemma", L>>,
) {
	const entries: [V0DumlingId<"Lemma", L>, V0LemmaEntry<L>][] = [];
	for (const lemmaId of sortIds([...lemmaIds])) {
		const entry = state.lemmasById.get(lemmaId);
		if (!entry) {
			continue;
		}

		entries.push([lemmaId, cloneLemmaEntry(entry)]);
	}

	return toSortedRecord(entries);
}

export function collectSurfaceRecord<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	surfaceIds: Iterable<V0DumlingId<"Surface", L>>,
) {
	const entries: [V0DumlingId<"Surface", L>, V0SurfaceEntry<L>][] = [];
	for (const surfaceId of sortIds([...surfaceIds])) {
		const entry = state.surfacesById.get(surfaceId);
		if (!entry) {
			continue;
		}

		entries.push([surfaceId, cloneSurfaceEntry(entry)]);
	}

	return toSortedRecord(entries);
}
