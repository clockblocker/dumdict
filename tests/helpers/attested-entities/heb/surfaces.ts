import type { V0Surface } from "../../../../src/v0/dumling-compat";
import {
	hebrewKatavLemma,
	hebrewShanaLemma,
	hebrewUsAbbreviationLemma,
} from "./lemmas";

// Attestation: "הם [כתבו] מכתב."
export const hebrewKatvuResolvedInflectionSurface = {
	inflectionalFeatures: {
		number: "Plur",
		person: "3",
		tense: "Past",
	},
	language: "he",
	normalizedFullSurface: "כתבו",
	surfaceKind: "Inflection",
	lemma: hebrewKatavLemma,
} satisfies V0Surface<"he", "Inflection", "Lexeme", "VERB">;

// Attestation: "הם [כתבו] מכתב."
export const hebrewKatvuUnresolvedInflectionSurface = {
	inflectionalFeatures: {
		number: "Plur",
		person: "3",
		tense: "Past",
	},
	language: "he",
	normalizedFullSurface: "כתבו",
	surfaceKind: "Inflection",
	lemma: hebrewKatavLemma,
} satisfies V0Surface<"he", "Inflection", "Lexeme", "VERB">;

// Attestation: "עוד [שנה] עברה."
export const hebrewShanaResolvedLemmaSurface = {
	language: "he",
	normalizedFullSurface: "שנה",
	surfaceKind: "Lemma",
	lemma: hebrewShanaLemma,
} satisfies V0Surface<"he", "Lemma", "Lexeme", "NOUN">;

// Attestation: "[ארה״ב] הודיעה על צעד חדש."
export const hebrewUsAbbreviationResolvedLemmaSurface = {
	language: "he",
	normalizedFullSurface: "ארה״ב",
	surfaceKind: "Lemma",
	lemma: hebrewUsAbbreviationLemma,
} satisfies V0Surface<"he", "Lemma", "Lexeme", "PROPN">;
