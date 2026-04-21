import type { StoredLemmaSensesSlice } from "../storage";
import type { SupportedLanguage } from "../dumling";
import type { FindStoredLemmaSensesResult } from "../public";

export function lookupStoredLemmaSenses<L extends SupportedLanguage>(
	slice: StoredLemmaSensesSlice<L>,
): FindStoredLemmaSensesResult<L> {
	return {
		revision: slice.revision,
		candidates: slice.candidates.map(({ entry, relationNotes }) => ({
			lemmaId: entry.id,
			note: {
				lemma: entry.lemma,
				attestedTranslations: entry.attestedTranslations,
				attestations: entry.attestations,
				notes: entry.notes,
				relations: relationNotes,
			},
		})),
	};
}
