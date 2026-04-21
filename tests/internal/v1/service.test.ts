import { describe, expect, test } from "bun:test";
import {
	createDumdictService,
	DumdictLanguageMismatchError,
	makeDumlingIdFor,
	type Lemma,
	type DumdictStoragePort,
	type StoreRevision,
} from "../../../src/v1";
import { getBootedUpDumdict } from "../../../src/v1/testing/boot";
import { englishWalkLemmaId, enSerializedNotes } from "../../fixtures/v1/en-notes";

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
