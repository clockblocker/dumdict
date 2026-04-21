import type { SupportedLanguage } from "../dumling";
import { DumdictNotImplementedError } from "../public";
import type {
	AddAttestationRequest,
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

		async addNewNote() {
			throw new DumdictNotImplementedError("addNewNote");
		},
	};
}
