import type { Result } from "neverthrow";

export type DumdictErrorCode =
	| "LemmaEntryNotFound"
	| "SurfaceEntryNotFound"
	| "PendingRefNotFound"
	| "OwnerLemmaNotFound"
	| "PendingRelationNotFound"
	| "RelationTargetNotFound"
	| "PendingResolutionMismatch"
	| "LanguageMismatch"
	| "InvalidOwnership"
	| "InvalidPatchOp"
	| "SelfRelationForbidden"
	| "InvariantViolation"
	| "DecodeFailed";

export type DumdictError = {
	code: DumdictErrorCode;
	message: string;
	cause?: unknown;
};

export type DumdictResult<T> = Result<T, DumdictError>;

export function makeError(
	code: DumdictErrorCode,
	message: string,
	cause?: unknown,
): DumdictError {
	return { code, message, cause };
}
