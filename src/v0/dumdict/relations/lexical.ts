import { z } from "zod/v3";

const lexicalRelations = [
	"synonym",
	"nearSynonym",
	"antonym",
	"hypernym",
	"hyponym",
	"meronym",
	"holonym",
] as const;

export const V0LexicalRelation = z.enum(lexicalRelations);
export type V0LexicalRelation = z.infer<typeof V0LexicalRelation>;

export const v0LexicalRelationKeys = [...V0LexicalRelation.options].sort();

const inverseLexicalRelation = {
	antonym: "antonym",
	holonym: "meronym",
	hypernym: "hyponym",
	hyponym: "hypernym",
	meronym: "holonym",
	nearSynonym: "nearSynonym",
	synonym: "synonym",
} as const satisfies Record<V0LexicalRelation, V0LexicalRelation>;

const reprForLexicalRelation = {
	antonym: "!=",
	holonym: "∋",
	hypernym: "⊃",
	hyponym: "⊂",
	meronym: "∈",
	nearSynonym: "≈",
	synonym: "=",
} as const satisfies Record<V0LexicalRelation, string>;

export function getInverseLexicalRelation(
	lexicalRelation: V0LexicalRelation,
): V0LexicalRelation {
	return inverseLexicalRelation[lexicalRelation];
}

export function getReprForLexicalRelation(lexicalRelation: V0LexicalRelation) {
	return reprForLexicalRelation[lexicalRelation];
}
