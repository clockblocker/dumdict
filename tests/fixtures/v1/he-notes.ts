import type { Lemma } from "../../../src/v1";
import { makeDumlingIdFor } from "../../../src/v1";
import type { SerializedDictionaryNote } from "../../../src/v1/testing/serialized-note";

export const hebrewKatavLemma = {
	canonicalLemma: "כתב",
	inherentFeatures: {
		hebBinyan: "PAAL",
	},
	language: "he",
	lemmaKind: "Lexeme",
	lemmaSubKind: "VERB",
	meaningInEmojis: "write",
} satisfies Lemma<"he", "Lexeme", "VERB">;

export const hebrewKatavLemmaId = makeDumlingIdFor("he", hebrewKatavLemma);

export const heSerializedNotes = [
	{
		lemmaEntry: {
			id: hebrewKatavLemmaId,
			lemma: hebrewKatavLemma,
			lexicalRelations: {},
			morphologicalRelations: {},
			attestedTranslations: ["write"],
			attestations: ["הוא כתב מכתב."],
			notes: "Write a text or letter.",
		},
		ownedSurfaceEntries: [],
		pendingRelations: [],
	},
] satisfies SerializedDictionaryNote<"he">[];
