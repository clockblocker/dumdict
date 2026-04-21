import type { SupportedLanguage } from "../dumling";
import type { DumdictService } from "../public";
import type { CreateDumdictServiceOptions } from "../storage";
import { addAttestation } from "./add-attestation";
import { addNewNote } from "./add-new-note";
import { findStoredLemmaSenses } from "./find-stored-lemma-senses";

export function createDumdictService<L extends SupportedLanguage>(
	options: CreateDumdictServiceOptions<L>,
): DumdictService<L> {
	return {
		findStoredLemmaSenses: (request) => findStoredLemmaSenses(options, request),
		addAttestation: (request) => addAttestation(options, request),
		addNewNote: (request) => addNewNote(options, request),
	};
}
