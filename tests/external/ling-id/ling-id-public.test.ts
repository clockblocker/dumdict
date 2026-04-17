import { describe, expect, it } from "bun:test";
import {
	dumling,
	type KnownSelection,
	type Lemma,
	type UnresolvedSurface,
} from "dumling";
import {
	englishGiveUpTypoPartialGvaeSelection,
	englishGiveUpTypoPartialUpSelection,
	englishWalkLemma,
	englishWalkResolvedInflectionSurface,
	englishWalkStandardFullSelection,
	englishWalkUnresolvedInflectionSurface,
	germanMasculineSeeLemma,
} from "../../helpers";

const { idCodec: DumlingIdCodec, operation: lingOperation } = dumling;

describe("DumlingIdCodec", () => {
	it("encodes and decodes each concrete entity kind", () => {
		const lemma = englishWalkLemma;
		const resolvedSurface = englishWalkResolvedInflectionSurface;
		const unresolvedSurface = englishWalkUnresolvedInflectionSurface;
		const selection = englishWalkStandardFullSelection;

		const lemmaId = DumlingIdCodec.English.makeDumlingIdFor(lemma);
		const resolvedId = DumlingIdCodec.English.makeDumlingIdFor(resolvedSurface);
		const unresolvedId =
			DumlingIdCodec.English.makeDumlingIdFor(unresolvedSurface);
		const selectionId = DumlingIdCodec.English.makeDumlingIdFor(selection);

		expect(lemmaId.startsWith("ling:v1:EN:LEM;")).toBe(true);
		expect(resolvedId.startsWith("ling:v1:EN:SURF-RES;")).toBe(true);
		expect(unresolvedId.startsWith("ling:v1:EN:SURF-UNRES;")).toBe(true);
		expect(selectionId.startsWith("ling:v1:EN:SEL;")).toBe(true);

		const decodedLemma = DumlingIdCodec.English.tryToDecodeAs(
			"Lemma",
			lemmaId,
		);
		const decodedResolved = DumlingIdCodec.English.tryToDecodeAs(
			"ResolvedSurface",
			resolvedId,
		);
		const decodedUnresolved = DumlingIdCodec.English.tryToDecodeAs(
			"UnresolvedSurface",
			unresolvedId,
		);
		const decodedSelection = DumlingIdCodec.English.tryToDecodeAs(
			"Selection",
			selectionId,
		);

		expect(decodedLemma.isOk()).toBe(true);
		expect(decodedResolved.isOk()).toBe(true);
		expect(decodedUnresolved.isOk()).toBe(true);
		expect(decodedSelection.isOk()).toBe(true);
		expect(decodedLemma._unsafeUnwrap()).toEqual(lemma);
		expect(decodedResolved._unsafeUnwrap()).toEqual(resolvedSurface);
		expect(decodedUnresolved._unsafeUnwrap()).toEqual(unresolvedSurface);
		expect(decodedSelection._unsafeUnwrap()).toEqual(selection);
		expect(decodedSelection._unsafeUnwrap().orthographicStatus).not.toBe(
			"Unknown",
		);
	});

	it("rejects unknown selections at runtime", () => {
		const unknownSelection = {
			language: "English",
			orthographicStatus: "Unknown",
			spelledSelection: "wlk",
		};

		expect(() =>
			DumlingIdCodec.English.makeDumlingIdFor(
				unknownSelection as unknown as KnownSelection<"English">,
			),
		).toThrow("Unknown selections cannot be encoded as Dumling IDs");
	});

	it("returns structured errors for malformed ids and language mismatch", () => {
		const malformed = DumlingIdCodec.English.tryToDecode("not-a-ling-id");
		const germanLemmaId = DumlingIdCodec.German.makeDumlingIdFor(
			germanMasculineSeeLemma satisfies Lemma<"German", "Lexeme", "NOUN">,
		);
		const mismatch = DumlingIdCodec.English.tryToDecode(germanLemmaId);

		expect(malformed.isErr()).toBe(true);
		expect(malformed._unsafeUnwrapErr().code).toBe("MalformedDumlingId");
		expect(mismatch.isErr()).toBe(true);
		expect(mismatch._unsafeUnwrapErr().code).toBe("LanguageMismatch");
	});

	it("returns entity mismatch for kind-specific decode requests", () => {
		const resolvedId = DumlingIdCodec.English.makeDumlingIdFor(
			englishWalkResolvedInflectionSurface,
		);

		const mismatch = DumlingIdCodec.English.tryToDecodeAs("Lemma", resolvedId);

		expect(mismatch.isErr()).toBe(true);
		expect(mismatch._unsafeUnwrapErr().code).toBe("EntityMismatch");
	});

	it("serializes feature bags canonically", () => {
		const left = {
			...englishWalkUnresolvedInflectionSurface,
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
		} satisfies UnresolvedSurface<
			"English",
			"Standard",
			"Inflection",
			"Lexeme",
			"VERB"
		>;
		const right = {
			...englishWalkUnresolvedInflectionSurface,
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
		} satisfies UnresolvedSurface<
			"English",
			"Standard",
			"Inflection",
			"Lexeme",
			"VERB"
		>;

		expect(DumlingIdCodec.English.makeDumlingIdFor(left)).toBe(
			DumlingIdCodec.English.makeDumlingIdFor(right),
		);
	});

	it("keeps partial typo selections distinct while preserving shared surface identity", () => {
		const upSelection = englishGiveUpTypoPartialUpSelection;
		const gvaeSelection = englishGiveUpTypoPartialGvaeSelection;

		const upSelectionId = DumlingIdCodec.English.makeDumlingIdFor(upSelection);
		const gvaeSelectionId =
			DumlingIdCodec.English.makeDumlingIdFor(gvaeSelection);

		expect(upSelectionId).not.toBe(gvaeSelectionId);

		const upSurface =
			lingOperation.extract.surface.fromSelection(upSelection);
		const gvaeSurface =
			lingOperation.extract.surface.fromSelection(gvaeSelection);

		expect(DumlingIdCodec.English.makeDumlingIdFor(upSurface)).toBe(
			DumlingIdCodec.English.makeDumlingIdFor(gvaeSurface),
		);
	});

	it("keeps canonical and variant selections distinct in Dumling IDs", () => {
		const canonicalSelection = englishWalkStandardFullSelection;
		const variantSelection = {
			...englishWalkStandardFullSelection,
			spelledSelection: "walk",
			spellingRelation: "Variant" as const,
		};

		const canonicalId =
			DumlingIdCodec.English.makeDumlingIdFor(canonicalSelection);
		const variantId = DumlingIdCodec.English.makeDumlingIdFor(variantSelection);

		expect(canonicalId).not.toBe(variantId);
		expect(
			DumlingIdCodec.English.tryToDecodeAs(
				"Selection",
				variantId,
			)._unsafeUnwrap().spellingRelation,
		).toBe("Variant");
	});
});
