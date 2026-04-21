import type {
	LemmaEntry,
	LexicalRelation,
	LexicalRelations,
	MorphologicalRelation,
	MorphologicalRelations,
	PendingLemmaRef,
	PendingLemmaRelation,
	SurfaceEntry,
} from "../dto";
import type { DumlingId, SupportedLanguage } from "../dumling";
import { makeDumlingIdFor } from "../dumling";
import type { MutationRejectedCode } from "../public";
import type { LemmaPatchSlice, NewNoteSlice } from "../storage";
import type { AffectedDictionaryEntities } from "./affected";
import type { DictionaryIntent } from "./intents";
import { makePendingLemmaRef } from "./pending/identity";
import type { PlannedChangeOp } from "./planned-changes";
import { inverseRelationFor } from "./relations/inverse-rules";
import type { MutationPlanSummary } from "./summaries";

export type PlanMutationResult<L extends SupportedLanguage> = {
	status: "planned";
	baseRevision: import("../dto").StoreRevision;
	intent: DictionaryIntent<L>;
	changes: PlannedChangeOp<L>[];
	affected: AffectedDictionaryEntities<L>;
	summary: MutationPlanSummary;
};

export type PlanMutationRejected = {
	status: "rejected";
	code: MutationRejectedCode;
	message?: string;
};

function appendLexicalRelation<L extends SupportedLanguage>(
	relations: LexicalRelations<L>,
	relation: LexicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const existing = relations[relation] ?? [];
	if (!existing.includes(targetLemmaId)) {
		relations[relation] = [...existing, targetLemmaId];
	}
}

function appendMorphologicalRelation<L extends SupportedLanguage>(
	relations: MorphologicalRelations<L>,
	relation: MorphologicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const existing = relations[relation] ?? [];
	if (!existing.includes(targetLemmaId)) {
		relations[relation] = [...existing, targetLemmaId];
	}
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string): T[] {
	const seen = new Set<string>();
	const uniqueValues: T[] = [];
	for (const value of values) {
		const key = keyFor(value);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		uniqueValues.push(value);
	}
	return uniqueValues;
}

function pendingRelationKey<L extends SupportedLanguage>(
	relation: PendingLemmaRelation<L>,
) {
	return [
		relation.sourceLemmaId,
		relation.relationFamily,
		relation.relation,
		relation.targetPendingId,
	].join("\0");
}

export function planAppendLemmaAttestation<L extends SupportedLanguage>(
	slice: LemmaPatchSlice<L>,
	intent: Extract<DictionaryIntent<L>, { type: "appendLemmaAttestation" }>,
): PlanMutationResult<L> | PlanMutationRejected {
	if (!slice.lemma) {
		return {
			status: "rejected",
			code: "lemmaMissing",
			message: "Lemma does not exist.",
		};
	}
	if (slice.lemma.id !== intent.lemmaId) {
		throw new Error(
			"lemma patch slice lemma id does not match the requested lemma id.",
		);
	}

	return {
		status: "planned",
		baseRevision: slice.revision,
		intent,
		changes: [
			{
				type: "patchLemma",
				lemmaId: intent.lemmaId,
				ops: [{ kind: "addAttestation", value: intent.attestation }],
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "lemmaExists", lemmaId: intent.lemmaId },
					{
						kind: "lemmaAttestationMissing",
						lemmaId: intent.lemmaId,
						value: intent.attestation,
					},
				],
			},
		],
		affected: { lemmaIds: [intent.lemmaId] },
		summary: { message: "Added lemma attestation." },
	};
}

export function planAddNewNote<L extends SupportedLanguage>(
	slice: NewNoteSlice<L>,
	intent: Extract<DictionaryIntent<L>, { type: "addNewNote" }>,
): PlanMutationResult<L> | PlanMutationRejected {
	const language = intent.draft.lemma.language as L;
	const lemmaId = makeDumlingIdFor(language, intent.draft.lemma);

	if (
		intent.draft.relations?.some((relation) => {
			if (relation.target.kind === "existing") {
				return relation.target.lemmaId === lemmaId;
			}

			return (
				relation.target.ref.canonicalLemma ===
					intent.draft.lemma.canonicalLemma &&
				relation.target.ref.lemmaKind === intent.draft.lemma.lemmaKind &&
				relation.target.ref.lemmaSubKind === intent.draft.lemma.lemmaSubKind
			);
		})
	) {
		return {
			status: "rejected",
			code: "selfRelation",
			message: "A lemma cannot relate to itself.",
		};
	}

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
		intent.draft.relations?.filter(
			(relation) => relation.target.kind === "existing",
		) ?? [];
	const pendingRelations =
		intent.draft.relations?.filter(
			(relation) => relation.target.kind === "pending",
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
	const ownedSurfaceEntries: SurfaceEntry<L>[] = uniqueBy(
		intent.draft.ownedSurfaces?.map((ownedSurface) => ({
			id: makeDumlingIdFor(language, ownedSurface.surface),
			surface: ownedSurface.surface,
			ownerLemmaId: lemmaId,
			attestedTranslations: ownedSurface.note.attestedTranslations,
			attestations: ownedSurface.note.attestations,
			notes: ownedSurface.note.notes,
		})) ?? [],
		({ id }) => id,
	);
	const existingPendingRefIds = new Set(
		slice.existingPendingRefsForProposedPendingTargets.map(
			({ pendingId }) => pendingId,
		),
	);
	const pendingRefsToCreateById = new Map<string, PendingLemmaRef<L>>();
	const pendingRelationEntries: PendingLemmaRelation<L>[] = uniqueBy(
		pendingRelations.map((relation) => {
			if (relation.target.kind !== "pending") {
				throw new Error("Unexpected existing relation target");
			}

			const pendingRef = makePendingLemmaRef({
				language,
				canonicalLemma: relation.target.ref.canonicalLemma,
				lemmaKind: relation.target.ref.lemmaKind,
				lemmaSubKind: relation.target.ref.lemmaSubKind,
			});
			if (!existingPendingRefIds.has(pendingRef.pendingId)) {
				pendingRefsToCreateById.set(pendingRef.pendingId, pendingRef);
			}

			if (relation.relationFamily === "lexical") {
				return {
					sourceLemmaId: lemmaId,
					relationFamily: "lexical",
					relation: relation.relation,
					targetPendingId: pendingRef.pendingId,
				};
			}

			return {
				sourceLemmaId: lemmaId,
				relationFamily: "morphological",
				relation: relation.relation,
				targetPendingId: pendingRef.pendingId,
			};
		}),
		pendingRelationKey,
	);

	const pickupRelationPatches = slice.incomingPendingRelationsForNewLemma.map(
		(relation): PlannedChangeOp<L> => {
			if (relation.relationFamily === "lexical") {
				appendLexicalRelation(
					lexicalRelations,
					inverseRelationFor(relation.relationFamily, relation.relation),
					relation.sourceLemmaId,
				);
				return {
					type: "patchLemma",
					lemmaId: relation.sourceLemmaId,
					ops: [
						{
							kind: "addRelation",
							family: "lexical",
							relation: relation.relation,
							targetLemmaId: lemmaId,
						},
					],
					preconditions: [
						{ kind: "revisionMatches", revision: slice.revision },
						{ kind: "lemmaExists", lemmaId: relation.sourceLemmaId },
					],
				};
			}

			appendMorphologicalRelation(
				morphologicalRelations,
				inverseRelationFor(relation.relationFamily, relation.relation),
				relation.sourceLemmaId,
			);
			return {
				type: "patchLemma",
				lemmaId: relation.sourceLemmaId,
				ops: [
					{
						kind: "addRelation",
						family: "morphological",
						relation: relation.relation,
						targetLemmaId: lemmaId,
					},
				],
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "lemmaExists", lemmaId: relation.sourceLemmaId },
				],
			};
		},
	);

	const inverseRelationPatches = explicitExistingRelations.map(
		(relation): PlannedChangeOp<L> => {
			if (relation.target.kind !== "existing") {
				throw new Error("Unexpected pending relation target");
			}

			if (relation.relationFamily === "lexical") {
				appendLexicalRelation(
					lexicalRelations,
					relation.relation,
					relation.target.lemmaId,
				);
				return {
					type: "patchLemma",
					lemmaId: relation.target.lemmaId,
					ops: [
						{
							kind: "addRelation",
							family: "lexical",
							relation: inverseRelationFor(
								relation.relationFamily,
								relation.relation,
							),
							targetLemmaId: lemmaId,
						},
					],
					preconditions: [
						{ kind: "revisionMatches", revision: slice.revision },
						{ kind: "lemmaExists", lemmaId: relation.target.lemmaId },
					],
				};
			}

			appendMorphologicalRelation(
				morphologicalRelations,
				relation.relation,
				relation.target.lemmaId,
			);
			return {
				type: "patchLemma",
				lemmaId: relation.target.lemmaId,
				ops: [
					{
						kind: "addRelation",
						family: "morphological",
						relation: inverseRelationFor(
							relation.relationFamily,
							relation.relation,
						),
						targetLemmaId: lemmaId,
					},
				],
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "lemmaExists", lemmaId: relation.target.lemmaId },
				],
			};
		},
	);

	const lemmaEntry: LemmaEntry<L> = {
		id: lemmaId,
		lemma: intent.draft.lemma,
		lexicalRelations,
		morphologicalRelations,
		attestedTranslations: intent.draft.note.attestedTranslations,
		attestations: intent.draft.note.attestations,
		notes: intent.draft.note.notes,
	};

	const changes: PlannedChangeOp<L>[] = [
		{
			type: "createLemma",
			entry: lemmaEntry,
			preconditions: [
				{ kind: "revisionMatches", revision: slice.revision },
				{ kind: "lemmaMissing", lemmaId },
			],
		},
		...pickupRelationPatches,
		...inverseRelationPatches,
		...Array.from(pendingRefsToCreateById.values()).map(
			(ref): PlannedChangeOp<L> => ({
				type: "createPendingRef",
				ref,
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "pendingRefMissing", pendingId: ref.pendingId },
				],
			}),
		),
		...pendingRelationEntries.map(
			(relation): PlannedChangeOp<L> => ({
				type: "createPendingRelation",
				relation,
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "lemmaExists", lemmaId },
					{ kind: "pendingRefExists", pendingId: relation.targetPendingId },
					{ kind: "pendingRelationMissing", relation },
				],
			}),
		),
		...slice.incomingPendingRelationsForNewLemma.map(
			(relation): PlannedChangeOp<L> => ({
				type: "deletePendingRelation",
				relation,
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "pendingRelationExists", relation },
				],
			}),
		),
		...slice.matchingPendingRefsForNewLemma.map(
			(ref): PlannedChangeOp<L> => ({
				type: "deletePendingRef",
				pendingId: ref.pendingId,
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "pendingRefExists", pendingId: ref.pendingId },
					{
						kind: "pendingRefHasNoIncomingRelations",
						pendingId: ref.pendingId,
					},
				],
			}),
		),
		...ownedSurfaceEntries.map(
			(entry): PlannedChangeOp<L> => ({
				type: "createOwnedSurface",
				entry,
				preconditions: [
					{ kind: "revisionMatches", revision: slice.revision },
					{ kind: "lemmaExists", lemmaId },
					{ kind: "surfaceMissing", surfaceId: entry.id },
				],
			}),
		),
	];

	return {
		status: "planned",
		baseRevision: slice.revision,
		intent,
		changes,
		affected: {
			lemmaIds: [lemmaId],
			surfaceIds: ownedSurfaceEntries.map(({ id }) => id),
			pendingIds: [
				...Array.from(pendingRefsToCreateById.keys()),
				...slice.matchingPendingRefsForNewLemma.map(
					({ pendingId }) => pendingId,
				),
			],
		},
		summary: { message: "Added new lemma note." },
	};
}

export function planMutation<L extends SupportedLanguage>(
	slice: LemmaPatchSlice<L> | NewNoteSlice<L>,
	intent: DictionaryIntent<L>,
): PlanMutationResult<L> | PlanMutationRejected {
	if (intent.type === "appendLemmaAttestation") {
		return planAppendLemmaAttestation(slice as LemmaPatchSlice<L>, intent);
	}

	return planAddNewNote(slice as NewNoteSlice<L>, intent);
}
