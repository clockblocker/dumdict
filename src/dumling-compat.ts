import { dumling, idCodec, operation } from "dumling";
import type {
	DumlingLanguage,
	Lemma as DumlingLemma,
	Selection as DumlingSelection,
	Surface as DumlingSurface,
} from "dumling/entities";
import type { DumlingId as DumlingStableId } from "dumling/id";

export { dumling, idCodec, operation };

export type SupportedLang = DumlingLanguage;

export type UniversalLemmaKind = DumlingLemma["lemmaKind"];

export type UniversalLemmaSubKind = string;

export type DumlingId<
	LIK extends "Lemma" | "Selection" | "Surface" = "Lemma" | "Selection" | "Surface",
	L extends SupportedLang = SupportedLang,
> = DumlingStableId<LIK, L>;

export type Lemma<
	L extends SupportedLang = SupportedLang,
	LK extends UniversalLemmaKind = UniversalLemmaKind,
	D extends string = string,
> = DumlingLemma<L, LK, D>;

export type Surface<
	L extends SupportedLang = SupportedLang,
	SK extends string = string,
	LK extends UniversalLemmaKind = UniversalLemmaKind,
	D extends string = string,
> = DumlingSurface<L> & {
	language: L;
	lemma: Lemma<L, LK, D>;
	surfaceKind: SK;
};

export type Selection<
	L extends SupportedLang = SupportedLang,
	OS extends string = string,
	SK extends string = string,
	LK extends UniversalLemmaKind = UniversalLemmaKind,
	D extends string = string,
> = DumlingSelection<L, OS, SK, LK, D>;
