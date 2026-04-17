import type { ResolvedSurface, UnresolvedSurface } from "dumling";
import {
	hebrewKatavLemma,
	hebrewShanaLemma,
	hebrewUsAbbreviationLemma,
} from "./lemmas";

// Attestation: "הם [כתבו] מכתב."
export const hebrewKatvuResolvedInflectionSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	inflectionalFeatures: {
		number: "Plur",
		person: "3",
		tense: "Past",
	},
	language: "Hebrew",
	normalizedFullSurface: "כתבו",
	surfaceKind: "Inflection",
	lemma: hebrewKatavLemma,
} satisfies ResolvedSurface<
	"Hebrew",
	"Standard",
	"Inflection",
	"Lexeme",
	"VERB"
>;

// Attestation: "הם [כתבו] מכתב."
export const hebrewKatvuUnresolvedInflectionSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	inflectionalFeatures: {
		number: "Plur",
		person: "3",
		tense: "Past",
	},
	language: "Hebrew",
	normalizedFullSurface: "כתבו",
	surfaceKind: "Inflection",
	lemma: {
		canonicalLemma: "כתב",
	},
} satisfies UnresolvedSurface<
	"Hebrew",
	"Standard",
	"Inflection",
	"Lexeme",
	"VERB"
>;

// Attestation: "עוד [שנה] עברה."
export const hebrewShanaResolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "NOUN",
	},
	language: "Hebrew",
	normalizedFullSurface: "שנה",
	surfaceKind: "Lemma",
	lemma: hebrewShanaLemma,
} satisfies ResolvedSurface<"Hebrew", "Standard", "Lemma", "Lexeme", "NOUN">;

// Attestation: "[ארה״ב] הודיעה על צעד חדש."
export const hebrewUsAbbreviationResolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "PROPN",
	},
	language: "Hebrew",
	normalizedFullSurface: "ארה״ב",
	surfaceKind: "Lemma",
	lemma: hebrewUsAbbreviationLemma,
} satisfies ResolvedSurface<"Hebrew", "Standard", "Lemma", "Lexeme", "PROPN">;
