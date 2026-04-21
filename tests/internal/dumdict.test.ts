import { describe, expect, it } from "bun:test";
import {
	makeDumlingIdFor,
	type V0Lemma,
	type V0Surface,
} from "../../src/v0/dumling-compat";
import type {
	V0AuthoritativeWriteSnapshot,
	V0ChangePrecondition,
	V0Dumdict,
	V0DumdictResult,
	V0LemmaEntry,
	V0MutationIntentV1,
	V0PendingLemmaId,
	V0PlannedChangeOp,
	V0ReadDictionarySnapshot,
	V0SurfaceEntry,
} from "../../src/v0";
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
} from "../../src/v0";
import {
	englishWalkLemma,
	englishWalkResolvedInflectionSurface,
	germanGehenLemma,
} from "../helpers";

const englishRunLemma = {
	canonicalLemma: "run",
	inherentFeatures: {},
	language: "en",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🏃",
	lemmaSubKind: "VERB",
} satisfies V0Lemma<"en", "Lexeme", "VERB">;

const englishStrideLemma = {
	canonicalLemma: "stride",
	inherentFeatures: {},
	language: "en",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	lemmaSubKind: "VERB",
} satisfies V0Lemma<"en", "Lexeme", "VERB">;

function unwrap<T>(result: V0DumdictResult<T>) {
	if (result.isErr()) {
		throw new Error(`${result.error.code}: ${result.error.message}`);
	}

	return result.value;
}

function makeLemmaEntry(lemma: V0Lemma<"en">): V0LemmaEntry<"en"> {
	return {
		id: makeDumlingIdFor("en", lemma),
		lemma,
		lexicalRelations: {},
		morphologicalRelations: {},
		attestedTranslations: [],
		attestations: [],
		notes: "",
	};
}

function makeSurfaceEntry(): V0SurfaceEntry<"en"> {
	return {
		id: makeDumlingIdFor("en", englishWalkResolvedInflectionSurface),
		surface: englishWalkResolvedInflectionSurface,
		ownerLemmaId: makeDumlingIdFor("en", englishWalkLemma),
		attestedTranslations: [],
		attestations: [],
		notes: "",
	};
}

const englishRunResolvedLemmaSurface = {
	language: "en",
	normalizedFullSurface: "run",
	surfaceKind: "Lemma",
	lemma: englishRunLemma,
} satisfies V0Surface<"en", "Lemma", "Lexeme", "VERB">;

describe("dumdict", () => {
	it("stores entries with deterministic collection ordering and lookup behavior", () => {
		const dict = makeDumdict("en");
		const lemmaEntry: V0LemmaEntry<"en"> = {
			...makeLemmaEntry(englishWalkLemma),
			attestedTranslations: ["amble", "walk", "amble"],
			attestations: ["zeta", "alpha", "alpha"],
			notes: "verb lemma",
		};
		const surfaceEntry: V0SurfaceEntry<"en"> = {
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
		const dict = makeDumdict("en");
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
		const dict = makeDumdict("en");
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
		const dict = makeDumdict("en");
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
		) satisfies V0AuthoritativeWriteSnapshot<"en">;

		unwrap(validateReadableSnapshot(snapshot));
		unwrap(validateAuthoritativeWriteSnapshot(snapshot));

		const hydrated = unwrap(hydrateSnapshot(snapshot));
		const exportedAgain = unwrap(exportSnapshot(hydrated, "revision-2"));

		expect(exportedAgain).toEqual({
			...snapshot,
			revision: "revision-2",
		});
	});

	it("hydrates empty authoritative snapshots when language is explicit", () => {
		const snapshot = {
			authority: "write",
			completeness: "full",
			language: "en",
			revision: "revision-1",
			lemmas: [],
			surfaces: [],
			pendingRefs: [],
			pendingRelations: [],
		} satisfies V0AuthoritativeWriteSnapshot<"en">;

		unwrap(validateAuthoritativeWriteSnapshot(snapshot));

		const hydrated = unwrap(hydrateSnapshot(snapshot));
		const exported = unwrap(exportSnapshot(hydrated, "revision-1"));

		expect(exported).toEqual(snapshot);
	});

	it("exports snapshots through the generic V0Dumdict interface hook", () => {
		const inner = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(inner.upsertLemmaEntry(walkEntry));

		const wrapped = {
			language: inner.language,
			exportAuthoritativeSnapshot: (revision: string) =>
				inner.exportAuthoritativeSnapshot(revision),
			lookupBySurface: (surface: string) => inner.lookupBySurface(surface),
			lookupLemmasBySurface: (surface: string) =>
				inner.lookupLemmasBySurface(surface),
			getLemmaEntry: (id: V0LemmaEntry<"en">["id"]) => inner.getLemmaEntry(id),
			getSurfaceEntry: (id: V0SurfaceEntry<"en">["id"]) =>
				inner.getSurfaceEntry(id),
			getOwnedSurfaceEntries: (lemmaId: V0LemmaEntry<"en">["id"]) =>
				inner.getOwnedSurfaceEntries(lemmaId),
			getPendingLemmaRef: (pendingId: V0PendingLemmaId<"en">) =>
				inner.getPendingLemmaRef(pendingId),
			listPendingLemmaRefs: () => inner.listPendingLemmaRefs(),
			listPendingRelationsForLemma: (lemmaId: V0LemmaEntry<"en">["id"]) =>
				inner.listPendingRelationsForLemma(lemmaId),
			upsertLemmaEntry: (entry: V0LemmaEntry<"en">) =>
				inner.upsertLemmaEntry(entry),
			upsertSurfaceEntry: (entry: V0SurfaceEntry<"en">) =>
				inner.upsertSurfaceEntry(entry),
			patchLemmaEntry: (
				id: V0LemmaEntry<"en">["id"],
				ops: Parameters<typeof inner.patchLemmaEntry>[1],
			) => inner.patchLemmaEntry(id, ops),
			patchSurfaceEntry: (
				id: V0SurfaceEntry<"en">["id"],
				ops: Parameters<typeof inner.patchSurfaceEntry>[1],
			) => inner.patchSurfaceEntry(id, ops),
			removePendingRelation: (edge: Parameters<typeof inner.removePendingRelation>[0]) =>
				inner.removePendingRelation(edge),
			resolvePendingLemma: (
				pendingId: V0PendingLemmaId<"en">,
				lemmaId: V0LemmaEntry<"en">["id"],
			) => inner.resolvePendingLemma(pendingId, lemmaId),
			deleteLemmaEntry: (id: V0LemmaEntry<"en">["id"]) =>
				inner.deleteLemmaEntry(id),
			deleteSurfaceEntry: (id: V0SurfaceEntry<"en">["id"]) =>
				inner.deleteSurfaceEntry(id),
		} satisfies V0Dumdict<"en">;

		const exported = unwrap(exportSnapshot(wrapped, "revision-1"));

		expect(exported.language).toBe("en");
		expect(exported.lemmas).toEqual([
			{
				...walkEntry,
				attestedTranslations: [],
				attestations: [],
			},
		]);
	});

	it("accepts partial read snapshots for reads and rejects them for write authority", () => {
		const partialReadSnapshot = {
			authority: "read",
			completeness: "partial",
			language: "en",
			revision: "revision-1",
			lemmas: [],
			surfaces: [makeSurfaceEntry()],
			pendingRefs: [],
			pendingRelations: [],
		} satisfies V0ReadDictionarySnapshot<"en">;

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
		const dict = makeDumdict("en");
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
			language: "en",
			revision: "revision-2",
			lemmas: [],
			surfaces: [surfaceEntry],
			pendingRefs: [],
			pendingRelations: [],
		} satisfies V0ReadDictionarySnapshot<"en">;

		const partialLookup = unwrap(lookupBySurface(partialReadSnapshot, "WALK"));
		const partialLemmaLookup = unwrap(
			lookupLemmasBySurface(partialReadSnapshot, "WALK"),
		);

		expect(Object.keys(partialLookup.lemmas)).toEqual([]);
		expect(Object.keys(partialLookup.surfaces)).toEqual([surfaceEntry.id]);
		expect(Object.keys(partialLemmaLookup)).toEqual([]);
	});

	it("rejects authoritative snapshots with missing reciprocal resolved relations", () => {
		const dict = makeDumdict("en");
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

		const snapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const brokenSnapshot = {
			...snapshot,
			lemmas: snapshot.lemmas.map((entry) =>
				entry.id === runEntry.id
					? { ...entry, lexicalRelations: {} }
					: entry,
			),
		} satisfies V0AuthoritativeWriteSnapshot<"en">;

		const validation = validateAuthoritativeWriteSnapshot(brokenSnapshot);
		const hydration = hydrateSnapshot(brokenSnapshot);

		expect(validation.isErr()).toBe(true);
		expect(hydration.isErr()).toBe(true);
		if (validation.isErr()) {
			expect(validation.error.code).toBe("InvariantViolation");
		}
	});

	it("applies planned changes against authoritative snapshots", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runEntry = makeLemmaEntry(englishRunLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const walkSurface = {
			...makeSurfaceEntry(),
			attestedTranslations: ["walk"],
			attestations: ["they walk"],
			notes: "demo surface",
		} satisfies V0SurfaceEntry<"en">;
		const changes = [
			{
				type: "createLemma",
				entry: runEntry,
				preconditions: [
					{
						kind: "lemmaMissing",
						lemmaId: runEntry.id,
					} satisfies V0ChangePrecondition<"en">,
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
		] satisfies V0PlannedChangeOp<"en">[];

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

	it("applies planned changes with an explicit next revision", () => {
		const dict = makeDumdict("en");
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
						revision: "revision-1",
					} satisfies V0ChangePrecondition<"en">,
					{
						kind: "lemmaMissing",
						lemmaId: runEntry.id,
					} satisfies V0ChangePrecondition<"en">,
				],
			},
		] satisfies V0PlannedChangeOp<"en">[];

		const nextSnapshot = unwrap(
			applyPlannedChanges(baseSnapshot, changes, {
				nextRevision: "revision-2",
			}),
		);

		expect(nextSnapshot.revision).toBe("revision-2");
		expect(nextSnapshot.lemmas.map((entry) => entry.id)).toEqual([
			walkEntry.id,
			runEntry.id,
		]);
	});

	it("rejects planned changes when a precondition fails", () => {
		const dict = makeDumdict("en");
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
					} satisfies V0ChangePrecondition<"en">,
				],
			},
		] satisfies V0PlannedChangeOp<"en">[];

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
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "appendLemmaAttestation",
			lemmaId: walkEntry.id,
			attestation: "They walk home together.",
		} satisfies V0MutationIntentV1<"en">;

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

	it("plans insert-lemma intents into create and patch operations", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runLemmaId = makeDumlingIdFor("en", englishRunLemma);
		const runSurfaceId = makeDumlingIdFor(
			"en",
			englishRunResolvedLemmaSurface,
		) as V0SurfaceEntry<"en">["id"];

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "insertLemma",
			entry: {
				lemma: englishRunLemma,
				attestedTranslations: ["courir"],
				attestations: ["They run every morning."],
				notes: "motion verb",
			},
			ownedSurfaces: [
				{
					surface: englishRunResolvedLemmaSurface,
					ownerLemmaId: runLemmaId,
					attestedTranslations: ["run"],
					attestations: ["run"],
					notes: "lemma surface",
				},
			],
			initialRelations: [
				{
					relationFamily: "lexical",
					relation: "synonym",
					target: { kind: "existing", lemmaId: walkEntry.id },
				},
			],
		} satisfies V0MutationIntentV1<"en">;

		const changes = unwrap(plan(baseSnapshot, intent));
		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));

		expect(changes).toEqual([
			{
				type: "createLemma",
				entry: {
					id: runLemmaId,
					lemma: englishRunLemma,
					lexicalRelations: {},
					morphologicalRelations: {},
					attestedTranslations: ["courir"],
					attestations: ["They run every morning."],
					notes: "motion verb",
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaMissing", lemmaId: runLemmaId },
				],
			},
			{
				type: "createSurface",
				entry: {
					id: runSurfaceId,
					surface: englishRunResolvedLemmaSurface,
					ownerLemmaId: runLemmaId,
					attestedTranslations: ["run"],
					attestations: ["run"],
					notes: "lemma surface",
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "surfaceMissing", surfaceId: runSurfaceId },
				],
			},
			{
				type: "patchLemma",
				lemmaId: runLemmaId,
				ops: [
					{
						op: "addLexicalRelation",
						relation: "synonym",
						target: { kind: "existing", lemmaId: walkEntry.id },
					},
				],
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaExists", lemmaId: walkEntry.id },
				],
			},
			{
				type: "patchLemma",
				lemmaId: walkEntry.id,
				ops: [
					{
						op: "addLexicalRelation",
						relation: "synonym",
						target: { kind: "existing", lemmaId: runLemmaId },
					},
				],
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaExists", lemmaId: walkEntry.id },
				],
			},
		]);
		expect(unwrap(nextHydrated.getLemmaEntry(runLemmaId)).attestedTranslations).toEqual(
			["courir"],
		);
		expect(unwrap(nextHydrated.getLemmaEntry(runLemmaId)).lexicalRelations).toEqual(
			{ synonym: [walkEntry.id] },
		);
		expect(unwrap(nextHydrated.getLemmaEntry(walkEntry.id)).lexicalRelations).toEqual(
			{ synonym: [runLemmaId] },
		);
		expect(unwrap(nextHydrated.getSurfaceEntry(runSurfaceId)).ownerLemmaId).toBe(
			runLemmaId,
		);
	});

	it("rejects insert-lemma intents whose owned surfaces do not belong to the inserted lemma", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "insertLemma",
			entry: {
				lemma: englishRunLemma,
				attestedTranslations: [],
				attestations: [],
				notes: "",
			},
			ownedSurfaces: [
				{
					surface: englishWalkResolvedInflectionSurface,
					ownerLemmaId: walkEntry.id,
					attestedTranslations: [],
					attestations: [],
					notes: "",
				},
			],
		} satisfies V0MutationIntentV1<"en">;

		const result = plan(baseSnapshot, intent);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("InvariantViolation");
		}
	});

	it("rejects insert-lemma intents whose lemma payload belongs to another language", () => {
		const dict = makeDumdict("en");
		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "insertLemma",
			entry: {
				lemma: germanGehenLemma as never,
				attestedTranslations: [],
				attestations: [],
				notes: "",
			},
		} satisfies V0MutationIntentV1<"en">;

		const result = plan(baseSnapshot, intent);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("LanguageMismatch");
		}
	});

	it("plans upsert-owned-surface intents into patch operations for existing surfaces", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const surfaceEntry = makeSurfaceEntry();

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(dict.upsertSurfaceEntry(surfaceEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "upsertOwnedSurface",
			entry: {
				surface: englishWalkResolvedInflectionSurface,
				ownerLemmaId: walkEntry.id,
				attestedTranslations: ["go on foot"],
				attestations: ["They walk home together."],
				notes: "updated surface note",
			},
		} satisfies V0MutationIntentV1<"en">;

		const changes = unwrap(plan(baseSnapshot, intent));
		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));
		const surfaceId = makeDumlingIdFor(
			"en",
			englishWalkResolvedInflectionSurface,
		) as V0SurfaceEntry<"en">["id"];

		expect(changes).toEqual([
			{
				type: "patchSurface",
				surfaceId,
				ops: [
					{ op: "addTranslation", value: "go on foot" },
					{ op: "addAttestation", value: "They walk home together." },
					{ op: "setNotes", value: "updated surface note" },
				],
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "surfaceExists", surfaceId },
				],
			},
		]);
		expect(unwrap(nextHydrated.getSurfaceEntry(surfaceId)).attestedTranslations).toEqual(
			["go on foot"],
		);
		expect(unwrap(nextHydrated.getSurfaceEntry(surfaceId)).attestations).toEqual(
			["They walk home together."],
		);
		expect(unwrap(nextHydrated.getSurfaceEntry(surfaceId)).notes).toBe(
			"updated surface note",
		);
	});

	it("rejects upsert-owned-surface intents that target an existing surface owned by another lemma", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runEntry = makeLemmaEntry(englishRunLemma);
		const surfaceEntry = makeSurfaceEntry();

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(dict.upsertLemmaEntry(runEntry));
		unwrap(dict.upsertSurfaceEntry(surfaceEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "upsertOwnedSurface",
			entry: {
				surface: englishWalkResolvedInflectionSurface,
				ownerLemmaId: runEntry.id,
				attestedTranslations: ["go on foot"],
				attestations: ["They walk home together."],
				notes: "updated surface note",
			},
		} satisfies V0MutationIntentV1<"en">;

		const result = plan(baseSnapshot, intent);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("InvariantViolation");
		}
	});

	it("rejects upsert-owned-surface intents when the owner lemma is missing from the snapshot", () => {
		const dict = makeDumdict("en");
		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const ownerLemmaId = makeDumlingIdFor("en", englishWalkLemma);
		const intent = {
			version: "v1",
			kind: "upsertOwnedSurface",
			entry: {
				surface: englishWalkResolvedInflectionSurface,
				ownerLemmaId,
				attestedTranslations: ["go on foot"],
				attestations: ["They walk home together."],
				notes: "updated surface note",
			},
		} satisfies V0MutationIntentV1<"en">;

		const result = plan(baseSnapshot, intent);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("OwnerLemmaNotFound");
		}
	});

	it("plans resolve-pending-lemma intents into pending cleanup and relation materialization", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const strideEntry = makeLemmaEntry(englishStrideLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(dict.upsertLemmaEntry(strideEntry));
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

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const pendingId = baseSnapshot.pendingRefs[0]?.pendingId;
		if (!pendingId) {
			throw new Error("Expected one pending ref in the base snapshot.");
		}

		const intent = {
			version: "v1",
			kind: "resolvePendingLemma",
			pendingId,
			lemmaId: strideEntry.id,
		} satisfies V0MutationIntentV1<"en">;

		const changes = unwrap(plan(baseSnapshot, intent));
		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));

		expect(changes).toEqual([
			{
				type: "patchLemma",
				lemmaId: walkEntry.id,
				ops: [
					{
						op: "addMorphologicalRelation",
						relation: "derivedFrom",
						target: { kind: "existing", lemmaId: strideEntry.id },
					},
				],
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "pendingRefExists", pendingId },
					{ kind: "lemmaExists", lemmaId: walkEntry.id },
					{ kind: "lemmaExists", lemmaId: strideEntry.id },
				],
			},
			{
				type: "patchLemma",
				lemmaId: strideEntry.id,
				ops: [
					{
						op: "addMorphologicalRelation",
						relation: "sourceFor",
						target: { kind: "existing", lemmaId: walkEntry.id },
					},
				],
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "pendingRefExists", pendingId },
					{ kind: "lemmaExists", lemmaId: strideEntry.id },
					{ kind: "lemmaExists", lemmaId: walkEntry.id },
				],
			},
			{
				type: "deletePendingRelation",
				relation: {
					sourceLemmaId: walkEntry.id,
					relationFamily: "morphological",
					relation: "derivedFrom",
					targetPendingId: pendingId,
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "pendingRefExists", pendingId },
				],
			},
		]);
		expect(unwrap(nextHydrated.listPendingLemmaRefs())).toEqual({});
		expect(
			unwrap(nextHydrated.listPendingRelationsForLemma(walkEntry.id)),
		).toEqual([]);
		expect(
			unwrap(nextHydrated.getLemmaEntry(walkEntry.id)).morphologicalRelations,
		).toEqual({
			derivedFrom: [strideEntry.id],
		});
		expect(
			unwrap(nextHydrated.getLemmaEntry(strideEntry.id)).morphologicalRelations,
		).toEqual({
			sourceFor: [walkEntry.id],
		});
	});

	it("plans insert-lemma intents with pending initial relations", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runLemmaId = makeDumlingIdFor("en", englishRunLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const intent = {
			version: "v1",
			kind: "insertLemma",
			entry: {
				lemma: englishRunLemma,
				attestedTranslations: [],
				attestations: [],
				notes: "",
			},
			initialRelations: [
				{
					relationFamily: "morphological",
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
			],
		} satisfies V0MutationIntentV1<"en">;

		const changes = unwrap(plan(baseSnapshot, intent));
		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));
		const insertedPendingId = nextSnapshot.pendingRefs[0]?.pendingId;
		if (!insertedPendingId) {
			throw new Error("Expected one pending ref after insertLemma planning.");
		}

		expect(changes).toEqual([
			{
				type: "createLemma",
				entry: {
					id: runLemmaId,
					lemma: englishRunLemma,
					lexicalRelations: {},
					morphologicalRelations: {},
					attestedTranslations: [],
					attestations: [],
					notes: "",
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaMissing", lemmaId: runLemmaId },
				],
			},
			{
				type: "patchLemma",
				lemmaId: runLemmaId,
				ops: [
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
				],
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
				],
			},
		]);
		expect(Object.keys(unwrap(nextHydrated.listPendingLemmaRefs()))).toHaveLength(1);
		expect(
			unwrap(nextHydrated.listPendingRelationsForLemma(runLemmaId)),
		).toEqual([
			{
				sourceLemmaId: runLemmaId,
				relationFamily: "morphological",
				relation: "derivedFrom",
				targetPendingId: insertedPendingId,
			},
		]);
	});

	it("applies create-pending-relation changes against an existing pending ref", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);
		const runEntry = makeLemmaEntry(englishRunLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(dict.upsertLemmaEntry(runEntry));
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

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const pendingId = baseSnapshot.pendingRefs[0]?.pendingId;
		if (!pendingId) {
			throw new Error("Expected one pending ref in the base snapshot.");
		}

		const changes = [
			{
				type: "createPendingRelation",
				relation: {
					sourceLemmaId: runEntry.id,
					relationFamily: "morphological",
					relation: "derivedFrom",
					targetPendingId: pendingId,
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaExists", lemmaId: runEntry.id },
					{ kind: "pendingRefExists", pendingId },
				],
			},
		] satisfies V0PlannedChangeOp<"en">[];

		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));

		expect(Object.keys(unwrap(nextHydrated.listPendingLemmaRefs()))).toEqual([
			pendingId,
		]);
		expect(
			unwrap(nextHydrated.listPendingRelationsForLemma(walkEntry.id)),
		).toEqual([
			{
				sourceLemmaId: walkEntry.id,
				relationFamily: "morphological",
				relation: "derivedFrom",
				targetPendingId: pendingId,
			},
		]);
		expect(
			unwrap(nextHydrated.listPendingRelationsForLemma(runEntry.id)),
		).toEqual([
			{
				sourceLemmaId: runEntry.id,
				relationFamily: "morphological",
				relation: "derivedFrom",
				targetPendingId: pendingId,
			},
		]);
	});

	it("applies create-pending-ref and create-pending-relation changes in one batch", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const pendingId =
			"pending:v1:en:stride:Lexeme:VERB" as V0PendingLemmaId<"en">;

		const changes = [
			{
				type: "createPendingRef",
				ref: {
					pendingId,
					language: "en",
					canonicalLemma: "stride",
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "pendingRefMissing", pendingId },
				],
			},
			{
				type: "createPendingRelation",
				relation: {
					sourceLemmaId: walkEntry.id,
					relationFamily: "morphological",
					relation: "derivedFrom",
					targetPendingId: pendingId,
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaExists", lemmaId: walkEntry.id },
				],
			},
		] satisfies V0PlannedChangeOp<"en">[];

		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));

		expect(Object.keys(unwrap(nextHydrated.listPendingLemmaRefs()))).toEqual([
			pendingId,
		]);
		expect(
			unwrap(nextHydrated.listPendingRelationsForLemma(walkEntry.id)),
		).toEqual([
			{
				sourceLemmaId: walkEntry.id,
				relationFamily: "morphological",
				relation: "derivedFrom",
				targetPendingId: pendingId,
			},
		]);
	});

	it("lets later preconditions observe earlier changes in the same batch", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const pendingId =
			"pending:v1:en:stride:Lexeme:VERB" as V0PendingLemmaId<"en">;

		const changes = [
			{
				type: "createPendingRef",
				ref: {
					pendingId,
					language: "en",
					canonicalLemma: "stride",
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "pendingRefMissing", pendingId },
				],
			},
			{
				type: "createPendingRelation",
				relation: {
					sourceLemmaId: walkEntry.id,
					relationFamily: "morphological",
					relation: "derivedFrom",
					targetPendingId: pendingId,
				},
				preconditions: [
					{ kind: "snapshotRevisionMatches", revision: "revision-1" },
					{ kind: "lemmaExists", lemmaId: walkEntry.id },
					{ kind: "pendingRefExists", pendingId },
				],
			},
		] satisfies V0PlannedChangeOp<"en">[];

		const nextSnapshot = unwrap(applyPlannedChanges(baseSnapshot, changes));
		const nextHydrated = unwrap(hydrateSnapshot(nextSnapshot));

		expect(Object.keys(unwrap(nextHydrated.listPendingLemmaRefs()))).toEqual([
			pendingId,
		]);
		expect(
			unwrap(nextHydrated.listPendingRelationsForLemma(walkEntry.id)),
		).toEqual([
			{
				sourceLemmaId: walkEntry.id,
				relationFamily: "morphological",
				relation: "derivedFrom",
				targetPendingId: pendingId,
			},
		]);
	});

	it("rejects authoritative snapshots with orphan pending refs", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

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

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const orphanSnapshot = {
			...baseSnapshot,
			pendingRelations: [],
		} satisfies V0AuthoritativeWriteSnapshot<"en">;

		const result = validateAuthoritativeWriteSnapshot(orphanSnapshot);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("InvariantViolation");
		}
	});

	it("rejects standalone create-pending-ref changes in v1", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const pendingId =
			"pending:v1:en:stride:Lexeme:VERB" as V0PendingLemmaId<"en">;
		const changes = [
			{
				type: "createPendingRef",
				ref: {
					pendingId,
					language: "en",
					canonicalLemma: "stride",
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
			},
		] satisfies V0PlannedChangeOp<"en">[];

		const result = applyPlannedChanges(baseSnapshot, changes);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("InvariantViolation");
			expect(result.error.message).toContain("standalone");
		}
	});

	it("rejects delete-pending-ref changes in v1", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

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

		const baseSnapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const pendingId = baseSnapshot.pendingRefs[0]?.pendingId;
		if (!pendingId) {
			throw new Error("Expected one pending ref in the base snapshot.");
		}

		const changes = [
			{
				type: "deletePendingRef",
				pendingId,
			},
		] satisfies V0PlannedChangeOp<"en">[];

		const result = applyPlannedChanges(baseSnapshot, changes);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("InvariantViolation");
			expect(result.error.message).toContain("removed automatically");
		}
	});

	it("rejects pending self-relations at patch time", () => {
		const dict = makeDumdict("en");
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
		const dict = makeDumdict("en");
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
			"pending:v1:he:stride:Lexeme:VERB" as unknown as string;
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

	it("rejects authoritative snapshots whose pending ids do not match the stored pending-ref tuple", () => {
		const dict = makeDumdict("en");
		const walkEntry = makeLemmaEntry(englishWalkLemma);

		unwrap(dict.upsertLemmaEntry(walkEntry));
		unwrap(
			dict.patchLemmaEntry(walkEntry.id, {
				op: "addLexicalRelation",
				relation: "synonym",
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

		const snapshot = unwrap(exportSnapshot(dict, "revision-1"));
		const pendingRef = snapshot.pendingRefs[0];
		if (!pendingRef) {
			throw new Error("Expected one pending ref in the base snapshot.");
		}

		const forgedPendingId =
			"pending:v1:en:not-stride:Lexeme:VERB" as V0PendingLemmaId<"en">;
		const forgedSnapshot = {
			...snapshot,
			pendingRefs: [{ ...pendingRef, pendingId: forgedPendingId }],
			pendingRelations: snapshot.pendingRelations.map((relation) => ({
				...relation,
				targetPendingId: forgedPendingId,
			})),
		} satisfies V0AuthoritativeWriteSnapshot<"en">;

		const validation = validateAuthoritativeWriteSnapshot(forgedSnapshot);
		const hydration = hydrateSnapshot(forgedSnapshot);

		expect(validation.isErr()).toBe(true);
		expect(hydration.isErr()).toBe(true);
		if (validation.isErr()) {
			expect(validation.error.code).toBe("InvariantViolation");
		}
	});

	it("deletes owned surfaces, incident relations, and sourced pending refs with lemma deletion", () => {
		const dict = makeDumdict("en");
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
