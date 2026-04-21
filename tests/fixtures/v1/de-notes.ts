import type { Lemma } from "../../../src/v1";
import { makeDumlingIdFor } from "../../../src/v1";
import type { SerializedDictionaryNote } from "../../../src/v1/testing/serialized-note";

export const germanGehenLemma = {
	canonicalLemma: "gehen",
	inherentFeatures: {},
	language: "de",
	lemmaKind: "Lexeme",
	lemmaSubKind: "VERB",
	meaningInEmojis: "walk-as-motion",
} satisfies Lemma<"de", "Lexeme", "VERB">;

export const germanGehenLemmaId = makeDumlingIdFor("de", germanGehenLemma);

export const deSerializedNotes = [
	{
		lemmaEntry: {
			id: germanGehenLemmaId,
			lemma: germanGehenLemma,
			lexicalRelations: {},
			morphologicalRelations: {},
			attestedTranslations: ["go", "walk"],
			attestations: ["Wir gehen nach Hause."],
			notes: "Move on foot or go somewhere.",
		},
		ownedSurfaceEntries: [],
		pendingRelations: [],
	},
] satisfies SerializedDictionaryNote<"de">[];
