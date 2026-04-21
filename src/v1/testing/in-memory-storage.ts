import { derivePendingLemmaId } from "../core/pending/identity";
import type { PendingLemmaRelation, StoreRevision } from "../dto";
import type { SupportedLanguage } from "../dumling";
import { makeDumlingIdFor } from "../dumling";
import type {
	ChangePrecondition,
	CommitChangesRequest,
	CommitChangesResult,
	DumdictStoragePort,
	FindStoredLemmaSensesStorageRequest,
	LemmaPatchSlice,
	LoadLemmaForPatchRequest,
	LoadNewNoteContextRequest,
	NewNoteSlice,
	StoredLemmaSensesSlice,
} from "../storage";
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
	let storedNotes = structuredClone(notes) as SerializedDictionaryNote<L>[];
	let storedPendingRefs = storedNotes.flatMap(
		({ pendingRefs }) => pendingRefs ?? [],
	);

	const currentRevision = () => `mem-${revisionNumber}` as StoreRevision;
	const findStoredNoteByLemmaId = (lemmaId: string) =>
		storedNotes.find(({ lemmaEntry }) => lemmaEntry.id === lemmaId);
	const findStoredSurfaceById = (surfaceId: string) =>
		storedNotes
			.flatMap(({ ownedSurfaceEntries }) => ownedSurfaceEntries)
			.find(({ id }) => id === surfaceId);
	const allPendingRelations = () =>
		storedNotes.flatMap(({ pendingRelations }) => pendingRelations);
	const findStoredPendingRefById = (pendingId: string) =>
		storedPendingRefs.find(({ pendingId: id }) => id === pendingId);

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
			const existingLemma = findStoredNoteByLemmaId(draftLemmaId)?.lemmaEntry;
			const matchingPendingId = derivePendingLemmaId({
				language,
				canonicalLemma: request.draft.lemma.canonicalLemma,
				lemmaKind: request.draft.lemma.lemmaKind,
				lemmaSubKind: request.draft.lemma.lemmaSubKind,
			});
			const matchingPendingRefs = storedPendingRefs.filter(
				(ref) => ref.pendingId === matchingPendingId,
			);
			const matchingPendingIds = new Set(
				matchingPendingRefs.map(({ pendingId }) => pendingId),
			);
			const incomingPendingRelations = allPendingRelations().filter(
				(relation) => matchingPendingIds.has(relation.targetPendingId),
			);
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
			const proposedPendingTargetIds =
				request.draft.relations
					?.filter((relation) => relation.target.kind === "pending")
					.map((relation) =>
						relation.target.kind === "pending"
							? derivePendingLemmaId({
									language,
									canonicalLemma: relation.target.ref.canonicalLemma,
									lemmaKind: relation.target.ref.lemmaKind,
									lemmaSubKind: relation.target.ref.lemmaSubKind,
								})
							: undefined,
					)
					.filter((pendingId) => pendingId !== undefined) ?? [];

			return {
				revision: currentRevision(),
				existingLemma,
				existingOwnedSurfaces: draftSurfaceIds
					.map((surfaceId) => findStoredSurfaceById(surfaceId))
					.filter((surface) => surface !== undefined),
				explicitExistingRelationTargets: explicitExistingRelationTargetIds
					.map((lemmaId) => findStoredNoteByLemmaId(lemmaId)?.lemmaEntry)
					.filter((lemmaEntry) => lemmaEntry !== undefined),
				existingPendingRefsForProposedPendingTargets: proposedPendingTargetIds
					.map((pendingId) => findStoredPendingRefById(pendingId))
					.filter((pendingRef) => pendingRef !== undefined),
				matchingPendingRefsForNewLemma: matchingPendingRefs,
				incomingPendingRelationsForNewLemma: incomingPendingRelations,
				incomingPendingSourceLemmas: incomingPendingRelations
					.map(
						(relation) =>
							findStoredNoteByLemmaId(relation.sourceLemmaId)?.lemmaEntry,
					)
					.filter((lemmaEntry) => lemmaEntry !== undefined),
			};
		},

		async commitChanges(
			request: CommitChangesRequest<L>,
		): Promise<CommitChangesResult> {
			const draftNotes = structuredClone(
				storedNotes,
			) as SerializedDictionaryNote<L>[];
			const draftPendingRefs = structuredClone(storedPendingRefs);
			const findDraftNoteByLemmaId = (lemmaId: string) =>
				draftNotes.find(({ lemmaEntry }) => lemmaEntry.id === lemmaId);
			const findDraftSurfaceById = (surfaceId: string) =>
				draftNotes
					.flatMap(({ ownedSurfaceEntries }) => ownedSurfaceEntries)
					.find(({ id }) => id === surfaceId);
			const draftPendingRelations = () =>
				draftNotes.flatMap(({ pendingRelations }) => pendingRelations);
			const findDraftPendingRefById = (pendingId: string) =>
				draftPendingRefs.find(({ pendingId: id }) => id === pendingId);
			const hasDraftPendingRelation = (relation: PendingLemmaRelation<L>) =>
				draftPendingRelations().some(
					(storedRelation) =>
						storedRelation.sourceLemmaId === relation.sourceLemmaId &&
						storedRelation.relationFamily === relation.relationFamily &&
						storedRelation.relation === relation.relation &&
						storedRelation.targetPendingId === relation.targetPendingId,
				);
			const draftPreconditionFails = (
				precondition: ChangePrecondition<L>,
				baseRevision: StoreRevision,
			) => {
				switch (precondition.kind) {
					case "revisionMatches":
						return precondition.revision !== baseRevision;
					case "lemmaExists":
						return !findDraftNoteByLemmaId(precondition.lemmaId);
					case "lemmaMissing":
						return Boolean(findDraftNoteByLemmaId(precondition.lemmaId));
					case "surfaceExists":
						return !findDraftSurfaceById(precondition.surfaceId);
					case "surfaceMissing":
						return Boolean(findDraftSurfaceById(precondition.surfaceId));
					case "pendingRefExists":
						return !findDraftPendingRefById(precondition.pendingId);
					case "pendingRefMissing":
						return Boolean(findDraftPendingRefById(precondition.pendingId));
					case "pendingRelationExists":
						return !hasDraftPendingRelation(precondition.relation);
					case "pendingRelationMissing":
						return hasDraftPendingRelation(precondition.relation);
					case "pendingRefHasNoIncomingRelations":
						return draftPendingRelations().some(
							(relation) => relation.targetPendingId === precondition.pendingId,
						);
					case "lemmaAttestationMissing":
						return Boolean(
							findDraftNoteByLemmaId(
								precondition.lemmaId,
							)?.lemmaEntry.attestations.includes(precondition.value),
						);
					default:
						return false;
				}
			};

			for (const change of request.changes) {
				if (
					change.preconditions.some((precondition) =>
						draftPreconditionFails(precondition, request.baseRevision),
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
						draftNotes.push({
							lemmaEntry: structuredClone(change.entry),
							ownedSurfaceEntries: [],
							pendingRelations: [],
						});
						break;
					case "createOwnedSurface": {
						const storedNote = findDraftNoteByLemmaId(change.entry.ownerLemmaId);
						if (!storedNote) {
							return {
								status: "conflict",
								code: "semanticPreconditionFailed",
								latestRevision: currentRevision(),
							};
						}
						storedNote.ownedSurfaceEntries.push(structuredClone(change.entry));
						break;
					}
					case "createPendingRef": {
						draftPendingRefs.push(structuredClone(change.ref));
						break;
					}
					case "createPendingRelation": {
						const storedNote = findDraftNoteByLemmaId(
							change.relation.sourceLemmaId,
						);
						if (!storedNote) {
							return {
								status: "conflict",
								code: "semanticPreconditionFailed",
								latestRevision: currentRevision(),
							};
						}
						storedNote.pendingRelations.push(structuredClone(change.relation));
						break;
					}
					case "deletePendingRelation": {
						const storedNote = findDraftNoteByLemmaId(
							change.relation.sourceLemmaId,
						);
						if (!storedNote) {
							return {
								status: "conflict",
								code: "semanticPreconditionFailed",
								latestRevision: currentRevision(),
							};
						}
						storedNote.pendingRelations = storedNote.pendingRelations.filter(
							(relation) =>
								!(
									relation.sourceLemmaId === change.relation.sourceLemmaId &&
									relation.relationFamily === change.relation.relationFamily &&
									relation.relation === change.relation.relation &&
									relation.targetPendingId === change.relation.targetPendingId
								),
						);
						break;
					}
					case "deletePendingRef": {
						const refIndex = draftPendingRefs.findIndex(
							({ pendingId }) => pendingId === change.pendingId,
						);
						if (refIndex >= 0) {
							draftPendingRefs.splice(refIndex, 1);
						}
						break;
					}
					case "patchLemma": {
						const storedNote = findDraftNoteByLemmaId(change.lemmaId);
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
										storedNote.lemmaEntry.morphologicalRelations[op.relation] ??
										[];
									if (!existingTargets.includes(op.targetLemmaId)) {
										storedNote.lemmaEntry.morphologicalRelations[op.relation] =
											[...existingTargets, op.targetLemmaId];
									}
								}
							}
						}
						break;
					}
				}
			}

			storedNotes = draftNotes;
			storedPendingRefs = draftPendingRefs;
			revisionNumber += 1;
			return {
				status: "committed",
				nextRevision: currentRevision(),
			};
		},

		loadAll() {
			const clonedNotes = structuredClone(
				storedNotes,
			) as SerializedDictionaryNote<L>[];
			return clonedNotes.map((note) => ({
				...note,
				pendingRefs: storedPendingRefs.filter((ref) =>
					note.pendingRelations.some(
						(relation) => relation.targetPendingId === ref.pendingId,
					),
				),
			}));
		},
	};
}
