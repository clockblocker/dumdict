import type { V0DumlingId, V0SupportedLang } from "../../dumling-compat";
import { makeLookupKey } from "../domain/collections";
import { getLemmaCanonicalLemma } from "../domain/runtime-accessors";
import type { V0LemmaEntry } from "../public";
import { cloneLemmaEntry } from "./clone";
import { addLookupValue, removeLookupValue } from "./indexes";
import type { V0InternalState } from "./state";

export function replaceLemmaEntryDirect<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	entry: V0LemmaEntry<L>,
) {
	const canonicalEntry = cloneLemmaEntry(entry);
	const existing = state.lemmasById.get(canonicalEntry.id);
	if (existing) {
		removeLookupValue(
			state.lemmaLookupIndex,
			makeLookupKey(getLemmaCanonicalLemma(existing.lemma)),
			existing.id,
		);
	}

	state.lemmasById.set(canonicalEntry.id, canonicalEntry);
	addLookupValue(
		state.lemmaLookupIndex,
		makeLookupKey(getLemmaCanonicalLemma(canonicalEntry.lemma)),
		canonicalEntry.id,
	);
}

export function deleteLemmaEntryDirect<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	lemmaId: V0DumlingId<"Lemma", L>,
) {
	const existing = state.lemmasById.get(lemmaId);
	if (!existing) {
		return;
	}

	state.lemmasById.delete(lemmaId);
	removeLookupValue(
		state.lemmaLookupIndex,
		makeLookupKey(getLemmaCanonicalLemma(existing.lemma)),
		lemmaId,
	);
}

export function getMutableLemmaEntry<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	lemmaId: V0DumlingId<"Lemma", L>,
) {
	return state.lemmasById.get(lemmaId);
}
