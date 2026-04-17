import type { DumlingId, SupportedLang } from "../../dumling-compat";
import { makeLookupKey } from "../domain/collections";
import { getLemmaCanonicalLemma } from "../domain/runtime-accessors";
import type { LemmaEntry } from "../public";
import { cloneLemmaEntry } from "./clone";
import { addLookupValue, removeLookupValue } from "./indexes";
import type { InternalState } from "./state";

export function replaceLemmaEntryDirect<L extends SupportedLang>(
	state: InternalState<L>,
	entry: LemmaEntry<L>,
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

export function deleteLemmaEntryDirect<L extends SupportedLang>(
	state: InternalState<L>,
	lemmaId: DumlingId<"Lemma", L>,
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

export function getMutableLemmaEntry<L extends SupportedLang>(
	state: InternalState<L>,
	lemmaId: DumlingId<"Lemma", L>,
) {
	return state.lemmasById.get(lemmaId);
}
