import type {
	DumdictEntryDraft,
	LemmaEntry,
	PendingLemmaRef,
	PendingLemmaRelation,
	RelationNotesForDisambiguation,
	StoreRevision,
	SurfaceEntry,
} from "../dto";
import type { DumlingId } from "../dumling";
import type { LemmaDescription } from "../public";
import type { SupportedLanguage } from "../dumling";

export type FindStoredLemmaSensesStorageRequest<L extends SupportedLanguage> = {
	lemmaDescription: LemmaDescription<L>;
};

export type StoredLemmaSensesSlice<L extends SupportedLanguage> = {
	revision: StoreRevision;
	candidates: Array<{
		entry: LemmaEntry<L>;
		relationNotes?: RelationNotesForDisambiguation<L>;
	}>;
};

export type LoadLemmaForPatchRequest<L extends SupportedLanguage> = {
	lemmaId: DumlingId<"Lemma", L>;
};

export type LemmaPatchSlice<L extends SupportedLanguage> = {
	revision: StoreRevision;
	lemma?: LemmaEntry<L>;
};

export type LoadNewNoteContextRequest<L extends SupportedLanguage> = {
	draft: DumdictEntryDraft<L>;
};

export type NewNoteSlice<L extends SupportedLanguage> = {
	revision: StoreRevision;
	existingLemma?: LemmaEntry<L>;
	existingOwnedSurfaces: SurfaceEntry<L>[];
	explicitExistingRelationTargets: LemmaEntry<L>[];
	existingPendingRefsForProposedPendingTargets: PendingLemmaRef<L>[];
	matchingPendingRefsForNewLemma: PendingLemmaRef<L>[];
	incomingPendingRelationsForNewLemma: PendingLemmaRelation<L>[];
	incomingPendingSourceLemmas: LemmaEntry<L>[];
};
