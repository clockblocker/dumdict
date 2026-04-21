import {
	type DumlingId,
	inspectDumlingId,
	type Lemma,
	makeDumlingIdFor,
	type SupportedLang,
} from "../../dumling-compat";
import { err, ok } from "neverthrow";
import { type DumdictResult, makeError } from "../errors";
import type {
	LemmaEntry,
	LexicalRelations,
	MorphologicalRelations,
	PendingLemmaId,
	PendingLemmaRef,
	SurfaceEntry,
} from "../public";
import { lexicalRelationKeys } from "../relations/lexical";
import { morphologicalRelationKeys } from "../relations/morphological";
import type { InternalState } from "../state/state";
import {
	getLemmaCanonicalLemma,
	getLemmaKind,
	getLemmaLanguage,
	getLemmaSubKind,
	getSurfaceLanguage,
	getSurfaceLemma,
	getSurfaceOwnerLemmaId,
} from "./runtime-accessors";

export function inferLemmaIdLanguage(lemmaId: string) {
	const inspectedId = inspectDumlingId(lemmaId);
	return inspectedId?.kind === "Lemma" ? inspectedId.language : undefined;
}

export function inferSurfaceIdLanguage(surfaceId: string) {
	const inspectedId = inspectDumlingId(surfaceId);
	return inspectedId?.kind === "Surface" ? inspectedId.language : undefined;
}

export function inferPendingIdLanguage(pendingId: string) {
	const segments = pendingId.split(":");
	if (segments.length !== 6) {
		return undefined;
	}

	const [prefix0, prefix1, encodedLanguage] = segments;
	if (prefix0 !== "pending" || prefix1 !== "v1" || !encodedLanguage) {
		return undefined;
	}

	try {
		const language = decodeURIComponent(encodedLanguage);

		if (language === "de" || language === "en" || language === "he") {
			return language;
		}
	} catch {
		return undefined;
	}

	return undefined;
}

export function assertLemmaIdMatchesDictionaryLanguage<L extends SupportedLang>(
	language: L,
	id: DumlingId<"Lemma", L>,
): DumdictResult<void> {
	const inferredLanguage = inferLemmaIdLanguage(id);
	if (!inferredLanguage) {
		return err(
			makeError(
				"DecodeFailed",
				`Could not decode lemma ID ${id} as a supported dumling lemma ID.`,
			),
		);
	}

	if (inferredLanguage !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`Lemma ID ${id} belongs to ${inferredLanguage}, not ${language}.`,
			),
		);
	}

	return ok(undefined);
}

export function assertSurfaceIdMatchesDictionaryLanguage<
	L extends SupportedLang,
>(language: L, id: DumlingId<"Surface", L>): DumdictResult<void> {
	const inferredLanguage = inferSurfaceIdLanguage(id);
	if (!inferredLanguage) {
		return err(
			makeError(
				"DecodeFailed",
				`Could not decode surface ID ${id} as a supported dumling surface ID.`,
			),
		);
	}

	if (inferredLanguage !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`Surface ID ${id} belongs to ${inferredLanguage}, not ${language}.`,
			),
		);
	}

	return ok(undefined);
}

export function assertPendingIdMatchesDictionaryLanguage<
	L extends SupportedLang,
>(language: L, id: PendingLemmaId<L>): DumdictResult<void> {
	const inferredLanguage = inferPendingIdLanguage(id);
	if (!inferredLanguage) {
		return err(
			makeError(
				"DecodeFailed",
				`Could not decode pending lemma ID ${id} as a supported dumdict pending ID.`,
			),
		);
	}

	if (inferredLanguage !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`Pending lemma ID ${id} belongs to ${inferredLanguage}, not ${language}.`,
			),
		);
	}

	return ok(undefined);
}

export function validateLemmaEntry<L extends SupportedLang>(
	language: L,
	entry: LemmaEntry<L>,
): DumdictResult<void> {
	if (getLemmaLanguage(entry.lemma) !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`Lemma entry payload language ${getLemmaLanguage(entry.lemma)} does not match ${language}.`,
			),
		);
	}

	const idLanguageResult = assertLemmaIdMatchesDictionaryLanguage(
		language,
		entry.id,
	);
	if (idLanguageResult.isErr()) {
		return idLanguageResult;
	}

	const derivedId = makeDumlingIdFor(language, entry.lemma);
	if (entry.id !== derivedId) {
		return err(
			makeError(
				"InvariantViolation",
				`Lemma entry ID ${entry.id} does not match the Dumling ID derived from its lemma payload.`,
			),
		);
	}

	return ok(undefined);
}

export function validateSurfaceEntry<L extends SupportedLang>(
	language: L,
	entry: SurfaceEntry<L>,
): DumdictResult<void> {
	if (getSurfaceLanguage(entry.surface) !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`Surface entry payload language ${getSurfaceLanguage(entry.surface)} does not match ${language}.`,
			),
		);
	}

	const surfaceIdResult = assertSurfaceIdMatchesDictionaryLanguage(
		language,
		entry.id,
	);
	if (surfaceIdResult.isErr()) {
		return surfaceIdResult;
	}

	const ownerIdResult = assertLemmaIdMatchesDictionaryLanguage(
		language,
		entry.ownerLemmaId,
	);
	if (ownerIdResult.isErr()) {
		return ownerIdResult;
	}

	const derivedSurfaceId = makeDumlingIdFor(language, entry.surface);
	if (entry.id !== derivedSurfaceId) {
		return err(
			makeError(
				"InvariantViolation",
				`Surface entry ID ${entry.id} does not match the Dumling ID derived from its surface payload.`,
			),
		);
	}

	const derivedOwnerLemmaId = getSurfaceOwnerLemmaId(entry.surface);
	if (entry.ownerLemmaId !== derivedOwnerLemmaId) {
		return err(
			makeError(
				"InvalidOwnership",
				`Surface entry owner ${entry.ownerLemmaId} does not match the lemma encoded inside the surface payload.`,
			),
		);
	}

	return ok(undefined);
}

export function validateExistingRelationTarget<L extends SupportedLang>(
	language: L,
	sourceLemmaId: DumlingId<"Lemma", L>,
	targetLemmaId: DumlingId<"Lemma", L>,
	state: InternalState<L>,
): DumdictResult<void> {
	const targetLanguageResult = assertLemmaIdMatchesDictionaryLanguage(
		language,
		targetLemmaId,
	);
	if (targetLanguageResult.isErr()) {
		return targetLanguageResult;
	}

	if (sourceLemmaId === targetLemmaId) {
		return err(
			makeError(
				"SelfRelationForbidden",
				`Lemma ${sourceLemmaId} cannot relate to itself.`,
			),
		);
	}

	if (!state.lemmasById.has(targetLemmaId)) {
		return err(
			makeError(
				"RelationTargetNotFound",
				`Relation target lemma ${targetLemmaId} was not found in ${language} dumdict.`,
			),
		);
	}

	return ok(undefined);
}

export function validateResolvedRelationTargets<L extends SupportedLang>(
	language: L,
	sourceLemmaId: DumlingId<"Lemma", L>,
	lexicalRelations: LexicalRelations<L>,
	morphologicalRelations: MorphologicalRelations<L>,
	state: InternalState<L>,
): DumdictResult<void> {
	for (const relation of lexicalRelationKeys) {
		for (const targetLemmaId of lexicalRelations[relation] ?? []) {
			const relationResult = validateExistingRelationTarget(
				language,
				sourceLemmaId,
				targetLemmaId,
				state,
			);
			if (relationResult.isErr()) {
				return relationResult;
			}
		}
	}

	for (const relation of morphologicalRelationKeys) {
		for (const targetLemmaId of morphologicalRelations[relation] ?? []) {
			const relationResult = validateExistingRelationTarget(
				language,
				sourceLemmaId,
				targetLemmaId,
				state,
			);
			if (relationResult.isErr()) {
				return relationResult;
			}
		}
	}

	return ok(undefined);
}

export function pendingRefMatchesLemma<L extends SupportedLang>(
	pendingRef: PendingLemmaRef<L>,
	lemma: Lemma<L>,
) {
	return pendingRefMatchesLemmaIdentityTuple(pendingRef, lemma);
}

export function pendingRefMatchesLemmaIdentityTuple<L extends SupportedLang>(
	pendingRef: Pick<
		PendingLemmaRef<L>,
		"canonicalLemma" | "lemmaKind" | "lemmaSubKind"
	>,
	lemma: Lemma<L>,
) {
	return (
		pendingRef.canonicalLemma === getLemmaCanonicalLemma(lemma) &&
		pendingRef.lemmaKind === getLemmaKind(lemma) &&
		pendingRef.lemmaSubKind === getLemmaSubKind(lemma)
	);
}
