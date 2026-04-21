import type { DumdictStoragePort } from "../storage";
import type {
	CommitChangesRequest,
	CommitChangesResult,
	FindStoredLemmaSensesStorageRequest,
	LemmaPatchSlice,
	LoadLemmaForPatchRequest,
	LoadNewNoteContextRequest,
	NewNoteSlice,
	StoredLemmaSensesSlice,
} from "../storage";
import type { SupportedLanguage } from "../dumling";
import type { StoreRevision } from "../dto";
import type { SerializedDictionaryNote } from "./serialized-note";

export type InMemoryTestStorage<L extends SupportedLanguage> =
	DumdictStoragePort<L> & {
		loadAll(): SerializedDictionaryNote<L>[];
	};

export function createInMemoryTestStorage<L extends SupportedLanguage>(
	notes: SerializedDictionaryNote<L>[] = [],
): InMemoryTestStorage<L> {
	let revisionNumber = 1;
	const storedNotes = structuredClone(notes) as SerializedDictionaryNote<L>[];

	const currentRevision = () => `mem-${revisionNumber}` as StoreRevision;

	return {
		async findStoredLemmaSenses(
			request: FindStoredLemmaSensesStorageRequest<L>,
		): Promise<StoredLemmaSensesSlice<L>> {
			const { lemmaDescription } = request;
			return {
				revision: currentRevision(),
				candidates: storedNotes
					.filter(({ lemmaEntry }) => {
						const { lemma } = lemmaEntry;
						return (
							lemma.language === lemmaDescription.language &&
							lemma.canonicalLemma === lemmaDescription.canonicalLemma &&
							lemma.lemmaKind === lemmaDescription.lemmaKind &&
							lemma.lemmaSubKind === lemmaDescription.lemmaSubKind
						);
					})
					.map(({ lemmaEntry }) => ({
						entry: lemmaEntry,
					})),
			};
		},

		async loadLemmaForPatch(
			request: LoadLemmaForPatchRequest<L>,
		): Promise<LemmaPatchSlice<L>> {
			return {
				revision: currentRevision(),
				lemma: storedNotes.find(
					({ lemmaEntry }) => lemmaEntry.id === request.lemmaId,
				)?.lemmaEntry,
			};
		},

		async loadNewNoteContext(
			request: LoadNewNoteContextRequest<L>,
		): Promise<NewNoteSlice<L>> {
			const draftLemma = request.draft.lemma;
			const existingLemma = storedNotes.find(
				({ lemmaEntry }) =>
					lemmaEntry.lemma.language === draftLemma.language &&
					lemmaEntry.lemma.canonicalLemma === draftLemma.canonicalLemma &&
					lemmaEntry.lemma.lemmaKind === draftLemma.lemmaKind &&
					lemmaEntry.lemma.lemmaSubKind === draftLemma.lemmaSubKind &&
					lemmaEntry.lemma.meaningInEmojis === draftLemma.meaningInEmojis,
			)?.lemmaEntry;

			return {
				revision: currentRevision(),
				existingLemma,
				existingOwnedSurfaces: [],
				explicitExistingRelationTargets: [],
				existingPendingRefsForProposedPendingTargets: [],
				matchingPendingRefsForNewLemma: [],
				incomingPendingRelationsForNewLemma: [],
				incomingPendingSourceLemmas: [],
			};
		},

		async commitChanges(
			_request: CommitChangesRequest<L>,
		): Promise<CommitChangesResult> {
			revisionNumber += 1;
			return {
				status: "conflict",
				code: "semanticPreconditionFailed",
				latestRevision: currentRevision(),
				message: "v1 in-memory commit is not implemented yet",
			};
		},

		loadAll() {
			return structuredClone(storedNotes) as SerializedDictionaryNote<L>[];
		},
	};
}

