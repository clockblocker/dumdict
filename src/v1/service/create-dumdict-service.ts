import type { SupportedLanguage } from "../dumling";
import { makeDumlingIdFor } from "../dumling";
import { inverseRelationFor } from "../core/relations/inverse-rules";
import type {
	LexicalRelations,
	MorphologicalRelations,
} from "../dto";
import type {
	AddAttestationRequest,
	AddNewNoteRequest,
	DumdictService,
	FindStoredLemmaSensesRequest,
} from "../public";
import type { CreateDumdictServiceOptions } from "../storage";
import {
	assertDumlingIdLanguageMatches,
	assertLanguageMatches,
} from "./language-guard";

export function createDumdictService<L extends SupportedLanguage>(
	options: CreateDumdictServiceOptions<L>,
): DumdictService<L> {
	const { storage } = options;

	return {
		async findStoredLemmaSenses(request: FindStoredLemmaSensesRequest<L>) {
			assertLanguageMatches(
				options.language,
				request.lemmaDescription.language,
			);

			const slice = await storage.findStoredLemmaSenses(request);
			return {
				revision: slice.revision,
				candidates: slice.candidates.map(({ entry, relationNotes }) => ({
					lemmaId: entry.id,
					note: {
						lemma: entry.lemma,
						attestedTranslations: entry.attestedTranslations,
						attestations: entry.attestations,
						notes: entry.notes,
						relations: relationNotes,
					},
				})),
			};
		},

		async addAttestation(request: AddAttestationRequest<L>) {
			assertDumlingIdLanguageMatches(options.language, request.lemmaId);

			const slice = await storage.loadLemmaForPatch({
				lemmaId: request.lemmaId,
			});

			if (!slice.lemma) {
				return {
					status: "rejected",
					code: "lemmaMissing",
					message: "Lemma does not exist.",
				};
			}

			const commit = await storage.commitChanges({
				baseRevision: slice.revision,
				changes: [
					{
						type: "patchLemma",
						lemmaId: request.lemmaId,
						ops: [{ kind: "addAttestation", value: request.attestation }],
						preconditions: [
							{ kind: "revisionMatches", revision: slice.revision },
							{ kind: "lemmaExists", lemmaId: request.lemmaId },
							{
								kind: "lemmaAttestationMissing",
								lemmaId: request.lemmaId,
								value: request.attestation,
							},
						],
					},
				],
			});

			if (commit.status === "conflict") {
				return {
					status: "conflict",
					code: commit.code,
					baseRevision: slice.revision,
					latestRevision: commit.latestRevision,
					message: commit.message,
				};
			}

			return {
				status: "applied",
				baseRevision: slice.revision,
				nextRevision: commit.nextRevision,
				affected: { lemmaIds: [request.lemmaId] },
				summary: { message: "Added lemma attestation." },
			};
		},

		async addNewNote(request: AddNewNoteRequest<L>) {
			assertLanguageMatches(options.language, request.draft.lemma.language);
			for (const ownedSurface of request.draft.ownedSurfaces ?? []) {
				assertLanguageMatches(options.language, ownedSurface.surface.language);
			}

			const lemmaId = makeDumlingIdFor(options.language, request.draft.lemma);
			const ownedSurfaceEntries =
				request.draft.ownedSurfaces?.map((ownedSurface) => {
					const surfaceId = makeDumlingIdFor(
						options.language,
						ownedSurface.surface,
					);
					return {
						id: surfaceId,
						surface: ownedSurface.surface,
						ownerLemmaId: lemmaId,
						attestedTranslations:
							ownedSurface.note.attestedTranslations,
						attestations: ownedSurface.note.attestations,
						notes: ownedSurface.note.notes,
					};
				}) ?? [];
			const slice = await storage.loadNewNoteContext(request);

			if (slice.existingLemma) {
				return {
					status: "rejected",
					code: "lemmaAlreadyExists",
					message: "Lemma already exists.",
				};
			}

			if (slice.existingOwnedSurfaces.length > 0) {
				return {
					status: "rejected",
					code: "ownedSurfaceAlreadyExists",
					message: "An owned surface already exists.",
				};
			}

			const explicitExistingRelations =
				request.draft.relations?.filter(
					(relation) => relation.target.kind === "existing",
				) ?? [];
			const existingRelationTargetIds = new Set(
				slice.explicitExistingRelationTargets.map(({ id }) => id),
			);
			if (
				explicitExistingRelations.some(
					(relation) =>
						relation.target.kind === "existing" &&
						!existingRelationTargetIds.has(relation.target.lemmaId),
				)
			) {
				return {
					status: "rejected",
					code: "relationTargetMissing",
					message: "An explicit relation target is missing.",
				};
			}

			const lexicalRelations: LexicalRelations<L> = {};
			const morphologicalRelations: MorphologicalRelations<L> = {};
			const inverseRelationPatches = explicitExistingRelations.map(
				(relation) => {
					if (relation.target.kind !== "existing") {
						throw new Error("Unexpected pending relation target");
					}

					if (relation.relationFamily === "lexical") {
						const lexicalRelation = relation.relation;
						lexicalRelations[lexicalRelation] = [
							...(lexicalRelations[lexicalRelation] ?? []),
							relation.target.lemmaId,
						];
						return {
							type: "patchLemma" as const,
							lemmaId: relation.target.lemmaId,
							ops: [
								{
									kind: "addRelation" as const,
									family: "lexical" as const,
									relation: inverseRelationFor(
										relation.relationFamily,
										lexicalRelation,
									),
									targetLemmaId: lemmaId,
								},
							],
							preconditions: [
								{ kind: "revisionMatches" as const, revision: slice.revision },
								{
									kind: "lemmaExists" as const,
									lemmaId: relation.target.lemmaId,
								},
							],
						};
					}

					const morphologicalRelation = relation.relation;
					morphologicalRelations[morphologicalRelation] = [
						...(morphologicalRelations[morphologicalRelation] ?? []),
						relation.target.lemmaId,
					];
					return {
						type: "patchLemma" as const,
						lemmaId: relation.target.lemmaId,
						ops: [
							{
								kind: "addRelation" as const,
								family: "morphological" as const,
								relation: inverseRelationFor(
									relation.relationFamily,
									morphologicalRelation,
								),
								targetLemmaId: lemmaId,
							},
						],
						preconditions: [
							{ kind: "revisionMatches" as const, revision: slice.revision },
							{
								kind: "lemmaExists" as const,
								lemmaId: relation.target.lemmaId,
							},
						],
					};
				},
			);

			const commit = await storage.commitChanges({
				baseRevision: slice.revision,
				changes: [
					{
						type: "createLemma",
						entry: {
							id: lemmaId,
							lemma: request.draft.lemma,
							lexicalRelations,
							morphologicalRelations,
							attestedTranslations:
								request.draft.note.attestedTranslations,
							attestations: request.draft.note.attestations,
							notes: request.draft.note.notes,
						},
						preconditions: [
							{ kind: "revisionMatches", revision: slice.revision },
							{ kind: "lemmaMissing", lemmaId },
						],
					},
					...inverseRelationPatches,
					...ownedSurfaceEntries.map((entry) => ({
						type: "createOwnedSurface" as const,
						entry,
						preconditions: [
							{ kind: "revisionMatches" as const, revision: slice.revision },
							{ kind: "lemmaExists" as const, lemmaId },
							{ kind: "surfaceMissing" as const, surfaceId: entry.id },
						],
					})),
				],
			});

			if (commit.status === "conflict") {
				return {
					status: "conflict",
					code: commit.code,
					baseRevision: slice.revision,
					latestRevision: commit.latestRevision,
					message: commit.message,
				};
			}

			return {
				status: "applied",
				baseRevision: slice.revision,
				nextRevision: commit.nextRevision,
				affected: {
					lemmaIds: [lemmaId],
					surfaceIds: ownedSurfaceEntries.map(({ id }) => id),
				},
				summary: { message: "Added new lemma note." },
			};
		},
	};
}
