import {
	type V0DumlingId,
	inspectDumlingId,
	type V0Lemma,
	makeDumlingIdFor,
	type V0SupportedLang,
} from "../../dumling-compat";
import { err, ok } from "neverthrow";
import { type V0DumdictResult, makeError } from "../errors";
import type {
	V0LemmaEntry,
	V0LexicalRelations,
	V0MorphologicalRelations,
	V0PendingLemmaId,
	V0PendingLemmaRef,
	V0SurfaceEntry,
} from "../public";
import { v0LexicalRelationKeys } from "../relations/lexical";
import { v0MorphologicalRelationKeys } from "../relations/morphological";
import type { V0InternalState } from "../state/state";
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

export function assertLemmaIdMatchesDictionaryLanguage<L extends V0SupportedLang>(
	language: L,
	id: V0DumlingId<"Lemma", L>,
): V0DumdictResult<void> {
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
				`V0Lemma ID ${id} belongs to ${inferredLanguage}, not ${language}.`,
			),
		);
	}

	return ok(undefined);
}

export function assertSurfaceIdMatchesDictionaryLanguage<
	L extends V0SupportedLang,
>(language: L, id: V0DumlingId<"Surface", L>): V0DumdictResult<void> {
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
				`V0Surface ID ${id} belongs to ${inferredLanguage}, not ${language}.`,
			),
		);
	}

	return ok(undefined);
}

export function assertPendingIdMatchesDictionaryLanguage<
	L extends V0SupportedLang,
>(language: L, id: V0PendingLemmaId<L>): V0DumdictResult<void> {
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

export function validateLemmaEntry<L extends V0SupportedLang>(
	language: L,
	entry: V0LemmaEntry<L>,
): V0DumdictResult<void> {
	if (getLemmaLanguage(entry.lemma) !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`V0Lemma entry payload language ${getLemmaLanguage(entry.lemma)} does not match ${language}.`,
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
				`V0Lemma entry ID ${entry.id} does not match the Dumling ID derived from its lemma payload.`,
			),
		);
	}

	return ok(undefined);
}

export function validateSurfaceEntry<L extends V0SupportedLang>(
	language: L,
	entry: V0SurfaceEntry<L>,
): V0DumdictResult<void> {
	if (getSurfaceLanguage(entry.surface) !== language) {
		return err(
			makeError(
				"LanguageMismatch",
				`V0Surface entry payload language ${getSurfaceLanguage(entry.surface)} does not match ${language}.`,
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
				`V0Surface entry ID ${entry.id} does not match the Dumling ID derived from its surface payload.`,
			),
		);
	}

	const derivedOwnerLemmaId = getSurfaceOwnerLemmaId(entry.surface);
	if (entry.ownerLemmaId !== derivedOwnerLemmaId) {
		return err(
			makeError(
				"InvalidOwnership",
				`V0Surface entry owner ${entry.ownerLemmaId} does not match the lemma encoded inside the surface payload.`,
			),
		);
	}

	return ok(undefined);
}

export function validateExistingRelationTarget<L extends V0SupportedLang>(
	language: L,
	sourceLemmaId: V0DumlingId<"Lemma", L>,
	targetLemmaId: V0DumlingId<"Lemma", L>,
	state: V0InternalState<L>,
): V0DumdictResult<void> {
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
				`V0Lemma ${sourceLemmaId} cannot relate to itself.`,
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

export function validateResolvedRelationTargets<L extends V0SupportedLang>(
	language: L,
	sourceLemmaId: V0DumlingId<"Lemma", L>,
	lexicalRelations: V0LexicalRelations<L>,
	morphologicalRelations: V0MorphologicalRelations<L>,
	state: V0InternalState<L>,
): V0DumdictResult<void> {
	for (const relation of v0LexicalRelationKeys) {
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

	for (const relation of v0MorphologicalRelationKeys) {
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

export function pendingRefMatchesLemma<L extends V0SupportedLang>(
	pendingRef: V0PendingLemmaRef<L>,
	lemma: V0Lemma<L>,
) {
	return pendingRefMatchesLemmaIdentityTuple(pendingRef, lemma);
}

export function pendingRefMatchesLemmaIdentityTuple<L extends V0SupportedLang>(
	pendingRef: Pick<
		V0PendingLemmaRef<L>,
		"canonicalLemma" | "lemmaKind" | "lemmaSubKind"
	>,
	lemma: V0Lemma<L>,
) {
	return (
		pendingRef.canonicalLemma === getLemmaCanonicalLemma(lemma) &&
		pendingRef.lemmaKind === getLemmaKind(lemma) &&
		pendingRef.lemmaSubKind === getLemmaSubKind(lemma)
	);
}
