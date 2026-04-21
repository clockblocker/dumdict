import type { V0SupportedLang } from "../../dumling-compat";
import type { V0Dumdict } from "../public";
import { InMemoryDumdict } from "./in-memory-dumdict";

export function makeDumdict<L extends V0SupportedLang>(language: L): V0Dumdict<L> {
	return new InMemoryDumdict(language);
}
