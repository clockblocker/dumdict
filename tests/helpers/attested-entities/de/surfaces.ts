import type { ResolvedSurface } from "dumling";
import { germanHausLemma } from "./lemmas";

// Attestation: "Das [Haus] steht leer."
export const germanHausResolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "NOUN",
	},
	language: "German",
	normalizedFullSurface: "Haus",
	surfaceKind: "Lemma",
	lemma: germanHausLemma,
} satisfies ResolvedSurface<"German", "Standard", "Lemma", "Lexeme", "NOUN">;
