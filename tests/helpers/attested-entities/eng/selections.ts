import type { V0Selection } from "../../../../src/v0/dumling-compat";
import {
	englishGiveUpTypoUnresolvedInflectionSurface,
	englishWalkResolvedLemmaSurface,
	englishWalkUnresolvedInflectionSurface,
} from "./surfaces";

// Attestation: "They [walk] home together."
export const englishWalkStandardFullSelection = {
	language: "en",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "walk",
	spellingRelation: "Canonical",
	surface: englishWalkUnresolvedInflectionSurface,
} satisfies V0Selection<"en", "Standard", "Inflection", "Lexeme", "VERB">;

// Attestation: "They [walk] home together."
export const englishWalkResolvedLemmaSelection = {
	language: "en",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "walk",
	spellingRelation: "Canonical",
	surface: englishWalkResolvedLemmaSurface,
} satisfies V0Selection<"en", "Standard", "Lemma", "Lexeme", "VERB">;

// Attestation: "Mark gvae [up] on it."
export const englishGiveUpTypoPartialUpSelection = {
	language: "en",
	orthographicStatus: "Typo",
	selectionCoverage: "Partial",
	spelledSelection: "up",
	spellingRelation: "Canonical",
	surface: englishGiveUpTypoUnresolvedInflectionSurface,
} satisfies V0Selection<"en", "Typo", "Inflection", "Lexeme", "VERB">;

// Attestation: "Mark [gvae] up on it."
export const englishGiveUpTypoPartialGvaeSelection = {
	language: "en",
	orthographicStatus: "Typo",
	selectionCoverage: "Partial",
	spelledSelection: "gvae",
	spellingRelation: "Variant",
	surface: englishGiveUpTypoUnresolvedInflectionSurface,
} satisfies V0Selection<"en", "Typo", "Inflection", "Lexeme", "VERB">;
