import { z } from "zod/v3";

const morphologicalRelations = [
	"consistsOf",
	"derivedFrom",
	"usedIn",
	"sourceFor",
] as const;

export const V0MorphologicalRelation = z.enum(morphologicalRelations);
export type V0MorphologicalRelation = z.infer<typeof V0MorphologicalRelation>;

export const v0MorphologicalRelationKeys = [
	...V0MorphologicalRelation.options,
].sort();

const inverseMorphologicalRelation = {
	consistsOf: "usedIn",
	derivedFrom: "sourceFor",
	sourceFor: "derivedFrom",
	usedIn: "consistsOf",
} as const satisfies Record<V0MorphologicalRelation, V0MorphologicalRelation>;

const reprForMorphologicalRelation = {
	consistsOf: "⊃",
	derivedFrom: "<-",
	sourceFor: "->",
	usedIn: "⊂",
} as const satisfies Record<V0MorphologicalRelation, string>;

export function getInverseMorphologicalRelation(
	morphologicalRelation: V0MorphologicalRelation,
): V0MorphologicalRelation {
	return inverseMorphologicalRelation[morphologicalRelation];
}

export function getReprForMorphologicalRelation(
	morphologicalRelation: V0MorphologicalRelation,
) {
	return reprForMorphologicalRelation[morphologicalRelation];
}
