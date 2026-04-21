import type { V0Surface } from "../../../../src/v0/dumling-compat";
import { germanHausLemma } from "./lemmas";

// Attestation: "Das [Haus] steht leer."
export const germanHausResolvedLemmaSurface = {
	language: "de",
	normalizedFullSurface: "Haus",
	surfaceKind: "Lemma",
	lemma: germanHausLemma,
} satisfies V0Surface<"de", "Lemma", "Lexeme", "NOUN">;
