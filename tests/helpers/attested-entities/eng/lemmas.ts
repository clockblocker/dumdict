import type { Lemma } from "../../../../src/dumling-compat";

// Attestation: "They [walk] home together."
export const englishWalkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

// Attestation: "Mark gave [up] on it."
export const englishGiveUpLemma = {
	canonicalLemma: "give up",
	inherentFeatures: {
		phrasal: "Yes",
	},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🙅",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;
