import type { Surface } from "../../../../src/dumling-compat";
import { englishGiveUpLemma, englishWalkLemma } from "./lemmas";

// Attestation: "They [walk] home together."
export const englishWalkResolvedInflectionSurface = {
	inflectionalFeatures: {
		tense: "Pres",
		verbForm: "Fin",
	},
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Inflection",
	lemma: englishWalkLemma,
} satisfies Surface<"English", "Inflection", "Lexeme", "VERB">;

// Attestation: "They [walk] home together."
export const englishWalkUnresolvedInflectionSurface = {
	inflectionalFeatures: {
		tense: "Pres",
		verbForm: "Fin",
	},
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Inflection",
	lemma: englishWalkLemma,
} satisfies Surface<"English", "Inflection", "Lexeme", "VERB">;

// Attestation: "They [walk] home together."
export const englishWalkResolvedLemmaSurface = {
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Lemma",
	lemma: englishWalkLemma,
} satisfies Surface<"English", "Lemma", "Lexeme", "VERB">;

// Attestation: "They [walk] home together."
export const englishWalkUnresolvedLemmaSurface = {
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Lemma",
	lemma: englishWalkLemma,
} satisfies Surface<"English", "Lemma", "Lexeme", "VERB">;

// Attestation: "Mark gvae [up] on it."
export const englishGiveUpTypoUnresolvedInflectionSurface = {
	inflectionalFeatures: {
		tense: "Past",
		verbForm: "Fin",
	},
	language: "English",
	normalizedFullSurface: "gave up",
	surfaceKind: "Inflection",
	lemma: englishGiveUpLemma,
} satisfies Surface<"English", "Inflection", "Lexeme", "VERB">;
