import type { SupportedLanguage } from "../dumling";
import type { CommitChangesRequest, CommitChangesResult } from "./commit";
import type {
	FindStoredLemmaSensesStorageRequest,
	LemmaPatchSlice,
	LoadLemmaForPatchRequest,
	LoadNewNoteContextRequest,
	NewNoteSlice,
	StoredLemmaSensesSlice,
} from "./slices";

export type DumdictStoragePort<L extends SupportedLanguage> = {
	findStoredLemmaSenses(
		request: FindStoredLemmaSensesStorageRequest<L>,
	): Promise<StoredLemmaSensesSlice<L>>;

	loadLemmaForPatch(
		request: LoadLemmaForPatchRequest<L>,
	): Promise<LemmaPatchSlice<L>>;

	loadNewNoteContext(
		request: LoadNewNoteContextRequest<L>,
	): Promise<NewNoteSlice<L>>;

	commitChanges(request: CommitChangesRequest<L>): Promise<CommitChangesResult>;
};

export type DumdictServiceConfig<L extends SupportedLanguage> = {
	language?: L;
};

export type CreateDumdictServiceOptions<L extends SupportedLanguage> = {
	language: L;
	storage: DumdictStoragePort<L>;
	config?: DumdictServiceConfig<L>;
};

