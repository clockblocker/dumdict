import { describe, expect, test } from "bun:test";
import {
	createDumdictService,
	DumdictLanguageMismatchError,
	type DumdictStoragePort,
	type Lemma,
	type LemmaEntry,
	makeDumlingIdFor,
	type StoreRevision,
	type SurfaceEntry,
} from "../../../src/v1";
import { derivePendingLemmaId } from "../../../src/v1/core/pending/identity";
import { getBootedUpDumdict } from "../../../src/v1/testing/boot";
import {
	deSerializedNotes,
	germanGehenLemma,
	germanGehenLemmaId,
} from "../../fixtures/v1/de-notes";
import {
	englishRunLemma,
	englishRunLemmaId,
	englishSwimLemma,
	englishSwimLemmaSurface,
	englishWalkLemma,
	englishWalkLemmaId,
	enSerializedNotes,
	enSerializedNotesWithPendingSwimRelation,
	pendingSwimLemmaId,
} from "../../fixtures/v1/en-notes";
import {
	hebrewKatavLemmaId,
	heSerializedNotes,
} from "../../fixtures/v1/he-notes";

describe("v1 configured service", () => {
	const englishWalkEntry = (): LemmaEntry<"en"> => {
		const note = enSerializedNotes[0];
		if (!note) {
			throw new Error("Expected English walk fixture.");
		}
		return note.lemmaEntry;
	};

	const storageRejectingNewNoteContext = () => {
		let loadNewNoteContextCalls = 0;
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				loadNewNoteContextCalls += 1;
				return {
					revision: "never" as StoreRevision,
					existingOwnedSurfaces: [],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [],
					incomingPendingRelationsForNewLemma: [],
					incomingPendingSourceLemmas: [],
				};
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;

		return {
			storage,
			getLoadNewNoteContextCalls: () => loadNewNoteContextCalls,
		};
	};

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

	test("language-specific v1 fixtures boot for German and Hebrew", async () => {
		const { dict: deDict } = getBootedUpDumdict("de", deSerializedNotes);
		const { dict: heDict } = getBootedUpDumdict("he", heSerializedNotes);

		const deResult = await deDict.findStoredLemmaSenses({
			lemmaDescription: {
				language: "de",
				canonicalLemma: "gehen",
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
		});
		const heResult = await heDict.findStoredLemmaSenses({
			lemmaDescription: {
				language: "he",
				canonicalLemma: "כתב",
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
		});

		expect(deResult.candidates[0]?.lemmaId).toBe(germanGehenLemmaId);
		expect(heResult.candidates[0]?.lemmaId).toBe(hebrewKatavLemmaId);
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

	test("addAttestation rejects patch slices for a different lemma", async () => {
		let commitCalls = 0;
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				return {
					revision: "patch-1" as StoreRevision,
					lemma: englishWalkEntry(),
				};
			},
			async loadNewNoteContext() {
				throw new Error("Unexpected storage call");
			},
			async commitChanges() {
				commitCalls += 1;
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addAttestation({
				lemmaId: englishRunLemmaId,
				attestation: "They run every day.",
			}),
		).rejects.toThrow("lemma patch slice");
		expect(commitCalls).toBe(0);
	});

	test("addAttestation reloads patch context instead of using stale lookup revision", async () => {
		let committedBaseRevision: StoreRevision | undefined;
		const storage = {
			async findStoredLemmaSenses() {
				return {
					revision: "lookup-1" as StoreRevision,
					candidates: [{ entry: englishWalkEntry() }],
				};
			},
			async loadLemmaForPatch() {
				return {
					revision: "patch-2" as StoreRevision,
					lemma: englishWalkEntry(),
				};
			},
			async loadNewNoteContext() {
				throw new Error("Unexpected storage call");
			},
			async commitChanges(request) {
				committedBaseRevision = request.baseRevision;
				return {
					status: "committed",
					nextRevision: "patch-3" as StoreRevision,
				};
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		await dict.findStoredLemmaSenses({
			lemmaDescription: {
				language: "en",
				canonicalLemma: "walk",
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
		});
		const result = await dict.addAttestation({
			lemmaId: englishWalkLemmaId,
			attestation: "We walk after dinner.",
		});

		expect(result.status).toBe("applied");
		if (result.status !== "applied") {
			throw new Error("Expected applied attestation result.");
		}
		expect(result.baseRevision).toBe("patch-2");
		expect(committedBaseRevision).toBe("patch-2");
	});

	test("addAttestation surfaces storage conflicts as mutation results", async () => {
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				return {
					revision: "patch-1" as StoreRevision,
					lemma: englishWalkEntry(),
				};
			},
			async loadNewNoteContext() {
				throw new Error("Unexpected storage call");
			},
			async commitChanges() {
				return {
					status: "conflict",
					code: "revisionConflict",
					latestRevision: "patch-2" as StoreRevision,
				};
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		const result = await dict.addAttestation({
			lemmaId: englishWalkLemmaId,
			attestation: "We walk after dinner.",
		});

		expect(result).toMatchObject({
			status: "conflict",
			code: "revisionConflict",
			baseRevision: "patch-1",
			latestRevision: "patch-2",
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
		expect(storedSwimNote?.attestations).toContain("They swim every morning.");
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
			.find(({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim");

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
		const existingWalkNote = enSerializedNotes[0];
		if (!existingWalkNote) {
			throw new Error("Expected English walk fixture.");
		}

		const result = await dict.addNewNote({
			draft: {
				lemma: existingWalkNote.lemmaEntry.lemma,
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
			ownerLemmaId: makeDumlingIdFor("en", englishSwimLemma),
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

	test("addNewNote surfaces insert races as conflicts", async () => {
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				return {
					revision: "new-1" as StoreRevision,
					existingOwnedSurfaces: [],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [],
					incomingPendingRelationsForNewLemma: [],
					incomingPendingSourceLemmas: [],
				};
			},
			async commitChanges() {
				return {
					status: "conflict",
					code: "semanticPreconditionFailed",
					latestRevision: "new-2" as StoreRevision,
					message: "Lemma was inserted concurrently.",
				};
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
			},
		});

		expect(result).toMatchObject({
			status: "conflict",
			code: "semanticPreconditionFailed",
			baseRevision: "new-1",
			latestRevision: "new-2",
		});
	});

	test("in-memory storage does not publish partial commits after a failed precondition", async () => {
		const { storage } = getBootedUpDumdict("en", enSerializedNotes);
		const swimLemmaId = makeDumlingIdFor("en", englishSwimLemma);
		const swimSurfaceId = makeDumlingIdFor("en", englishSwimLemmaSurface);

		const result = await storage.commitChanges({
			baseRevision: "mem-1" as StoreRevision,
			changes: [
				{
					type: "createLemma",
					entry: {
						id: swimLemmaId,
						lemma: englishSwimLemma,
						lexicalRelations: {},
						morphologicalRelations: {},
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Move through water by moving the body.",
					},
					preconditions: [
						{ kind: "revisionMatches", revision: "mem-1" as StoreRevision },
						{ kind: "lemmaMissing", lemmaId: swimLemmaId },
					],
				},
				{
					type: "createOwnedSurface",
					entry: {
						id: swimSurfaceId,
						surface: englishSwimLemmaSurface,
						ownerLemmaId: englishRunLemmaId,
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Plain present form.",
					},
					preconditions: [
						{ kind: "revisionMatches", revision: "mem-1" as StoreRevision },
						{ kind: "lemmaExists", lemmaId: englishRunLemmaId },
						{ kind: "surfaceMissing", surfaceId: swimSurfaceId },
					],
				},
			],
		});

		expect(result).toMatchObject({
			status: "conflict",
			code: "semanticPreconditionFailed",
		});
		expect(
			storage.loadAll().some(({ lemmaEntry }) => lemmaEntry.id === swimLemmaId),
		).toBe(false);
	});

	test("in-memory storage rejects commits based on stale revisions", async () => {
		const { storage } = getBootedUpDumdict("en", enSerializedNotes);

		const firstCommit = await storage.commitChanges({
			baseRevision: "mem-1" as StoreRevision,
			changes: [
				{
					type: "patchLemma",
					lemmaId: englishWalkLemmaId,
					ops: [
						{
							kind: "addAttestation",
							value: "They walk before sunrise.",
						},
					],
					preconditions: [
						{ kind: "revisionMatches", revision: "mem-1" as StoreRevision },
						{ kind: "lemmaExists", lemmaId: englishWalkLemmaId },
						{
							kind: "lemmaAttestationMissing",
							lemmaId: englishWalkLemmaId,
							value: "They walk before sunrise.",
						},
					],
				},
			],
		});

		const staleCommit = await storage.commitChanges({
			baseRevision: "mem-1" as StoreRevision,
			changes: [
				{
					type: "patchLemma",
					lemmaId: englishWalkLemmaId,
					ops: [
						{
							kind: "addAttestation",
							value: "They walk after midnight.",
						},
					],
					preconditions: [
						{ kind: "revisionMatches", revision: "mem-1" as StoreRevision },
						{ kind: "lemmaExists", lemmaId: englishWalkLemmaId },
						{
							kind: "lemmaAttestationMissing",
							lemmaId: englishWalkLemmaId,
							value: "They walk after midnight.",
						},
					],
				},
			],
		});

		expect(firstCommit).toMatchObject({
			status: "committed",
			nextRevision: "mem-2",
		});
		expect(staleCommit).toMatchObject({
			status: "conflict",
			code: "revisionConflict",
			latestRevision: "mem-2",
		});
		expect(storage.loadAll()[0]?.lemmaEntry.attestations).not.toContain(
			"They walk after midnight.",
		);
	});

	test("addNewNote rejects self relations", async () => {
		const { dict } = getBootedUpDumdict("en", enSerializedNotes);

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
							kind: "existing",
							lemmaId: makeDumlingIdFor("en", englishSwimLemma),
						},
					},
				],
			},
		});

		expect(result).toMatchObject({
			status: "rejected",
			code: "selfRelation",
		});
	});

	test("addNewNote rejects pending self relations by dumling identity", async () => {
		const { dict } = getBootedUpDumdict("en", enSerializedNotes);

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
								canonicalLemma: "SWIM",
								lemmaKind: "Lexeme",
								lemmaSubKind: "VERB",
							},
						},
					},
				],
			},
		});

		expect(result).toMatchObject({
			status: "rejected",
			code: "selfRelation",
		});
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
			.find(({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim");

		expect(result.status).toBe("applied");
		if (!storedSwim) {
			throw new Error("Expected stored swim note.");
		}
		expect(storedSwim.pendingRefs?.[0]).toMatchObject({
			pendingId: pendingWalkFastId,
			canonicalLemma: "walk fast",
		});
		expect(storedSwim.lemmaEntry.id).toBeDefined();
		expect(storedSwim.pendingRelations).toContainEqual({
			sourceLemmaId: storedSwim.lemmaEntry.id,
			relationFamily: "lexical",
			relation: "nearSynonym",
			targetPendingId: pendingWalkFastId,
		});
	});

	test("addNewNote dedupes duplicate owned surfaces in one draft", async () => {
		const { dict, storage } = getBootedUpDumdict("en", enSerializedNotes);
		const ownedSurfaceDraft = {
			surface: englishSwimLemmaSurface,
			note: {
				attestedTranslations: ["swim"],
				attestations: ["They swim every morning."],
				notes: "Plain present form.",
			},
		};

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
				ownedSurfaces: [ownedSurfaceDraft, ownedSurfaceDraft],
			},
		});

		const storedSwim = storage
			.loadAll()
			.find(({ lemmaEntry }) => lemmaEntry.lemma.canonicalLemma === "swim");

		expect(result.status).toBe("applied");
		expect(storedSwim?.ownedSurfaceEntries).toHaveLength(1);
	});

	test("addNewNote dedupes duplicate pending relations in one draft", async () => {
		const { dict, storage } = getBootedUpDumdict("en", enSerializedNotes);
		const pendingRelationDraft = {
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
		} as const;

		const result = await dict.addNewNote({
			draft: {
				lemma: englishSwimLemma,
				note: {
					attestedTranslations: ["swim"],
					attestations: ["They swim every morning."],
					notes: "Move through water by moving the body.",
				},
				relations: [pendingRelationDraft, pendingRelationDraft],
			},
		});

		const pendingRelations = storage
			.loadAll()
			.flatMap(({ pendingRelations }) => pendingRelations);

		expect(result.status).toBe("applied");
		expect(pendingRelations).toHaveLength(1);
	});

	test("addNewNote reuses existing pending refs for proposed pending relation targets", async () => {
		const { dict, storage } = getBootedUpDumdict(
			"en",
			enSerializedNotesWithPendingSwimRelation,
		);

		const result = await dict.addNewNote({
			draft: {
				lemma: englishRunLemma,
				note: {
					attestedTranslations: ["run"],
					attestations: ["They run every morning."],
					notes: "Move quickly on foot.",
				},
				relations: [
					{
						relationFamily: "lexical",
						relation: "nearSynonym",
						target: {
							kind: "pending",
							ref: {
								canonicalLemma: "swim",
								lemmaKind: "Lexeme",
								lemmaSubKind: "VERB",
							},
						},
					},
				],
			},
		});

		const storedNotes = storage.loadAll();
		const pendingRelations = storedNotes.flatMap(
			({ pendingRelations }) => pendingRelations,
		);
		const pendingRefs = storedNotes.flatMap(
			({ pendingRefs }) => pendingRefs ?? [],
		);

		expect(result.status).toBe("applied");
		expect(pendingRefs).toHaveLength(2);
		expect(
			pendingRefs.every(({ pendingId }) => pendingId === pendingSwimLemmaId),
		).toBe(true);
		expect(pendingRelations).toContainEqual({
			sourceLemmaId: englishRunLemmaId,
			relationFamily: "lexical",
			relation: "nearSynonym",
			targetPendingId: pendingSwimLemmaId,
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
		const pendingRefs = storedNotes.flatMap(
			({ pendingRefs }) => pendingRefs ?? [],
		);

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

	test("addNewNote rejects existing relation target language mismatch before storage is called", async () => {
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
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				storageCalls += 1;
				return {
					revision: "never" as StoreRevision,
					existingOwnedSurfaces: [],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [],
					incomingPendingRelationsForNewLemma: [],
					incomingPendingSourceLemmas: [],
				};
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
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
							target: { kind: "existing", lemmaId: germanLemmaId },
						},
					],
				},
			} as never),
		).rejects.toThrow(DumdictLanguageMismatchError);

		expect(storageCalls).toBe(0);
	});

	test("findStoredLemmaSenses rejects storage slices with mismatched lemma IDs", async () => {
		const storage = {
			async findStoredLemmaSenses() {
				return {
					revision: "corrupt-1" as StoreRevision,
					candidates: [
						{
							entry: {
								...englishWalkEntry(),
								id: englishRunLemmaId,
							},
						},
					],
				};
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
					language: "en",
					canonicalLemma: "walk",
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
			}),
		).rejects.toThrow("lemma entry id");
	});

	test("findStoredLemmaSenses rejects valid candidates outside the requested lemma description", async () => {
		const storage = {
			async findStoredLemmaSenses() {
				return {
					revision: "corrupt-1" as StoreRevision,
					candidates: [{ entry: englishWalkEntry() }],
				};
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
					language: "en",
					canonicalLemma: "swim",
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
			}),
		).rejects.toThrow("stored lemma sense candidate");
	});

	test("addNewNote rejects storage slices whose existing lemma is not the draft lemma", async () => {
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
					revision: "corrupt-1" as StoreRevision,
					existingLemma: englishWalkEntry(),
					existingOwnedSurfaces: [],
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

		await expect(
			dict.addNewNote({
				draft: {
					lemma: englishSwimLemma,
					note: {
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Move through water by moving the body.",
					},
				},
			}),
		).rejects.toThrow("existing lemma");
		expect(commitCalls).toBe(0);
	});

	test("addNewNote rejects storage slices with inconsistent surface ownership", async () => {
		const corruptSurfaceEntry = {
			id: makeDumlingIdFor("en", englishSwimLemmaSurface),
			surface: englishSwimLemmaSurface,
			ownerLemmaId: englishRunLemmaId,
			attestedTranslations: ["swim"],
			attestations: ["They swim every morning."],
			notes: "Stored with the wrong owner.",
		} satisfies SurfaceEntry<"en">;
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				return {
					revision: "corrupt-1" as StoreRevision,
					existingOwnedSurfaces: [corruptSurfaceEntry],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [],
					incomingPendingRelationsForNewLemma: [],
					incomingPendingSourceLemmas: [],
				};
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
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
			}),
		).rejects.toThrow("surface owner lemma id");
	});

	test("addNewNote rejects storage slices with mismatched pending ref IDs", async () => {
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				return {
					revision: "corrupt-1" as StoreRevision,
					existingOwnedSurfaces: [],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [
						{
							pendingId: pendingSwimLemmaId,
							language: "en",
							canonicalLemma: "walk fast",
							lemmaKind: "Lexeme",
							lemmaSubKind: "VERB",
						},
					],
					matchingPendingRefsForNewLemma: [],
					incomingPendingRelationsForNewLemma: [],
					incomingPendingSourceLemmas: [],
				};
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
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
			}),
		).rejects.toThrow("pending ref id");
	});

	test("addNewNote rejects matching pending refs that do not match the draft lemma identity", async () => {
		const pendingWalkLemmaId = derivePendingLemmaId({
			language: "en",
			canonicalLemma: "walk",
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		});
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
					revision: "corrupt-1" as StoreRevision,
					existingOwnedSurfaces: [],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [
						{
							pendingId: pendingWalkLemmaId,
							language: "en",
							canonicalLemma: "walk",
							lemmaKind: "Lexeme",
							lemmaSubKind: "VERB",
						},
					],
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

		await expect(
			dict.addNewNote({
				draft: {
					lemma: englishSwimLemma,
					note: {
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Move through water by moving the body.",
					},
				},
			}),
		).rejects.toThrow("matching pending ref");
		expect(commitCalls).toBe(0);
	});

	test("addNewNote rejects incoming pending relations for nonmatching pending targets", async () => {
		const pendingWalkLemmaId = derivePendingLemmaId({
			language: "en",
			canonicalLemma: "walk",
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		});
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
					revision: "corrupt-1" as StoreRevision,
					existingOwnedSurfaces: [],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [
						{
							pendingId: pendingWalkLemmaId,
							language: "en",
							canonicalLemma: "walk",
							lemmaKind: "Lexeme",
							lemmaSubKind: "VERB",
						},
					],
					incomingPendingRelationsForNewLemma: [
						{
							sourceLemmaId: englishWalkLemmaId,
							relationFamily: "lexical",
							relation: "nearSynonym",
							targetPendingId: pendingWalkLemmaId,
						},
					],
					incomingPendingSourceLemmas: [
						{
							id: englishWalkLemmaId,
							lemma: englishWalkLemma,
							lexicalRelations: {},
							morphologicalRelations: {},
							attestedTranslations: ["walk"],
							attestations: ["They walk home together."],
							notes:
								"Move at a regular pace by lifting and setting down each foot.",
						},
					],
				};
			},
			async commitChanges() {
				commitCalls += 1;
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
				draft: {
					lemma: englishSwimLemma,
					note: {
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Move through water by moving the body.",
					},
				},
			}),
		).rejects.toThrow("incoming pending relation target");
		expect(commitCalls).toBe(0);
	});

	test("addNewNote rejects incoming pending relations without source lemmas", async () => {
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				return {
					revision: "corrupt-1" as StoreRevision,
					existingOwnedSurfaces: [],
					explicitExistingRelationTargets: [],
					existingPendingRefsForProposedPendingTargets: [],
					matchingPendingRefsForNewLemma: [
						{
							pendingId: pendingSwimLemmaId,
							language: "en",
							canonicalLemma: "swim",
							lemmaKind: "Lexeme",
							lemmaSubKind: "VERB",
						},
					],
					incomingPendingRelationsForNewLemma: [
						{
							sourceLemmaId: englishWalkLemmaId,
							relationFamily: "lexical",
							relation: "nearSynonym",
							targetPendingId: pendingSwimLemmaId,
						},
					],
					incomingPendingSourceLemmas: [],
				};
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		} satisfies DumdictStoragePort<"en">;
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
				draft: {
					lemma: englishSwimLemma,
					note: {
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Move through water by moving the body.",
					},
				},
			}),
		).rejects.toThrow("incoming pending relation source lemma");
	});

	test("addNewNote rejects draft lemma language mismatch before storage is called", async () => {
		const { storage, getLoadNewNoteContextCalls } =
			storageRejectingNewNoteContext();
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
				draft: {
					lemma: germanGehenLemma,
					note: {
						attestedTranslations: ["go", "walk"],
						attestations: ["Wir gehen nach Hause."],
						notes: "Move on foot or go somewhere.",
					},
				},
			} as never),
		).rejects.toThrow(DumdictLanguageMismatchError);

		expect(getLoadNewNoteContextCalls()).toBe(0);
	});

	test("addNewNote rejects owned-surface language mismatch before storage is called", async () => {
		const { storage, getLoadNewNoteContextCalls } =
			storageRejectingNewNoteContext();
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
				draft: {
					lemma: englishSwimLemma,
					note: {
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Move through water by moving the body.",
					},
					ownedSurfaces: [
						{
							surface: {
								...englishSwimLemmaSurface,
								language: "de",
							},
							note: {
								attestedTranslations: ["swim"],
								attestations: ["They swim every morning."],
								notes: "Plain present form.",
							},
						},
					],
				},
			} as never),
		).rejects.toThrow(DumdictLanguageMismatchError);

		expect(getLoadNewNoteContextCalls()).toBe(0);
	});

	test("addNewNote rejects owned surfaces for a different same-language lemma before storage is called", async () => {
		const { storage, getLoadNewNoteContextCalls } =
			storageRejectingNewNoteContext();
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
						surface: {
							...englishSwimLemmaSurface,
							lemma: englishRunLemma,
						},
						note: {
							attestedTranslations: ["swim"],
							attestations: ["They swim every morning."],
							notes: "Surface belongs to a different lemma.",
						},
					},
				],
			},
		});

		expect(result).toMatchObject({
			status: "rejected",
			code: "invalidDraft",
		});
		expect(getLoadNewNoteContextCalls()).toBe(0);
	});

	test("addNewNote rejects owned-surface lemma language mismatch before storage is called", async () => {
		const { storage, getLoadNewNoteContextCalls } =
			storageRejectingNewNoteContext();
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.addNewNote({
				draft: {
					lemma: englishSwimLemma,
					note: {
						attestedTranslations: ["swim"],
						attestations: ["They swim every morning."],
						notes: "Move through water by moving the body.",
					},
					ownedSurfaces: [
						{
							surface: {
								language: "en",
								lemma: germanGehenLemma,
								normalizedFullSurface: "gehen",
								surfaceKind: "Lemma",
							},
							note: {
								attestedTranslations: ["go", "walk"],
								attestations: ["Wir gehen nach Hause."],
								notes: "Lemma-form surface with mismatched embedded lemma.",
							},
						},
					],
				},
			} as never),
		).rejects.toThrow(DumdictLanguageMismatchError);

		expect(getLoadNewNoteContextCalls()).toBe(0);
	});
});
