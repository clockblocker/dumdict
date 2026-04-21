import type { Lemma } from "../../../src/v1";
import { makeDumlingIdFor } from "../../../src/v1";
import type { SerializedDictionaryNote } from "../../../src/v1/testing/serialized-note";

export const englishWalkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "en",
	lemmaKind: "Lexeme",
	lemmaSubKind: "VERB",
	meaningInEmojis: "walk-as-motion",
} satisfies Lemma<"en", "Lexeme", "VERB">;

export const englishWalkLemmaId = makeDumlingIdFor("en", englishWalkLemma);

export const enSerializedNotes = [
	{
		lemmaEntry: {
			id: englishWalkLemmaId,
			lemma: englishWalkLemma,
			lexicalRelations: {},
			morphologicalRelations: {},
			attestedTranslations: ["walk"],
			attestations: ["They walk home together."],
			notes: "Move at a regular pace by lifting and setting down each foot.",
		},
		ownedSurfaceEntries: [],
		pendingRelations: [],
	},
] satisfies SerializedDictionaryNote<"en">[];
