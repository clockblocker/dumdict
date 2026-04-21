import type { SupportedLanguage } from "../dumling";
import { DumdictNotImplementedError } from "../public";
import type { DumdictService } from "../public";
import type { CreateDumdictServiceOptions } from "../storage";

export function createDumdictService<L extends SupportedLanguage>(
	_options: CreateDumdictServiceOptions<L>,
): DumdictService<L> {
	return {
		async findStoredLemmaSenses() {
			throw new DumdictNotImplementedError("findStoredLemmaSenses");
		},

		async addAttestation() {
			throw new DumdictNotImplementedError("addAttestation");
		},

		async addNewNote() {
			throw new DumdictNotImplementedError("addNewNote");
		},
	};
}

