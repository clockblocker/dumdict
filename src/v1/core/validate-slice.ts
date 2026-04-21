import type {
	LemmaEntry,
	PendingLemmaRef,
	PendingLemmaRelation,
	SurfaceEntry,
} from "../dto";
import {
	inspectDumlingId,
	type DumlingId,
	type SupportedLanguage,
} from "../dumling";
import { DumdictLanguageMismatchError } from "../public";
import type {
	LemmaPatchSlice,
	NewNoteSlice,
	StoredLemmaSensesSlice,
} from "../storage";

function assertLanguage(
	expectedLanguage: SupportedLanguage,
	actualLanguage: SupportedLanguage | undefined,
) {
	if (actualLanguage !== expectedLanguage) {
		throw new DumdictLanguageMismatchError({
			expectedLanguage,
			actualLanguage,
		});
	}
}

function assertIdLanguage(
	expectedLanguage: SupportedLanguage,
	id: DumlingId | string,
) {
	assertLanguage(expectedLanguage, inspectDumlingId(id)?.language);
}

function validateLemmaEntry<L extends SupportedLanguage>(
	expectedLanguage: L,
	entry: LemmaEntry<L>,
) {
	assertLanguage(expectedLanguage, entry.lemma.language);
	assertIdLanguage(expectedLanguage, entry.id);
	for (const targetIds of Object.values(entry.lexicalRelations)) {
		for (const targetId of targetIds ?? []) {
			assertIdLanguage(expectedLanguage, targetId);
		}
	}
	for (const targetIds of Object.values(entry.morphologicalRelations)) {
		for (const targetId of targetIds ?? []) {
			assertIdLanguage(expectedLanguage, targetId);
		}
	}
}

function validateSurfaceEntry<L extends SupportedLanguage>(
	expectedLanguage: L,
	entry: SurfaceEntry<L>,
) {
	assertLanguage(expectedLanguage, entry.surface.language);
	assertLanguage(expectedLanguage, entry.surface.lemma.language);
	assertIdLanguage(expectedLanguage, entry.id);
	assertIdLanguage(expectedLanguage, entry.ownerLemmaId);
}

function validatePendingRef<L extends SupportedLanguage>(
	expectedLanguage: L,
	ref: PendingLemmaRef<L>,
) {
	assertLanguage(expectedLanguage, ref.language);
}

function validatePendingRelation<L extends SupportedLanguage>(
	expectedLanguage: L,
	relation: PendingLemmaRelation<L>,
) {
	assertIdLanguage(expectedLanguage, relation.sourceLemmaId);
}

export function validateStoredLemmaSensesSlice<L extends SupportedLanguage>(
	expectedLanguage: L,
	slice: StoredLemmaSensesSlice<L>,
) {
	for (const candidate of slice.candidates) {
		validateLemmaEntry(expectedLanguage, candidate.entry);
	}
}

export function validateLemmaPatchSlice<L extends SupportedLanguage>(
	expectedLanguage: L,
	slice: LemmaPatchSlice<L>,
) {
	if (slice.lemma) {
		validateLemmaEntry(expectedLanguage, slice.lemma);
	}
}

export function validateNewNoteSlice<L extends SupportedLanguage>(
	expectedLanguage: L,
	slice: NewNoteSlice<L>,
) {
	if (slice.existingLemma) {
		validateLemmaEntry(expectedLanguage, slice.existingLemma);
	}
	for (const entry of slice.existingOwnedSurfaces) {
		validateSurfaceEntry(expectedLanguage, entry);
	}
	for (const entry of slice.explicitExistingRelationTargets) {
		validateLemmaEntry(expectedLanguage, entry);
	}
	for (const ref of slice.existingPendingRefsForProposedPendingTargets) {
		validatePendingRef(expectedLanguage, ref);
	}
	for (const ref of slice.matchingPendingRefsForNewLemma) {
		validatePendingRef(expectedLanguage, ref);
	}
	for (const relation of slice.incomingPendingRelationsForNewLemma) {
		validatePendingRelation(expectedLanguage, relation);
	}
	for (const entry of slice.incomingPendingSourceLemmas) {
		validateLemmaEntry(expectedLanguage, entry);
	}
}
