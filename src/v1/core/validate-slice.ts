import type {
	LemmaEntry,
	PendingLemmaRef,
	PendingLemmaRelation,
	SurfaceEntry,
} from "../dto";
import {
	type DumlingEntityKind,
	type DumlingId,
	inspectDumlingId,
	type Lemma,
	makeDumlingIdFor,
	type SupportedLanguage,
} from "../dumling";
import { DumdictLanguageMismatchError } from "../public";
import type {
	LemmaPatchSlice,
	NewNoteSlice,
	StoredLemmaSensesSlice,
} from "../storage";
import { derivePendingLemmaId } from "./pending/identity";

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

function assertDumlingId(
	expectedLanguage: SupportedLanguage,
	expectedKind: DumlingEntityKind,
	id: DumlingId | string,
	context: string,
) {
	const inspected = inspectDumlingId(id);
	assertLanguage(expectedLanguage, inspected?.language);
	if (inspected?.kind !== expectedKind) {
		throw new Error(`${context} must be a ${expectedKind} id.`);
	}
}

function assertEqualId(actual: string, expected: string, context: string) {
	if (actual !== expected) {
		throw new Error(`${context} does not match its derived id.`);
	}
}

function validateLemmaEntry<L extends SupportedLanguage>(
	expectedLanguage: L,
	entry: LemmaEntry<L>,
) {
	assertLanguage(expectedLanguage, entry.lemma.language);
	assertDumlingId(expectedLanguage, "Lemma", entry.id, "lemma entry id");
	assertEqualId(
		entry.id,
		makeDumlingIdFor(expectedLanguage, entry.lemma),
		"lemma entry id",
	);
	for (const targetIds of Object.values(entry.lexicalRelations)) {
		for (const targetId of targetIds ?? []) {
			assertDumlingId(
				expectedLanguage,
				"Lemma",
				targetId,
				"lexical relation target id",
			);
		}
	}
	for (const targetIds of Object.values(entry.morphologicalRelations)) {
		for (const targetId of targetIds ?? []) {
			assertDumlingId(
				expectedLanguage,
				"Lemma",
				targetId,
				"morphological relation target id",
			);
		}
	}
}

function validateSurfaceEntry<L extends SupportedLanguage>(
	expectedLanguage: L,
	entry: SurfaceEntry<L>,
) {
	assertLanguage(expectedLanguage, entry.surface.language);
	assertLanguage(expectedLanguage, entry.surface.lemma.language);
	assertDumlingId(expectedLanguage, "Surface", entry.id, "surface entry id");
	assertDumlingId(
		expectedLanguage,
		"Lemma",
		entry.ownerLemmaId,
		"surface owner lemma id",
	);
	assertEqualId(
		entry.id,
		makeDumlingIdFor(expectedLanguage, entry.surface),
		"surface entry id",
	);
	assertEqualId(
		entry.ownerLemmaId,
		makeDumlingIdFor(
			expectedLanguage,
			entry.surface.lemma as unknown as Lemma<L>,
		),
		"surface owner lemma id",
	);
}

function validatePendingRef<L extends SupportedLanguage>(
	expectedLanguage: L,
	ref: PendingLemmaRef<L>,
) {
	assertLanguage(expectedLanguage, ref.language);
	assertEqualId(ref.pendingId, derivePendingLemmaId(ref), "pending ref id");
}

function validatePendingRelation<L extends SupportedLanguage>(
	expectedLanguage: L,
	relation: PendingLemmaRelation<L>,
) {
	assertDumlingId(
		expectedLanguage,
		"Lemma",
		relation.sourceLemmaId,
		"pending relation source lemma id",
	);
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
	requestedLemmaId?: DumlingId<"Lemma", L>,
) {
	if (slice.lemma) {
		validateLemmaEntry(expectedLanguage, slice.lemma);
		if (requestedLemmaId && slice.lemma.id !== requestedLemmaId) {
			throw new Error(
				"lemma patch slice lemma id does not match the requested lemma id.",
			);
		}
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

	const incomingSourceLemmaIds = new Set(
		slice.incomingPendingSourceLemmas.map(({ id }) => id),
	);
	for (const relation of slice.incomingPendingRelationsForNewLemma) {
		if (!incomingSourceLemmaIds.has(relation.sourceLemmaId)) {
			throw new Error(
				"incoming pending relation source lemma is missing from the slice.",
			);
		}
	}

	const matchingPendingIds = new Set(
		slice.matchingPendingRefsForNewLemma.map(({ pendingId }) => pendingId),
	);
	for (const relation of slice.incomingPendingRelationsForNewLemma) {
		if (!matchingPendingIds.has(relation.targetPendingId)) {
			throw new Error(
				"incoming pending relation target pending ref is missing from the slice.",
			);
		}
	}
}
