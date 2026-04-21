import {
	getInverseLexicalRelation,
	getReprForLexicalRelation,
	V0LexicalRelation as LexicalRelationSchema,
	type V0LexicalRelation as LexicalRelationShape,
} from "./lexical";
import {
	getInverseMorphologicalRelation,
	getReprForMorphologicalRelation,
	V0MorphologicalRelation as MorphologicalRelationSchema,
	type V0MorphologicalRelation as MorphologicalRelationShape,
} from "./morphological";
import {
	V0LexicalRelationsSchema as LexicalRelationsSchemaInternal,
	type V0LexicalRelations as LexicalRelationsShape,
	V0MorphologicalRelationsSchema as MorphologicalRelationsSchemaInternal,
	type V0MorphologicalRelations as MorphologicalRelationsShape,
	V0RelationTargetDumlingIdsSchema as RelationTargetDumlingIdsSchemaInternal,
	type V0RelationTargetDumlingIds as RelationTargetDumlingIdsShape,
} from "./relation";

export {
	getInverseLexicalRelation,
	getReprForLexicalRelation,
} from "./lexical";

export {
	getInverseMorphologicalRelation,
	getReprForMorphologicalRelation,
} from "./morphological";

export const V0LexicalRelation = LexicalRelationSchema.enum;
export const V0MorphologicalRelation = MorphologicalRelationSchema.enum;
export const V0RelationTargetDumlingIdsSchema =
	RelationTargetDumlingIdsSchemaInternal;
export const V0LexicalRelationsSchema = LexicalRelationsSchemaInternal;
export const V0MorphologicalRelationsSchema =
	MorphologicalRelationsSchemaInternal;

export const V0Relations = {
	Lexical: {
		enum: V0LexicalRelation,
		getInverse: getInverseLexicalRelation,
		getRepr: getReprForLexicalRelation,
		schema: V0LexicalRelationsSchema,
	},
	Morphological: {
		enum: V0MorphologicalRelation,
		getInverse: getInverseMorphologicalRelation,
		getRepr: getReprForMorphologicalRelation,
		schema: V0MorphologicalRelationsSchema,
	},
} as const;

export declare namespace V0Relations {
	export type V0LexicalRelation = LexicalRelationShape;
	export type V0MorphologicalRelation = MorphologicalRelationShape;
	export type V0TargetDumlingIds = RelationTargetDumlingIdsShape;
	export type V0LexicalRelations = LexicalRelationsShape;
	export type V0MorphologicalRelations = MorphologicalRelationsShape;
}
