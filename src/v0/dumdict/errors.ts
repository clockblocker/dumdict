import type { Result } from "neverthrow";

export type V0DumdictErrorCode =
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

export type V0DumdictError = {
	code: V0DumdictErrorCode;
	message: string;
	cause?: unknown;
};

export type V0DumdictResult<T> = Result<T, V0DumdictError>;

export function makeError(
	code: V0DumdictErrorCode,
	message: string,
	cause?: unknown,
): V0DumdictError {
	return { code, message, cause };
}
