import type { DumlingId, SupportedLanguage } from "../dumling";
import type {
	LemmaEntry,
	PendingLemmaId,
	PendingLemmaRef,
	PendingLemmaRelation,
	StoreRevision,
	SurfaceEntry,
} from "../dto";

export type ChangePrecondition<L extends SupportedLanguage> =
	| { kind: "revisionMatches"; revision: StoreRevision }
	| { kind: "lemmaExists"; lemmaId: DumlingId<"Lemma", L> }
	| { kind: "lemmaMissing"; lemmaId: DumlingId<"Lemma", L> }
	| { kind: "surfaceExists"; surfaceId: DumlingId<"Surface", L> }
	| { kind: "surfaceMissing"; surfaceId: DumlingId<"Surface", L> }
	| { kind: "pendingRefExists"; pendingId: PendingLemmaId<L> }
	| { kind: "pendingRefMissing"; pendingId: PendingLemmaId<L> }
	| { kind: "pendingRelationExists"; relation: PendingLemmaRelation<L> }
	| { kind: "pendingRelationMissing"; relation: PendingLemmaRelation<L> }
	| {
			kind: "pendingRefHasNoIncomingRelations";
			pendingId: PendingLemmaId<L>;
	  }
	| {
			kind: "lemmaAttestationMissing";
			lemmaId: DumlingId<"Lemma", L>;
			value: string;
	  };

export type LemmaPatchOp<L extends SupportedLanguage> =
	| { kind: "addAttestation"; value: string }
	| {
			kind: "addRelation";
			family: "lexical" | "morphological";
			relation: string;
			targetLemmaId: DumlingId<"Lemma", L>;
	  };

export type PlannedChangeOp<L extends SupportedLanguage> =
	| {
			type: "createLemma";
			entry: LemmaEntry<L>;
			preconditions: ChangePrecondition<L>[];
	  }
	| {
			type: "patchLemma";
			lemmaId: DumlingId<"Lemma", L>;
			ops: LemmaPatchOp<L>[];
			preconditions: ChangePrecondition<L>[];
	  }
	| {
			type: "createOwnedSurface";
			entry: SurfaceEntry<L>;
			preconditions: ChangePrecondition<L>[];
	  }
	| {
			type: "createPendingRef";
			ref: PendingLemmaRef<L>;
			preconditions: ChangePrecondition<L>[];
	  }
	| {
			type: "deletePendingRef";
			pendingId: PendingLemmaId<L>;
			preconditions: ChangePrecondition<L>[];
	  }
	| {
			type: "createPendingRelation";
			relation: PendingLemmaRelation<L>;
			preconditions: ChangePrecondition<L>[];
	  }
	| {
			type: "deletePendingRelation";
			relation: PendingLemmaRelation<L>;
			preconditions: ChangePrecondition<L>[];
	  };

export type CommitChangesRequest<L extends SupportedLanguage> = {
	baseRevision: StoreRevision;
	changes: PlannedChangeOp<L>[];
};

export type CommitChangesResult =
	| { status: "committed"; nextRevision: StoreRevision }
	| {
			status: "conflict";
			code: CommitConflictCode;
			latestRevision?: StoreRevision;
			message?: string;
	  };

export type CommitConflictCode =
	| "revisionConflict"
	| "semanticPreconditionFailed";

