import { describe, expect, it } from "bun:test";
import {
	type V0DumlingId,
	makeDumlingIdFor,
} from "../../src/v0/dumling-compat";
import {
	getInverseLexicalRelation,
	getInverseMorphologicalRelation,
	getReprForLexicalRelation,
	getReprForMorphologicalRelation,
	V0LexicalRelationsSchema,
	V0MorphologicalRelationsSchema,
	V0Relations,
	V0RelationTargetDumlingIdsSchema,
} from "../../src/v0";
import {
	englishWalkLemma,
	englishWalkResolvedInflectionSurface,
} from "../helpers";

describe("dumdict relations", () => {
	it("accepts lemma Dumling IDs as relation targets", () => {
		const lemmaId = makeDumlingIdFor("en", englishWalkLemma);

		expect(
			V0RelationTargetDumlingIdsSchema.parse([lemmaId] as V0DumlingId<"Lemma">[]),
		).toEqual([lemmaId] as V0DumlingId<"Lemma">[]);
	});

	it("rejects non-lemma Dumling IDs as relation targets", () => {
		const resolvedSurfaceId = makeDumlingIdFor(
			"en",
			englishWalkResolvedInflectionSurface,
		);

		expect(() =>
			V0RelationTargetDumlingIdsSchema.parse([resolvedSurfaceId]),
		).toThrow("Expected lemma Dumling ID");
	});

	it("validates lexical and morphological relation payloads", () => {
		const lemmaId = makeDumlingIdFor("en", englishWalkLemma);

		expect(V0LexicalRelationsSchema.parse({ synonym: [lemmaId] })).toEqual({
			synonym: [lemmaId],
		});
		expect(
			V0MorphologicalRelationsSchema.parse({ derivedFrom: [lemmaId] }),
		).toEqual({
			derivedFrom: [lemmaId],
		});
	});

	it("exposes inverse and repr helpers from the root api", () => {
		expect(V0Relations.Lexical.getInverse("hypernym")).toBe("hyponym");
		expect(V0Relations.Morphological.getInverse("derivedFrom")).toBe("sourceFor");
		expect(getInverseLexicalRelation("holonym")).toBe("meronym");
		expect(getInverseMorphologicalRelation("usedIn")).toBe("consistsOf");
		expect(getReprForLexicalRelation("nearSynonym")).toBe("≈");
		expect(getReprForMorphologicalRelation("sourceFor")).toBe("->");
	});
});
