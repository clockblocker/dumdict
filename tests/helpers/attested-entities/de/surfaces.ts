import type { Surface } from "dumling";
import { germanHausLemma } from "./lemmas";

// Attestation: "Das [Haus] steht leer."
export const germanHausResolvedLemmaSurface = {
	language: "German",
	normalizedFullSurface: "Haus",
	surfaceKind: "Lemma",
	lemma: germanHausLemma,
} satisfies Surface<"German", "Lemma", "Lexeme", "NOUN">;
