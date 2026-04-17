import type { SupportedLang } from "dumling";
import type { Dumdict } from "../public";
import { InMemoryDumdict } from "./in-memory-dumdict";

export function makeDumdict<L extends SupportedLang>(language: L): Dumdict<L> {
	return new InMemoryDumdict(language);
}
