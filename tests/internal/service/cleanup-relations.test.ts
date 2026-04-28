import { describe, expect, test } from "bun:test";
import type { Lemma } from "../../../src";
import type { SerializedDictionaryNote } from "../../../src/testing/serialized-note";
import {
	createDumdictService,
	englishRunLemma,
	englishRunLemmaId,
	englishSwimLemma,
	englishWalkLemmaId,
	enSerializedNotesWithPendingSwimRelation,
	getBootedUpDumdict,
	makeDumlingIdFor,
	type StoreRevision,
	withUnusedCleanupStorageMethods,
} from "./helpers";

function serializedNote(
	lemma: Lemma<"en">,
	note: {
		attestedTranslations: string[];
		attestations: string[];
		notes: string;
	},
): SerializedDictionaryNote<"en"> {
	return {
		lemmaEntry: {
			id: makeDumlingIdFor("en", lemma),
			lemma,
			lexicalRelations: {},
			morphologicalRelations: {},
			...note,
		},
		ownedSurfaceEntries: [],
		pendingRelations: [],
	};
}

describe("configured service", () => {
	test("getInfoForRelationsCleanup returns a thin cleanup workset for one spelling", async () => {
		const swimId = makeDumlingIdFor("en", englishSwimLemma);
		const { dict } = getBootedUpDumdict("en", [
			...enSerializedNotesWithPendingSwimRelation,
			serializedNote(englishSwimLemma, {
				attestedTranslations: ["swim"],
				attestations: ["They swim every morning."],
				notes: "Move through water by moving the body.",
			}),
		]);

		const result = await dict.getInfoForRelationsCleanup({
			canonicalLemma: "swim",
		});

		expect(result.canonicalLemma).toBe("swim");
		expect(result.candidateLemmaIds).toEqual([swimId]);
		expect(result.pendingRelations).toHaveLength(1);
		expect(result.pendingRelations[0]).toMatchObject({
			sourceLemmaId: englishWalkLemmaId,
			relation: "nearSynonym",
			pendingRef: {
				canonicalLemma: "swim",
			},
		});
	});

	test("getInfoForRelationsCleanup rejects malformed storage that duplicates one pending ref ID", async () => {
		const storage = {
			async findStoredLemmaSenses() {
				throw new Error("Unexpected storage call");
			},
			async getInfoForRelationsCleanup() {
				const note = enSerializedNotesWithPendingSwimRelation[0];
				if (!note?.pendingRefs?.[0] || !note.pendingRelations[0]) {
					throw new Error("Expected pending swim fixture.");
				}
				return {
					revision: "cleanup-1" as StoreRevision,
					canonicalLemma: "swim",
					candidateLemmas: [],
					pendingRefs: [note.pendingRefs[0], note.pendingRefs[0]],
					pendingRelations: [note.pendingRelations[0]],
				};
			},
			async loadLemmaForPatch() {
				throw new Error("Unexpected storage call");
			},
			async loadNewNoteContext() {
				throw new Error("Unexpected storage call");
			},
			async loadCleanupRelationsContext() {
				throw new Error("Unexpected storage call");
			},
			async commitChanges() {
				throw new Error("Unexpected storage call");
			},
		};
		const dict = createDumdictService({ language: "en", storage });

		await expect(
			dict.getInfoForRelationsCleanup({ canonicalLemma: "swim" }),
		).rejects.toThrow("contains duplicates");
	});

	test("cleanupRelations returns an applied no-op without touching storage", async () => {
		let loadCleanupCalls = 0;
		let commitCalls = 0;
		const storage = {
			...withUnusedCleanupStorageMethods({
				async findStoredLemmaSenses() {
					throw new Error("Unexpected storage call");
				},
				async loadLemmaForPatch() {
					throw new Error("Unexpected storage call");
				},
				async loadNewNoteContext() {
					throw new Error("Unexpected storage call");
				},
				async commitChanges() {
					commitCalls += 1;
					throw new Error("Unexpected storage call");
				},
			}),
			async loadCleanupRelationsContext() {
				loadCleanupCalls += 1;
				throw new Error("Unexpected storage call");
			},
		};
		const dict = createDumdictService({ language: "en", storage });

		const result = await dict.cleanupRelations({
			baseRevision: "cleanup-1" as StoreRevision,
			resolutions: [],
		});

		expect(result).toMatchObject({
			status: "applied",
			baseRevision: "cleanup-1",
			nextRevision: "cleanup-1",
			summary: { message: "No relations cleaned up." },
		});
		expect(loadCleanupCalls).toBe(0);
		expect(commitCalls).toBe(0);
	});

	test("cleanupRelations resolves a pending relation into inverse-paired full relations", async () => {
		const swimId = makeDumlingIdFor("en", englishSwimLemma);
		const { dict, storage } = getBootedUpDumdict("en", [
			...enSerializedNotesWithPendingSwimRelation,
			serializedNote(englishSwimLemma, {
				attestedTranslations: ["swim"],
				attestations: ["They swim every morning."],
				notes: "Move through water by moving the body.",
			}),
		]);

		const info = await dict.getInfoForRelationsCleanup({
			canonicalLemma: "swim",
		});
		const result = await dict.cleanupRelations({
			baseRevision: info.revision,
			resolutions: [
				{
					sourceLemmaId: englishWalkLemmaId,
					relation: "nearSynonym",
					targetPendingId: info.pendingRelations[0]!.pendingRef.pendingId,
					targetLemmaId: swimId,
				},
			],
		});

		const storedWalk = storage
			.loadAll()
			.find(({ lemmaEntry }) => lemmaEntry.id === englishWalkLemmaId)?.lemmaEntry;
		const storedSwim = storage
			.loadAll()
			.find(({ lemmaEntry }) => lemmaEntry.id === swimId)?.lemmaEntry;

		expect(result.status).toBe("applied");
		expect(storedWalk?.lexicalRelations.nearSynonym).toContain(swimId);
		expect(storedSwim?.lexicalRelations.nearSynonym).toContain(
			englishWalkLemmaId,
		);
		expect(storage.loadAll().flatMap(({ pendingRelations }) => pendingRelations)).toHaveLength(0);
		expect(
			storage.loadAll().flatMap(({ pendingRefs }) => pendingRefs ?? []),
		).toHaveLength(0);
	});

	test("cleanupRelations can drop a pending relation without creating a real relation", async () => {
		const { dict, storage } = getBootedUpDumdict(
			"en",
			enSerializedNotesWithPendingSwimRelation,
		);

		const info = await dict.getInfoForRelationsCleanup({
			canonicalLemma: "swim",
		});
		const result = await dict.cleanupRelations({
			baseRevision: info.revision,
			resolutions: [
				{
					sourceLemmaId: englishWalkLemmaId,
					relation: "nearSynonym",
					targetPendingId: info.pendingRelations[0]!.pendingRef.pendingId,
				},
			],
		});

		const storedWalk = storage
			.loadAll()
			.find(({ lemmaEntry }) => lemmaEntry.id === englishWalkLemmaId)?.lemmaEntry;

		expect(result.status).toBe("applied");
		expect(storedWalk?.lexicalRelations.nearSynonym ?? []).toHaveLength(0);
		expect(storage.loadAll().flatMap(({ pendingRelations }) => pendingRelations)).toHaveLength(0);
	});

	test("cleanupRelations rejects a target lemma that does not match the pending ref identity", async () => {
		const { dict } = getBootedUpDumdict("en", [
			...enSerializedNotesWithPendingSwimRelation,
			serializedNote(englishRunLemma, {
				attestedTranslations: ["run"],
				attestations: ["They run every day."],
				notes: "Move quickly on foot.",
			}),
		]);

		const info = await dict.getInfoForRelationsCleanup({
			canonicalLemma: "swim",
		});
		const result = await dict.cleanupRelations({
			baseRevision: info.revision,
			resolutions: [
				{
					sourceLemmaId: englishWalkLemmaId,
					relation: "nearSynonym",
					targetPendingId: info.pendingRelations[0]!.pendingRef.pendingId,
					targetLemmaId: englishRunLemmaId,
				},
			],
		});

		expect(result).toMatchObject({
			status: "rejected",
			code: "invalidRequest",
		});
	});

	test("cleanupRelations conflicts on a stale base revision", async () => {
		const swimId = makeDumlingIdFor("en", englishSwimLemma);
		const { dict } = getBootedUpDumdict("en", [
			...enSerializedNotesWithPendingSwimRelation,
			serializedNote(englishSwimLemma, {
				attestedTranslations: ["swim"],
				attestations: ["They swim every morning."],
				notes: "Move through water by moving the body.",
			}),
		]);

		const info = await dict.getInfoForRelationsCleanup({
			canonicalLemma: "swim",
		});
		await dict.addAttestation({
			lemmaId: swimId,
			attestation: "Swim laps before breakfast.",
		});

		const result = await dict.cleanupRelations({
			baseRevision: info.revision,
			resolutions: [
				{
					sourceLemmaId: englishWalkLemmaId,
					relation: "nearSynonym",
					targetPendingId: info.pendingRelations[0]!.pendingRef.pendingId,
					targetLemmaId: swimId,
				},
			],
		});

		expect(result).toMatchObject({
			status: "conflict",
			code: "revisionConflict",
			baseRevision: info.revision,
		});
	});
});
