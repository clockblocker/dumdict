import type { DumdictEntryDraft } from "../dto";
import type { DumlingId, SupportedLanguage } from "../dumling";

export type AppendLemmaAttestationIntent<L extends SupportedLanguage> = {
	type: "appendLemmaAttestation";
	lemmaId: DumlingId<"Lemma", L>;
	attestation: string;
};

export type AddNewNoteIntent<L extends SupportedLanguage> = {
	type: "addNewNote";
	draft: DumdictEntryDraft<L>;
};

export type DictionaryIntent<L extends SupportedLanguage> =
	| AppendLemmaAttestationIntent<L>
	| AddNewNoteIntent<L>;
