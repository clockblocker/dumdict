import type { Selection } from "../../../../src/dumling-compat";
import {
	englishGiveUpTypoUnresolvedInflectionSurface,
	englishWalkResolvedLemmaSurface,
	englishWalkUnresolvedInflectionSurface,
} from "./surfaces";

// Attestation: "They [walk] home together."
export const englishWalkStandardFullSelection = {
	language: "English",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "walk",
	spellingRelation: "Canonical",
	surface: englishWalkUnresolvedInflectionSurface,
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

// Attestation: "They [walk] home together."
export const englishWalkResolvedLemmaSelection = {
	language: "English",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "walk",
	spellingRelation: "Canonical",
	surface: englishWalkResolvedLemmaSurface,
} satisfies Selection<"English", "Standard", "Lemma", "Lexeme", "VERB">;

// Attestation: "Mark gvae [up] on it."
export const englishGiveUpTypoPartialUpSelection = {
	language: "English",
	orthographicStatus: "Typo",
	selectionCoverage: "Partial",
	spelledSelection: "up",
	spellingRelation: "Canonical",
	surface: englishGiveUpTypoUnresolvedInflectionSurface,
} satisfies Selection<"English", "Typo", "Inflection", "Lexeme", "VERB">;

// Attestation: "Mark [gvae] up on it."
export const englishGiveUpTypoPartialGvaeSelection = {
	language: "English",
	orthographicStatus: "Typo",
	selectionCoverage: "Partial",
	spelledSelection: "gvae",
	spellingRelation: "Variant",
	surface: englishGiveUpTypoUnresolvedInflectionSurface,
} satisfies Selection<"English", "Typo", "Inflection", "Lexeme", "VERB">;
