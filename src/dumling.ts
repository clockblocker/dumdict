import {
	dumling,
	getLanguageApi as getDumlingLanguageApi,
	inspectId,
	supportedLanguages,
} from "dumling";
import type {
	DumlingId,
	DumlingIdInspection,
	EntityKind,
	EntityValue,
	InherentFeaturesFor,
	LanguageApi,
	Lemma,
	LemmaKindFor,
	LemmaSubKindFor,
	Selection,
	SupportedLanguage,
	Surface,
} from "dumling/types";

export { dumling, inspectId, supportedLanguages };

export type {
	DumlingId,
	DumlingIdInspection,
	EntityKind,
	EntityValue,
	InherentFeaturesFor,
	Lemma,
	LemmaKindFor,
	LemmaSubKindFor,
	Selection,
	SupportedLanguage,
	Surface,
};

export type DumlingEntityKind = EntityKind;

export function getLanguageApi<L extends SupportedLanguage>(
	language: L,
): LanguageApi<L> {
	return getDumlingLanguageApi(language) as unknown as LanguageApi<L>;
}

export function makeDumlingIdFor<L extends SupportedLanguage>(
	language: L,
	value: Lemma<L>,
): DumlingId<"Lemma", L>;
export function makeDumlingIdFor<L extends SupportedLanguage>(
	language: L,
	value: Surface<L>,
): DumlingId<"Surface", L>;
export function makeDumlingIdFor<L extends SupportedLanguage>(
	language: L,
	value: Selection<L>,
): DumlingId<"Selection", L>;
export function makeDumlingIdFor<L extends SupportedLanguage>(
	language: L,
	value: Lemma<L> | Surface<L> | Selection<L>,
) {
	return getLanguageApi(language).id.encode(value);
}

export function inspectDumlingId(id: string): DumlingIdInspection | undefined {
	return inspectId(id);
}
