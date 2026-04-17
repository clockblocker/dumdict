import { describe, expect, it } from "bun:test";
import { dumling, type Lemma } from "dumling";
import type { DumdictResult, LemmaEntry, SurfaceEntry } from "../../src";
import {
	makeDumdict,
} from "../../src";
import {
	englishWalkLemma,
	englishWalkResolvedInflectionSurface,
} from "../helpers";

const englishRunLemma = {
	canonicalLemma: "run",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🏃",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const englishStrideLemma = {
	canonicalLemma: "stride",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

function unwrap<T>(result: DumdictResult<T>) {
	if (result.isErr()) {
		throw new Error(`${result.error.code}: ${result.error.message}`);
	}

	return result.value;
}

function makeLemmaEntry(lemma: Lemma<"English">): LemmaEntry<"English"> {
	return {
		id: dumling.idCodec.English.makeDumlingIdFor(lemma),
		lemma,
		lexicalRelations: {},
		morphologicalRelations: {},
		attestedTranslations: [],
		attestations: [],
		notes: "",
	};
}

function makeSurfaceEntry(): SurfaceEntry<"English"> {
	return {
		id: dumling.idCodec.English.makeDumlingIdFor(
			englishWalkResolvedInflectionSurface,
		),
		surface: englishWalkResolvedInflectionSurface,
		ownerLemmaId: dumling.idCodec.English.makeDumlingIdFor(englishWalkLemma),
		attestedTranslations: [],
		attestations: [],
		notes: "",
	};
}

describe("dumdict", () => {
	it("stores entries with deterministic collection ordering and lookup behavior", () => {
		const dict = makeDumdict("English");
		const lemmaEntry: LemmaEntry<"English"> = {
			...makeLemmaEntry(englishWalkLemma),
			attestedTranslations: ["amble", "walk", "amble"],
			attestations: ["zeta", "alpha", "alpha"],
			notes: "verb lemma",
		};
		const surfaceEntry: SurfaceEntry<"English"> = {
			...makeSurfaceEntry(),
			attestedTranslations: ["go on foot", "stroll", "go on foot"],
			attestations: ["beta", "alpha", "beta"],
			notes: "present-tense surface",
		};

		unwrap(dict.upsertLemmaEntry(lemmaEntry));
		unwrap(dict.upsertSurfaceEntry(surfaceEntry));

		const storedLemma = unwrap(dict.getLemmaEntry(lemmaEntry.id));
		const storedSurface = unwrap(dict.getSurfaceEntry(surfaceEntry.id));
		const lookup = unwrap(dict.lookupBySurface("WALK"));
		const lookupLemmas = unwrap(dict.lookupLemmasBySurface("WALK"));
		const ownedSurfaces = unwrap(dict.getOwnedSurfaceEntries(lemmaEntry.id));

		expect(storedLemma.attestedTranslations).toEqual(["amble", "walk"]);
		expect(storedLemma.attestations).toEqual(["alpha", "zeta"]);
		expect(storedSurface.attestedTranslations).toEqual([
			"go on foot",
			"stroll",
		]);
		expect(storedSurface.attestations).toEqual(["alpha", "beta"]);
		expect(Object.keys(lookup.lemmas)).toEqual([lemmaEntry.id]);
		expect(Object.keys(lookup.surfaces)).toEqual([surfaceEntry.id]);
		expect(Object.keys(lookupLemmas)).toEqual([lemmaEntry.id]);
		expect(Object.keys(ownedSurfaces)).toEqual([surfaceEntry.id]);
	});

	it("maintains reciprocal resolved relations and removes stale inverses on upsert", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runEntry = makeLemmaEntry(englishRunLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(dict.upsertLemmaEntry(runEntry));
		unwrap(
			dict.patchLemmaEntry(walkEntry.id, {
				op: "addLexicalRelation",
				relation: "synonym",
				target: { kind: "existing", lemmaId: runEntry.id },
			}),
		);

		expect(unwrap(dict.getLemmaEntry(walkEntry.id)).lexicalRelations).toEqual({
			synonym: [runEntry.id],
		});
		expect(unwrap(dict.getLemmaEntry(runEntry.id)).lexicalRelations).toEqual({
			synonym: [walkEntry.id],
		});

		unwrap(
			dict.upsertLemmaEntry({
				...walkEntry,
				notes: "rewritten",
			}),
		);

		expect(unwrap(dict.getLemmaEntry(walkEntry.id)).lexicalRelations).toEqual({});
		expect(unwrap(dict.getLemmaEntry(runEntry.id)).lexicalRelations).toEqual({});
	});

	it("dedupes pending refs and resolves them into real reciprocal edges", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const strideEntry = makeLemmaEntry(englishStrideLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(
			dict.patchLemmaEntry(walkEntry.id, [
				{
					op: "addMorphologicalRelation",
					relation: "derivedFrom",
					target: {
						kind: "pending",
						ref: {
							canonicalLemma: "stride",
							lemmaKind: "Lexeme",
							lemmaSubKind: "VERB",
						},
					},
				},
				{
					op: "addMorphologicalRelation",
					relation: "derivedFrom",
					target: {
						kind: "pending",
						ref: {
							canonicalLemma: "stride",
							lemmaKind: "Lexeme",
							lemmaSubKind: "VERB",
						},
					},
				},
			]),
		);

		const pendingRefs = unwrap(dict.listPendingLemmaRefs());
		const pendingId = Object.keys(pendingRefs)[0]! as keyof typeof pendingRefs;
		const pendingRelations = unwrap(dict.listPendingRelationsForLemma(walkEntry.id));

		expect(Object.keys(pendingRefs)).toHaveLength(1);
		expect(pendingRelations).toHaveLength(1);
		expect(pendingRelations[0]?.targetPendingId).toBe(pendingId);

		unwrap(dict.upsertLemmaEntry(strideEntry));
		unwrap(dict.resolvePendingLemma(pendingId, strideEntry.id));

		expect(unwrap(dict.listPendingLemmaRefs())).toEqual({});
		expect(unwrap(dict.listPendingRelationsForLemma(walkEntry.id))).toEqual([]);
		expect(
			unwrap(dict.getLemmaEntry(walkEntry.id)).morphologicalRelations,
		).toEqual({
			derivedFrom: [strideEntry.id],
		});
		expect(
			unwrap(dict.getLemmaEntry(strideEntry.id)).morphologicalRelations,
		).toEqual({
			sourceFor: [walkEntry.id],
		});
	});

	it("rejects pending self-relations at patch time", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const result = dict.patchLemmaEntry(walkEntry.id, {
			op: "addLexicalRelation",
			relation: "synonym",
			target: {
				kind: "pending",
				ref: {
					canonicalLemma: "walk",
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
			},
		});

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("SelfRelationForbidden");
		}
		expect(unwrap(dict.listPendingLemmaRefs())).toEqual({});
	});

	it("deletes owned surfaces, incident relations, and sourced pending refs with lemma deletion", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runEntry = makeLemmaEntry(englishRunLemma);
		const surfaceEntry = makeSurfaceEntry();

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(dict.upsertLemmaEntry(runEntry));
		unwrap(dict.upsertSurfaceEntry(surfaceEntry));
		unwrap(
			dict.patchLemmaEntry(walkEntry.id, [
				{
					op: "addLexicalRelation",
					relation: "antonym",
					target: { kind: "existing", lemmaId: runEntry.id },
				},
				{
					op: "addMorphologicalRelation",
					relation: "derivedFrom",
					target: {
						kind: "pending",
						ref: {
							canonicalLemma: "stride",
							lemmaKind: "Lexeme",
							lemmaSubKind: "VERB",
						},
					},
				},
			]),
		);

		unwrap(dict.deleteLemmaEntry(walkEntry.id));

		const deletedLemma = dict.getLemmaEntry(walkEntry.id);
		const deletedSurface = dict.getSurfaceEntry(surfaceEntry.id);
		const runAfterDelete = unwrap(dict.getLemmaEntry(runEntry.id));

		expect(deletedLemma.isErr()).toBe(true);
		if (deletedLemma.isErr()) {
			expect(deletedLemma.error.code).toBe("LemmaEntryNotFound");
		}
		expect(deletedSurface.isErr()).toBe(true);
		if (deletedSurface.isErr()) {
			expect(deletedSurface.error.code).toBe("SurfaceEntryNotFound");
		}
		expect(runAfterDelete.lexicalRelations).toEqual({});
		expect(unwrap(dict.listPendingLemmaRefs())).toEqual({});
	});
});
