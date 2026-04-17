import { describe, expect, it } from "bun:test";
import { dumling } from "dumling";
import {
	englishWalkLemma,
	englishWalkResolvedInflectionSurface,
	englishWalkStandardFullSelection,
	englishWalkUnresolvedInflectionSurface,
} from "../helpers";

const { schemaFor: lingSchemaFor } = dumling;

describe("schemaFor", () => {
	it("parses representative public entities through concrete leaf schemas", () => {
		expect(
			lingSchemaFor.Lemma.English.Lexeme.VERB.parse(englishWalkLemma),
		).toEqual(englishWalkLemma);
		expect(
			lingSchemaFor.ResolvedSurface.English.Standard.Inflection.Lexeme.VERB.parse(
				englishWalkResolvedInflectionSurface,
			),
		).toEqual(englishWalkResolvedInflectionSurface);
		expect(
			lingSchemaFor.Selection.English.Standard.Inflection.Lexeme.VERB.parse(
				englishWalkStandardFullSelection,
			),
		).toEqual(englishWalkStandardFullSelection);
	});

	it("accepts both resolved and unresolved surfaces through the public surface schema", () => {
		const englishSurfaceSchema =
			lingSchemaFor.Surface.English.Standard.Inflection.Lexeme.VERB;

		expect(
			englishSurfaceSchema.parse(englishWalkResolvedInflectionSurface),
		).toEqual(englishWalkResolvedInflectionSurface);
		expect(
			englishSurfaceSchema.parse(englishWalkUnresolvedInflectionSurface),
		).toEqual(englishWalkUnresolvedInflectionSurface);
	});

	it("rejects mismatched entities when consumers pick the wrong schema", () => {
		const result =
			lingSchemaFor.Selection.English.Standard.Lemma.Lexeme.VERB.safeParse(
				englishWalkStandardFullSelection,
			);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(JSON.stringify(result.error.format())).toContain("Lemma");
		}
	});

	it("exposes leaf schemas as usable Zod schemas for downstream composition", () => {
		const optionalSelectionSchema =
			lingSchemaFor.Selection.English.Standard.Inflection.Lexeme.VERB.optional();

		expect(optionalSelectionSchema.parse(undefined)).toBeUndefined();
		expect(
			optionalSelectionSchema.parse(englishWalkStandardFullSelection),
		).toEqual(englishWalkStandardFullSelection);
	});
});
