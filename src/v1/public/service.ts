import type {
	DumdictEntryDraft,
} from "../dto";
import type {
	DumlingId,
	LemmaKindFor,
	LemmaSubKindFor,
	SupportedLanguage,
} from "../dumling";
import type { FindStoredLemmaSensesResult, MutationResult } from "./results";

export type LemmaDescription<L extends SupportedLanguage> = {
	language: L;
	canonicalLemma: string;
	lemmaKind: LemmaKindFor<L>;
	lemmaSubKind: LemmaSubKindFor<L, LemmaKindFor<L>>;
};

export type FindStoredLemmaSensesRequest<L extends SupportedLanguage> = {
	lemmaDescription: LemmaDescription<L>;
};

export type AddAttestationRequest<L extends SupportedLanguage> = {
	lemmaId: DumlingId<"Lemma", L>;
	attestation: string;
};

export type AddNewNoteRequest<L extends SupportedLanguage> = {
	draft: DumdictEntryDraft<L>;
};

export type DumdictService<L extends SupportedLanguage> = {
	findStoredLemmaSenses(
		request: FindStoredLemmaSensesRequest<L>,
	): Promise<FindStoredLemmaSensesResult<L>>;

	addAttestation(request: AddAttestationRequest<L>): Promise<MutationResult<L>>;

	addNewNote(request: AddNewNoteRequest<L>): Promise<MutationResult<L>>;
};
