import { describe, expect, test } from "bun:test";
import {
	createDumdictService,
	derivePendingLemmaId,
	DumdictLanguageMismatchError,
	makeDumlingIdFor,
	type Lemma,
	type DumdictStoragePort,
	type SurfaceEntry,
	type StoreRevision,
} from "../../../src/v1";
import { getBootedUpDumdict } from "../../../src/v1/testing/boot";
import {
	englishRunLemmaId,
	englishSwimLemma,
	englishSwimLemmaSurface,
	englishWalkLemmaId,
	enSerializedNotes,
	enSerializedNotesWithPendingSwimRelation,
} from "../../fixtures/v1/en-notes";

describe("v1 configured service", () => {
	test("findStoredLemmaSenses returns stored senses for a coarse lemma description", async () => {
		const { dict } = getBootedUpDumdict("en", enSerializedNotes);

		const result = await dict.findStoredLemmaSenses({
			lemmaDescription: {
				language: "en",
				canonicalLemma: "walk",
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
		});

		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]?.lemmaId).toBe(englishWalkLemmaId);
		expect(result.candidates[0]?.note.attestations).toContain(
			"They walk home together.",
		);
	});

	test("addAttestation appends an attestation to an existing lemma", async () => {
		const { dict, storage } = getBootedUpDumdict("en", enSerializedNotes);

		const result = await dict.addAttestation({
			lemmaId: englishWalkLemmaId,
			attestation: "I walk every morning.",
		});

		expect(result.status).toBe("applied");
		expect(storage.loadAll()[0]?.lemmaEntry.attestations).toContain(
			"I walk every morning.",
		);
	});

	test("addAttestation reports a missing lemma cleanly", async () => {
		const { dict } = getBootedUpDumdict("en", enSerializedNotes);

		const result = await dict.addAttestation({
			lemmaId: englishRunLemmaId,
			attestation: "They run every day.",
		});

		expect(result).toMatchObject({
			status: "rejected",
			code: "lemmaMissing",
		});
	});

	test("addNewNote creates a new lemma note", async () => {
		const { dict, storage } = getBootedUpDumdict("en", enSerializedNotes);

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
			},
		});

		const storedSwimNote = storage
			.loadAll()
			.find(
				({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim",
			)?.lemmaEntry;

		expect(result.status).toBe("applied");
		expect(storedSwimNote?.attestations).toContain(
			"They swim every morning.",
		);
		expect(storedSwimNote?.notes).toBe(
			"Move through water by moving the body.",
		);
	});

	test("addNewNote creates owned surfaces from the draft", async () => {
		const { dict, storage } = getBootedUpDumdict("en", enSerializedNotes);

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
				ownedSurfaces: [
					{
						surface: englishSwimLemmaSurface,
						note: {
							attestedTranslations: ["swim"],
							attestations: ["They swim every morning."],
							notes: "Plain present form.",
						},
					},
				],
			},
		});

		const storedSwimNote = storage
			.loadAll()
			.find(
				({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim",
			);

		expect(result.status).toBe("applied");
		expect(storedSwimNote?.ownedSurfaceEntries).toHaveLength(1);
		expect(
			storedSwimNote?.ownedSurfaceEntries[0]?.surface.normalizedFullSurface,
		).toBe("swim");
		expect(storedSwimNote?.ownedSurfaceEntries[0]?.notes).toBe(
			"Plain present form.",
		);
	});

	test("addNewNote rejects duplicate lemmas", async () => {
		const { dict } = getBootedUpDumdict("en", enSerializedNotes);

		const result = await dict.addNewNote({
			draft: {
				lemma: enSerializedNotes[0]!.lemmaEntry.lemma,
				note: {
					attestedTranslations: ["walk"],
					attestations: ["We walk after dinner."],
					notes: "Duplicate draft.",
				},
			},
		});

		expect(result).toMatchObject({
			status: "rejected",
			code: "lemmaAlreadyExists",
		});
	});

	test("addNewNote rejects existing owned-surface collisions", async () => {
		const existingSurfaceEntry = {
			id: makeDumlingIdFor("en", englishSwimLemmaSurface),
			surface: englishSwimLemmaSurface,
			ownerLemmaId: englishWalkLemmaId,
			attestedTranslations: ["swim"],
			attestations: ["They swim every morning."],
			notes: "Already stored elsewhere.",
		} satisfies SurfaceEntry<"en">;
		let commitCalls = 0;
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				return {
					revision: "stub-1" as StoreRevision,
					existingOwnedSurfaces: [existingSurfaceEntry],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [],
					incomingPendingRelationsForNewLemma: [],
					incomingPendingSourceLemmas: [],
				};
			},
			async commitChanges() {
				commitCalls += 1;
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
				ownedSurfaces: [
					{
						surface: englishSwimLemmaSurface,
						note: {
							attestedTranslations: ["swim"],
							attestations: ["They swim every morning."],
							notes: "Plain present form.",
						},
					},
				],
			},
		});

		expect(result).toMatchObject({
			status: "rejected",
			code: "ownedSurfaceAlreadyExists",
		});
		expect(commitCalls).toBe(0);
	});

	test("addNewNote adds explicit inverse-paired relations to existing lemmas", async () => {
		const { dict, storage } = getBootedUpDumdict("en", enSerializedNotes);

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
				relations: [
					{
						relationFamily: "lexical",
						relation: "nearSynonym",
						target: { kind: "existing", lemmaId: englishWalkLemmaId },
					},
				],
			},
		});

		const storedNotes = storage.loadAll();
		const storedSwim = storedNotes.find(
			({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim",
		)?.lemmaEntry;
		const storedWalk = storedNotes.find(
			({ lemmaEntry }) => lemmaEntry.id === englishWalkLemmaId,
		)?.lemmaEntry;

		expect(result.status).toBe("applied");
		expect(storedSwim?.lexicalRelations.nearSynonym).toContain(
			englishWalkLemmaId,
		);
		expect(storedWalk?.lexicalRelations.nearSynonym).toContain(storedSwim?.id);
	});

	test("addNewNote creates pending refs and pending relations for missing relation targets", async () => {
		const { dict, storage } = getBootedUpDumdict("en", enSerializedNotes);
		const pendingWalkFastId = derivePendingLemmaId({
			language: "en",
			canonicalLemma: "walk fast",
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		});

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
				relations: [
					{
						relationFamily: "lexical",
						relation: "nearSynonym",
						target: {
							kind: "pending",
							ref: {
								canonicalLemma: "walk fast",
								lemmaKind: "Lexeme",
								lemmaSubKind: "VERB",
							},
						},
					},
				],
			},
		});

		const storedSwim = storage
			.loadAll()
			.find(
				({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim",
			);

		expect(result.status).toBe("applied");
		expect(storedSwim?.pendingRefs?.[0]).toMatchObject({
			pendingId: pendingWalkFastId,
			canonicalLemma: "walk fast",
		});
		expect(storedSwim?.lemmaEntry.id).toBeDefined();
		expect(storedSwim?.pendingRelations).toContainEqual({
			sourceLemmaId: storedSwim!.lemmaEntry.id,
			relationFamily: "lexical",
			relation: "nearSynonym",
			targetPendingId: pendingWalkFastId,
		});
	});

	test("addNewNote picks up matching pending refs for the inserted lemma", async () => {
		const { dict, storage } = getBootedUpDumdict(
			"en",
			enSerializedNotesWithPendingSwimRelation,
		);

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
			},
		});

		const storedNotes = storage.loadAll();
		const storedWalk = storedNotes.find(
			({ lemmaEntry }) => lemmaEntry.id === englishWalkLemmaId,
		)?.lemmaEntry;
		const storedSwim = storedNotes.find(
			({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim",
		)?.lemmaEntry;
		const pendingRelations = storedNotes.flatMap(
			({ pendingRelations }) => pendingRelations,
		);
		const pendingRefs = storedNotes.flatMap(({ pendingRefs }) => pendingRefs ?? []);

		expect(result.status).toBe("applied");
		expect(storedWalk?.lexicalRelations.nearSynonym).toContain(storedSwim?.id);
		expect(storedSwim?.lexicalRelations.nearSynonym).toContain(
			englishWalkLemmaId,
		);
		expect(pendingRelations).toHaveLength(0);
		expect(pendingRefs).toHaveLength(0);
	});

	test("findStoredLemmaSenses rejects language mismatch before storage is called", async () => {
		let storageCalls = 0;
		const storage = {
			async findStoredLemmaSenses() {
				storageCalls += 1;
				return { revision: "never" as StoreRevision, candidates: [] };
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				throw new Error("Unexpected storage call");
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;

		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.findStoredLemmaSenses({
				lemmaDescription: {
					language: "de",
					canonicalLemma: "gehen",
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
			} as never),
		).rejects.toThrow(DumdictLanguageMismatchError);

		expect(storageCalls).toBe(0);
	});

	test("addAttestation rejects ID language mismatch before storage is called", async () => {
		const germanGehenLemma = {
			canonicalLemma: "gehen",
			inherentFeatures: {},
			language: "de",
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
			meaningInEmojis: "walk",
		} satisfies Lemma<"de", "Lexeme", "VERB">;
		const germanLemmaId = makeDumlingIdFor("de", germanGehenLemma);
		let storageCalls = 0;
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				storageCalls += 1;
				return { revision: "never" as StoreRevision };
			},
			async loadNewNoteContext() {
				throw new Error("Unexpected storage call");
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;

		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addAttestation({
				lemmaId: germanLemmaId,
				attestation: "Wir gehen nach Hause.",
			} as never),
		).rejects.toThrow(DumdictLanguageMismatchError);

		expect(storageCalls).toBe(0);
	});
});
