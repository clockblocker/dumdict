import {
	getInverseLexicalRelation,
	getReprForLexicalRelation,
	LexicalRelation as LexicalRelationSchema,
	type LexicalRelation as LexicalRelationShape,
} from "./lexical";
import {
	getInverseMorphologicalRelation,
	getReprForMorphologicalRelation,
	MorphologicalRelation as MorphologicalRelationSchema,
	type MorphologicalRelation as MorphologicalRelationShape,
} from "./morphological";
import {
	LexicalRelationsSchema as LexicalRelationsSchemaInternal,
	type LexicalRelations as LexicalRelationsShape,
	MorphologicalRelationsSchema as MorphologicalRelationsSchemaInternal,
	type MorphologicalRelations as MorphologicalRelationsShape,
	RelationTargetDumlingIdsSchema as RelationTargetDumlingIdsSchemaInternal,
	type RelationTargetDumlingIds as RelationTargetDumlingIdsShape,
} from "./relation";

export {
	getInverseLexicalRelation,
	getReprForLexicalRelation,
} from "./lexical";

export {
	getInverseMorphologicalRelation,
	getReprForMorphologicalRelation,
} from "./morphological";

export const LexicalRelation = LexicalRelationSchema.enum;
export const MorphologicalRelation = MorphologicalRelationSchema.enum;
export const RelationTargetDumlingIdsSchema =
	RelationTargetDumlingIdsSchemaInternal;
export const LexicalRelationsSchema = LexicalRelationsSchemaInternal;
export const MorphologicalRelationsSchema =
	MorphologicalRelationsSchemaInternal;

export const Relations = {
	Lexical: {
		enum: LexicalRelation,
		getInverse: getInverseLexicalRelation,
		getRepr: getReprForLexicalRelation,
		schema: LexicalRelationsSchema,
	},
	Morphological: {
		enum: MorphologicalRelation,
		getInverse: getInverseMorphologicalRelation,
		getRepr: getReprForMorphologicalRelation,
		schema: MorphologicalRelationsSchema,
	},
} as const;

export declare namespace Relations {
	export type LexicalRelation = LexicalRelationShape;
	export type MorphologicalRelation = MorphologicalRelationShape;
	export type TargetDumlingIds = RelationTargetDumlingIdsShape;
	export type LexicalRelations = LexicalRelationsShape;
	export type MorphologicalRelations = MorphologicalRelationsShape;
}
