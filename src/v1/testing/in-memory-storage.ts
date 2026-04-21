import type { DumdictStoragePort } from "../storage";
import type {
	ChangePrecondition,
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
	const findStoredNoteByLemmaId = (lemmaId: string) =>
		storedNotes.find(({ lemmaEntry }) => lemmaEntry.id === lemmaId);

	const preconditionFails = (
		precondition: ChangePrecondition<L>,
		baseRevision: StoreRevision,
	) => {
		switch (precondition.kind) {
			case "revisionMatches":
				return precondition.revision !== baseRevision;
			case "lemmaExists":
				return !findStoredNoteByLemmaId(precondition.lemmaId);
			case "lemmaMissing":
				return Boolean(findStoredNoteByLemmaId(precondition.lemmaId));
			case "lemmaAttestationMissing":
				return Boolean(
					findStoredNoteByLemmaId(
						precondition.lemmaId,
					)?.lemmaEntry.attestations.includes(precondition.value),
				);
			default:
				return false;
		}
	};

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
				lemma: findStoredNoteByLemmaId(request.lemmaId)?.lemmaEntry,
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
			request: CommitChangesRequest<L>,
		): Promise<CommitChangesResult> {
			for (const change of request.changes) {
				if (
					change.preconditions.some((precondition) =>
						preconditionFails(precondition, request.baseRevision),
					)
				) {
					return {
						status: "conflict",
						code: "semanticPreconditionFailed",
						latestRevision: currentRevision(),
					};
				}
			}

			for (const change of request.changes) {
				if (change.type !== "patchLemma") {
					continue;
				}

				const storedNote = findStoredNoteByLemmaId(change.lemmaId);
				if (!storedNote) {
					return {
						status: "conflict",
						code: "semanticPreconditionFailed",
						latestRevision: currentRevision(),
					};
				}

				for (const op of change.ops) {
					if (op.kind === "addAttestation") {
						storedNote.lemmaEntry.attestations.push(op.value);
					}
				}
			}

			revisionNumber += 1;
			return {
				status: "committed",
				nextRevision: currentRevision(),
			};
		},

		loadAll() {
			return structuredClone(storedNotes) as SerializedDictionaryNote<L>[];
		},
	};
}
