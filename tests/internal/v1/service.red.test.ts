import { describe, expect, test } from "bun:test";
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
});

