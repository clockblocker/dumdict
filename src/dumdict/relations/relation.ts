import { type DumlingId, dumling } from "dumling";
import { z } from "zod/v3";
import type { LexicalRelation } from "./lexical";
import type { MorphologicalRelation } from "./morphological";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

const lemmaIdApis = [
	dumling.idCodec.English,
	dumling.idCodec.German,
	dumling.idCodec.Hebrew,
] as const;

function isLemmaDumlingId(value: string): value is DumlingId<"Lemma"> {
	for (const api of lemmaIdApis) {
		if (api.tryToDecodeAs("Lemma", value).isOk()) {
			return true;
		}
	}

	return false;
}

const LemmaDumlingIdSchema = z.string().superRefine((value, ctx) => {
	if (!isLemmaDumlingId(value)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: value.startsWith("ling:v1:")
				? "Expected lemma Dumling ID"
				: "Malformed relation Dumling ID",
		});
	}
}) as unknown as z.ZodType<DumlingId<"Lemma">>;

export const RelationTargetDumlingIdsSchema = z.array(
	LemmaDumlingIdSchema,
) as unknown as z.ZodType<RelationTargetDumlingIds>;

export type RelationTargetDumlingIds = DumlingId<"Lemma">[];

export type LexicalRelations = Prettify<
	Partial<Record<LexicalRelation, RelationTargetDumlingIds>>
>;

export type MorphologicalRelations = Prettify<
	Partial<Record<MorphologicalRelation, RelationTargetDumlingIds>>
>;

const lexicalRelationsShape = {
	antonym: RelationTargetDumlingIdsSchema.optional(),
	holonym: RelationTargetDumlingIdsSchema.optional(),
	hypernym: RelationTargetDumlingIdsSchema.optional(),
	hyponym: RelationTargetDumlingIdsSchema.optional(),
	meronym: RelationTargetDumlingIdsSchema.optional(),
	nearSynonym: RelationTargetDumlingIdsSchema.optional(),
	synonym: RelationTargetDumlingIdsSchema.optional(),
} satisfies Record<
	LexicalRelation,
	z.ZodOptional<typeof RelationTargetDumlingIdsSchema>
>;

const morphologicalRelationsShape = {
	consistsOf: RelationTargetDumlingIdsSchema.optional(),
	derivedFrom: RelationTargetDumlingIdsSchema.optional(),
	sourceFor: RelationTargetDumlingIdsSchema.optional(),
	usedIn: RelationTargetDumlingIdsSchema.optional(),
} satisfies Record<
	MorphologicalRelation,
	z.ZodOptional<typeof RelationTargetDumlingIdsSchema>
>;

export const LexicalRelationsSchema = z
	.object(lexicalRelationsShape)
	.strict() as unknown as z.ZodType<LexicalRelations>;

export const MorphologicalRelationsSchema = z
	.object(morphologicalRelationsShape)
	.strict() as unknown as z.ZodType<MorphologicalRelations>;
