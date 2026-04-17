import { describe, expect, it } from "bun:test";
import { type DumlingId, dumling } from "../../src/dumling-compat";
import {
	getInverseLexicalRelation,
	getInverseMorphologicalRelation,
	getReprForLexicalRelation,
	getReprForMorphologicalRelation,
	LexicalRelationsSchema,
	MorphologicalRelationsSchema,
	Relations,
	RelationTargetDumlingIdsSchema,
} from "../../src";
import {
	englishWalkLemma,
	englishWalkResolvedInflectionSurface,
} from "../helpers";

describe("dumdict relations", () => {
	it("accepts lemma Dumling IDs as relation targets", () => {
		const lemmaId = dumling.idCodec.English.makeDumlingIdFor(englishWalkLemma);

		expect(
			RelationTargetDumlingIdsSchema.parse([lemmaId] as DumlingId<"Lemma">[]),
		).toEqual([lemmaId] as DumlingId<"Lemma">[]);
	});

	it("rejects non-lemma Dumling IDs as relation targets", () => {
		const resolvedSurfaceId = dumling.idCodec.English.makeDumlingIdFor(
			englishWalkResolvedInflectionSurface,
		);

		expect(() =>
			RelationTargetDumlingIdsSchema.parse([resolvedSurfaceId]),
		).toThrow("Expected lemma Dumling ID");
	});

	it("validates lexical and morphological relation payloads", () => {
		const lemmaId = dumling.idCodec.English.makeDumlingIdFor(englishWalkLemma);

		expect(LexicalRelationsSchema.parse({ synonym: [lemmaId] })).toEqual({
			synonym: [lemmaId],
		});
		expect(
			MorphologicalRelationsSchema.parse({ derivedFrom: [lemmaId] }),
		).toEqual({
			derivedFrom: [lemmaId],
		});
	});

	it("exposes inverse and repr helpers from the root api", () => {
		expect(Relations.Lexical.getInverse("hypernym")).toBe("hyponym");
		expect(Relations.Morphological.getInverse("derivedFrom")).toBe("sourceFor");
		expect(getInverseLexicalRelation("holonym")).toBe("meronym");
		expect(getInverseMorphologicalRelation("usedIn")).toBe("consistsOf");
		expect(getReprForLexicalRelation("nearSynonym")).toBe("≈");
		expect(getReprForMorphologicalRelation("sourceFor")).toBe("->");
	});
});
