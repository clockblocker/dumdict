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
import { makeDumlingIdFor } from "../dumling";
import type { StoreRevision } from "../dto";
import type { SerializedDictionaryNote } from "./serialized-note";

export type InMemoryTestStorage<L extends SupportedLanguage> =
	DumdictStoragePort<L> & {
		loadAll(): SerializedDictionaryNote<L>[];
	};

export function createInMemoryTestStorage<L extends SupportedLanguage>(
	language: L,
	notes: SerializedDictionaryNote<L>[] = [],
): InMemoryTestStorage<L> {
	let revisionNumber = 1;
	const storedNotes = structuredClone(notes) as SerializedDictionaryNote<L>[];

	const currentRevision = () => `mem-${revisionNumber}` as StoreRevision;
	const findStoredNoteByLemmaId = (lemmaId: string) =>
		storedNotes.find(({ lemmaEntry }) => lemmaEntry.id === lemmaId);
	const findStoredSurfaceById = (surfaceId: string) =>
		storedNotes
			.flatMap(({ ownedSurfaceEntries }) => ownedSurfaceEntries)
			.find(({ id }) => id === surfaceId);

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
			case "surfaceExists":
				return !findStoredSurfaceById(precondition.surfaceId);
			case "surfaceMissing":
				return Boolean(findStoredSurfaceById(precondition.surfaceId));
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
			const draftLemmaId = makeDumlingIdFor(language, request.draft.lemma);
			const existingLemma =
				findStoredNoteByLemmaId(draftLemmaId)?.lemmaEntry;
			const draftSurfaceIds =
				request.draft.ownedSurfaces?.map(({ surface }) =>
					makeDumlingIdFor(language, surface),
				) ?? [];
			const explicitExistingRelationTargetIds =
				request.draft.relations
					?.filter((relation) => relation.target.kind === "existing")
					.map((relation) =>
						relation.target.kind === "existing"
							? relation.target.lemmaId
							: undefined,
					)
					.filter((lemmaId) => lemmaId !== undefined) ?? [];

			return {
				revision: currentRevision(),
				existingLemma,
				existingOwnedSurfaces: draftSurfaceIds
					.map((surfaceId) => findStoredSurfaceById(surfaceId))
					.filter((surface) => surface !== undefined),
				explicitExistingRelationTargets: explicitExistingRelationTargetIds
					.map((lemmaId) => findStoredNoteByLemmaId(lemmaId)?.lemmaEntry)
					.filter((lemmaEntry) => lemmaEntry !== undefined),
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
				switch (change.type) {
					case "createLemma":
						storedNotes.push({
							lemmaEntry: structuredClone(change.entry),
							ownedSurfaceEntries: [],
							pendingRelations: [],
						});
						break;
					case "createOwnedSurface": {
						const storedNote = findStoredNoteByLemmaId(
							change.entry.ownerLemmaId,
						);
						if (!storedNote) {
							return {
								status: "conflict",
								code: "semanticPreconditionFailed",
								latestRevision: currentRevision(),
							};
						}
						storedNote.ownedSurfaceEntries.push(
							structuredClone(change.entry),
						);
						break;
					}
					case "patchLemma": {
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
							if (op.kind === "addRelation") {
								if (op.family === "lexical") {
									const existingTargets =
										storedNote.lemmaEntry.lexicalRelations[op.relation] ?? [];
									if (!existingTargets.includes(op.targetLemmaId)) {
										storedNote.lemmaEntry.lexicalRelations[op.relation] = [
											...existingTargets,
											op.targetLemmaId,
										];
									}
								} else {
									const existingTargets =
										storedNote.lemmaEntry.morphologicalRelations[
											op.relation
										] ?? [];
									if (!existingTargets.includes(op.targetLemmaId)) {
										storedNote.lemmaEntry.morphologicalRelations[
											op.relation
										] = [...existingTargets, op.targetLemmaId];
									}
								}
							}
						}
						break;
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
