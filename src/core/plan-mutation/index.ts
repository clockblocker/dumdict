import type { SupportedLanguage } from "../../dumling";
import type { LemmaPatchSlice, NewNoteSlice } from "../../storage";
import type { DictionaryIntent } from "../intents";
import { planAddNewNote } from "./add-new-note";
import { planAppendLemmaAttestation } from "./append-lemma-attestation";
import type { PlanMutationRejected, PlanMutationResult } from "./result";

export { planAddNewNote } from "./add-new-note";
export { planAppendLemmaAttestation } from "./append-lemma-attestation";
export type {
	AddNewNoteIntent,
	AppendLemmaAttestationIntent,
	PlanMutationRejected,
	PlanMutationResult,
} from "./result";

export function planMutation<L extends SupportedLanguage>(
	slice: LemmaPatchSlice<L> | NewNoteSlice<L>,
	intent: DictionaryIntent<L>,
): PlanMutationResult<L> | PlanMutationRejected {
	if (intent.type === "appendLemmaAttestation") {
		return planAppendLemmaAttestation(slice as LemmaPatchSlice<L>, intent);
	}

	return planAddNewNote(slice as NewNoteSlice<L>, intent);
}
