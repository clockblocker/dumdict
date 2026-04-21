import { type V0DumlingId, inspectDumlingId } from "../../dumling-compat";
import { z } from "zod/v3";
import type { V0LexicalRelation } from "./lexical";
import type { V0MorphologicalRelation } from "./morphological";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

function isLemmaDumlingId(value: string): value is V0DumlingId<"Lemma"> {
	return inspectDumlingId(value)?.kind === "Lemma";
}

const LemmaDumlingIdSchema = z.string().superRefine((value, ctx) => {
	if (!isLemmaDumlingId(value)) {
		const inspectedId = inspectDumlingId(value);
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: inspectedId
				? "Expected lemma Dumling ID"
				: "Malformed relation Dumling ID",
		});
	}
}) as unknown as z.ZodType<V0DumlingId<"Lemma">>;

export const V0RelationTargetDumlingIdsSchema = z.array(
	LemmaDumlingIdSchema,
) as unknown as z.ZodType<V0RelationTargetDumlingIds>;

export type V0RelationTargetDumlingIds = V0DumlingId<"Lemma">[];

export type V0LexicalRelations = Prettify<
	Partial<Record<V0LexicalRelation, V0RelationTargetDumlingIds>>
>;

export type V0MorphologicalRelations = Prettify<
	Partial<Record<V0MorphologicalRelation, V0RelationTargetDumlingIds>>
>;

const lexicalRelationsShape = {
	antonym: V0RelationTargetDumlingIdsSchema.optional(),
	holonym: V0RelationTargetDumlingIdsSchema.optional(),
	hypernym: V0RelationTargetDumlingIdsSchema.optional(),
	hyponym: V0RelationTargetDumlingIdsSchema.optional(),
	meronym: V0RelationTargetDumlingIdsSchema.optional(),
	nearSynonym: V0RelationTargetDumlingIdsSchema.optional(),
	synonym: V0RelationTargetDumlingIdsSchema.optional(),
} satisfies Record<
	V0LexicalRelation,
	z.ZodOptional<typeof V0RelationTargetDumlingIdsSchema>
>;

const morphologicalRelationsShape = {
	consistsOf: V0RelationTargetDumlingIdsSchema.optional(),
	derivedFrom: V0RelationTargetDumlingIdsSchema.optional(),
	sourceFor: V0RelationTargetDumlingIdsSchema.optional(),
	usedIn: V0RelationTargetDumlingIdsSchema.optional(),
} satisfies Record<
	V0MorphologicalRelation,
	z.ZodOptional<typeof V0RelationTargetDumlingIdsSchema>
>;

export const V0LexicalRelationsSchema = z
	.object(lexicalRelationsShape)
	.strict() as unknown as z.ZodType<V0LexicalRelations>;

export const V0MorphologicalRelationsSchema = z
	.object(morphologicalRelationsShape)
	.strict() as unknown as z.ZodType<V0MorphologicalRelations>;
