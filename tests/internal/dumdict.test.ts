import { describe, expect, it } from "bun:test";
import { dumling, type Lemma } from "dumling";
import type {
	AuthoritativeWriteSnapshot,
	ChangePrecondition,
	DumdictResult,
	LemmaEntry,
	MutationIntentV1,
	PlannedChangeOp,
	ReadDictionarySnapshot,
	SurfaceEntry,
} from "../../src";
import {
	applyPlannedChanges,
	exportSnapshot,
	hydrateSnapshot,
	lookupBySurface,
	lookupLemmasBySurface,
	makeDumdict,
	plan,
	validateAuthoritativeWriteSnapshot,
	validateReadableSnapshot,
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

		expect(unwrap(dict.getLemmaEntry(walkEntry.id)).lexicalRelations).toEqual(
			{},
		);
		expect(unwrap(dict.getLemmaEntry(runEntry.id)).lexicalRelations).toEqual(
			{},
		);
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
		const [pendingId] = Object.keys(pendingRefs) as Array<
			keyof typeof pendingRefs
		>;
		const pendingRelations = unwrap(
			dict.listPendingRelationsForLemma(walkEntry.id),
		);

		expect(Object.keys(pendingRefs)).toHaveLength(1);
		expect(pendingId).toBeDefined();
		if (pendingId === undefined) {
			throw new Error("Expected exactly one pending lemma id.");
		}
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

	it("hydrates and exports authoritative snapshots through public helpers", () => {
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
					relation: "synonym",
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

		const snapshot = unwrap(
			exportSnapshot(dict, "revision-1"),
		) satisfies AuthoritativeWriteSnapshot<"English">;

		unwrap(validateReadableSnapshot(snapshot));
		unwrap(validateAuthoritativeWriteSnapshot(snapshot));

		const hydrated = unwrap(hydrateSnapshot(snapshot));
		const exportedAgain = unwrap(exportSnapshot(hydrated, "revision-2"));

		expect(exportedAgain).toEqual({
			...snapshot,
			revision: "revision-2",
		});
	});

	it("accepts partial read snapshots for reads and rejects them for write authority", () => {
		const partialReadSnapshot = {
			authority: "read",
			completeness: "partial",
			revision: "revision-1",
			lemmas: [],
			surfaces: [makeSurfaceEntry()],
			pendingRefs: [],
			pendingRelations: [],
		} satisfies ReadDictionarySnapshot<"English">;

		const readValidation = validateReadableSnapshot(partialReadSnapshot);
		const writeValidation = validateAuthoritativeWriteSnapshot(
			partialReadSnapshot as never,
		);

		expect(readValidation.isOk()).toBe(true);
		expect(writeValidation.isErr()).toBe(true);
		if (writeValidation.isErr()) {
			expect(writeValidation.error.code).toBe("InvariantViolation");
		}
	});

	it("looks up through readable snapshots and respects partial owner-closure", () => {
		const dict = makeDumdict("English");
		const lemmaEntry = makeLemmaEntry(englishWalkLemma);
		const surfaceEntry = makeSurfaceEntry();

		unwrap(dict.upsertLemmaEntry(lemmaEntry));
		unwrap(dict.upsertSurfaceEntry(surfaceEntry));

		const fullSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const fullLookup = unwrap(lookupBySurface(fullSnapshot, "WALK"));
		const fullLemmaLookup = unwrap(lookupLemmasBySurface(fullSnapshot, "WALK"));

		expect(Object.keys(fullLookup.lemmas)).toEqual([lemmaEntry.id]);
		expect(Object.keys(fullLookup.surfaces)).toEqual([surfaceEntry.id]);
		expect(Object.keys(fullLemmaLookup)).toEqual([lemmaEntry.id]);

		const partialReadSnapshot = {
			authority: "read",
			completeness: "partial",
			revision: "revision-2",
			lemmas: [],
			surfaces: [surfaceEntry],
			pendingRefs: [],
			pendingRelations: [],
		} satisfies ReadDictionarySnapshot<"English">;

		const partialLookup = unwrap(lookupBySurface(partialReadSnapshot, "WALK"));
		const partialLemmaLookup = unwrap(
			lookupLemmasBySurface(partialReadSnapshot, "WALK"),
		);

		expect(Object.keys(partialLookup.lemmas)).toEqual([]);
		expect(Object.keys(partialLookup.surfaces)).toEqual([surfaceEntry.id]);
		expect(Object.keys(partialLemmaLookup)).toEqual([]);
	});

	it("applies planned changes against authoritative snapshots", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runEntry = makeLemmaEntry(englishRunLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const walkSurface = {
			...makeSurfaceEntry(),
			attestedTranslations: ["walk"],
			attestations: ["they walk"],
			notes: "demo surface",
		} satisfies SurfaceEntry<"English">;
		const changes = [
			{
				type: "createLemma",
				entry: runEntry,
				preconditions: [
					{
						kind: "lemmaMissing",
						lemmaId: runEntry.id,
					} satisfies ChangePrecondition<"English">,
				],
			},
			{
				type: "patchLemma",
				lemmaId: walkEntry.id,
				ops: [
					{ op: "addTranslation", value: "go on foot" },
					{
						op: "addLexicalRelation",
						relation: "synonym",
						target: { kind: "existing", lemmaId: runEntry.id },
					},
				],
			},
			{
				type: "createSurface",
				entry: walkSurface,
			},
		] satisfies PlannedChangeOp<"English">[];

		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextLookup = unwrap(lookupBySurface(nextSnapshot, "WALK"));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));

		expect(nextSnapshot.revision).toBe(baseSnapshot.revision);
		expect(Object.keys(nextLookup.lemmas)).toEqual([walkEntry.id]);
		expect(Object.keys(nextLookup.surfaces)).toEqual([walkSurface.id]);
		expect(unwrap(nextHydrated.getLemmaEntry(walkEntry.id)).lexicalRelations).toEqual(
			{
				synonym: [runEntry.id],
			},
		);
		expect(
			unwrap(nextHydrated.getLemmaEntry(walkEntry.id)).attestedTranslations,
		).toEqual(["go on foot"]);
		expect(unwrap(nextHydrated.getLemmaEntry(runEntry.id)).lexicalRelations).toEqual(
			{
				synonym: [walkEntry.id],
			},
		);
		expect(unwrap(nextHydrated.getSurfaceEntry(walkSurface.id)).ownerLemmaId).toBe(
			walkEntry.id,
		);
	});

	it("rejects planned changes when a precondition fails", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runEntry = makeLemmaEntry(englishRunLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const changes = [
			{
				type: "createLemma",
				entry: runEntry,
				preconditions: [
					{
						kind: "snapshotRevisionMatches",
						revision: "revision-stale",
					} satisfies ChangePrecondition<"English">,
				],
			},
		] satisfies PlannedChangeOp<"English">[];

		const result = applyPlannedChanges(baseSnapshot, changes);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("InvariantViolation");
		}

		const hydratedBase = unwrap(hydrateSnapshot(baseSnapshot));
		expect(unwrap(hydratedBase.getLemmaEntry(walkEntry.id)).lemma).toEqual(
			walkEntry.lemma,
		);
	});

	it("plans append-lemma-attestation intents into patch operations", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "appendLemmaAttestation",
			lemmaId: walkEntry.id,
			attestation: "They walk home together.",
		} satisfies MutationIntentV1<"English">;

		const changes = unwrap(plan(baseSnapshot, intent));
		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));

		expect(changes).toEqual([
			{
				type: "patchLemma",
				lemmaId: walkEntry.id,
				ops: [{ op: "addAttestation", value: "They walk home together." }],
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaExists", lemmaId: walkEntry.id },
				],
			},
		]);
		expect(unwrap(nextHydrated.getLemmaEntry(walkEntry.id)).attestations).toEqual(
			["They walk home together."],
		);
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

	it("rejects foreign-language and malformed pending ids on pending-id APIs", () => {
		const dict = makeDumdict("English");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const strideEntry = makeLemmaEntry(englishStrideLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(
			dict.patchLemmaEntry(walkEntry.id, {
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
			}),
		);
		unwrap(dict.upsertLemmaEntry(strideEntry));

		const foreignPendingId =
			"pending:v1:Hebrew:stride:Lexeme:VERB" as unknown as string;
		const malformedPendingId = "pending:not-valid" as unknown as string;

		const foreignGetResult = dict.getPendingLemmaRef(foreignPendingId as never);
		const malformedGetResult = dict.getPendingLemmaRef(
			malformedPendingId as never,
		);
		const foreignResolveResult = dict.resolvePendingLemma(
			foreignPendingId as never,
			strideEntry.id,
		);
		const malformedResolveResult = dict.resolvePendingLemma(
			malformedPendingId as never,
			strideEntry.id,
		);
		const foreignRemoveResult = dict.removePendingRelation({
			sourceLemmaId: walkEntry.id,
			relationFamily: "morphological",
			relation: "derivedFrom",
			targetPendingId: foreignPendingId as never,
		});

		expect(foreignGetResult.isErr()).toBe(true);
		expect(malformedGetResult.isErr()).toBe(true);
		expect(foreignResolveResult.isErr()).toBe(true);
		expect(malformedResolveResult.isErr()).toBe(true);
		expect(foreignRemoveResult.isErr()).toBe(true);

		if (foreignGetResult.isErr()) {
			expect(foreignGetResult.error.code).toBe("LanguageMismatch");
		}
		if (malformedGetResult.isErr()) {
			expect(malformedGetResult.error.code).toBe("DecodeFailed");
		}
		if (foreignResolveResult.isErr()) {
			expect(foreignResolveResult.error.code).toBe("LanguageMismatch");
		}
		if (malformedResolveResult.isErr()) {
			expect(malformedResolveResult.error.code).toBe("DecodeFailed");
		}
		if (foreignRemoveResult.isErr()) {
			expect(foreignRemoveResult.error.code).toBe("LanguageMismatch");
		}
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
