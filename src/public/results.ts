import type { DumlingId, SupportedLanguage } from "../dumling";
import type { LemmaNoteForDisambiguation, StoreRevision } from "../dto";
import type { DumdictDiagnostic } from "./diagnostics";

export type AffectedDictionaryEntities<L extends SupportedLanguage> = {
	lemmaIds?: DumlingId<"Lemma", L>[];
	surfaceIds?: DumlingId<"Surface", L>[];
	pendingIds?: string[];
};

export type MutationSummary = {
	message: string;
};

export type LemmaSenseCandidate<L extends SupportedLanguage> = {
	lemmaId: DumlingId<"Lemma", L>;
	note: LemmaNoteForDisambiguation<L>;
};

export type FindStoredLemmaSensesResult<L extends SupportedLanguage> = {
	revision: StoreRevision;
	candidates: LemmaSenseCandidate<L>[];
	diagnostics?: DumdictDiagnostic[];
};

export type MutationResult<L extends SupportedLanguage> =
	| {
			status: "applied";
			baseRevision: StoreRevision;
			nextRevision: StoreRevision;
			affected: AffectedDictionaryEntities<L>;
			summary: MutationSummary;
			diagnostics?: DumdictDiagnostic[];
	  }
	| {
			status: "conflict";
			code: MutationConflictCode;
			baseRevision: StoreRevision;
			latestRevision?: StoreRevision;
			message?: string;
			diagnostics?: DumdictDiagnostic[];
	  }
	| {
			status: "rejected";
			code: MutationRejectedCode;
			message?: string;
			diagnostics?: DumdictDiagnostic[];
	  };

export type MutationConflictCode =
	| "revisionConflict"
	| "semanticPreconditionFailed";

export type MutationRejectedCode =
	| "lemmaAlreadyExists"
	| "ownedSurfaceAlreadyExists"
	| "lemmaMissing"
	| "invalidDraft"
	| "selfRelation"
	| "relationTargetMissing";

