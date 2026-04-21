import type { Lemma } from "../../../src";

// Attestation: "They [walk] home together."
export const englishWalkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "en",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	lemmaSubKind: "VERB",
} satisfies Lemma<"en", "Lexeme", "VERB">;

// Attestation: "Mark gave [up] on it."
export const englishGiveUpLemma = {
	canonicalLemma: "give up",
	inherentFeatures: {
		phrasal: "Yes",
	},
	language: "en",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🙅",
	lemmaSubKind: "VERB",
} satisfies Lemma<"en", "Lexeme", "VERB">;
