import type { V0Lemma } from "../../../src/v0/dumling-compat";

// Attestation: "הוא [כתב] מכתב."
export const hebrewKatavLemma = {
	canonicalLemma: "כתב",
	inherentFeatures: {
		hebBinyan: "PAAL",
	},
	language: "he",
	lemmaKind: "Lexeme",
	meaningInEmojis: "✍️",
	lemmaSubKind: "VERB",
} satisfies V0Lemma<"he", "Lexeme", "VERB">;

// Attestation: "עוד [שנה] עברה."
export const hebrewShanaLemma = {
	canonicalLemma: "שנה",
	inherentFeatures: {
		gender: "Fem",
	},
	language: "he",
	lemmaKind: "Lexeme",
	meaningInEmojis: "📅",
	lemmaSubKind: "NOUN",
} satisfies V0Lemma<"he", "Lexeme", "NOUN">;

// Attestation: "[ארה״ב] הודיעה על צעד חדש."
// UD-style: multi-word abbreviations keep the abbreviated form as canonicalLemma and mark Abbr=Yes.
// See https://universaldependencies.org/u/overview/morphology.html
export const hebrewUsAbbreviationLemma = {
	canonicalLemma: "ארה״ב",
	inherentFeatures: {
		abbr: "Yes",
	},
	language: "he",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🇺🇸",
	lemmaSubKind: "PROPN",
} satisfies V0Lemma<"he", "Lexeme", "PROPN">;
