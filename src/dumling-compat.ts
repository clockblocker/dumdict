import { dumling } from "dumling";
import type {
	IdDecodeError,
	InflectionalFeaturesFor as DumlingInflectionalFeaturesFor,
	InherentFeaturesFor as DumlingInherentFeaturesFor,
	Lemma as DumlingLemma,
	LemmaKind as DumlingLemmaKind,
	LemmaKindFor as DumlingLemmaKindFor,
	LemmaSubKind as DumlingLemmaSubKind,
	LemmaSubKindFor as DumlingLemmaSubKindFor,
	Selection as DumlingSelection,
	SupportedLanguage as DumlingSupportedLanguage,
	Surface as DumlingSurface,
} from "dumling/types";

export { dumling };

export type SupportedLang = DumlingSupportedLanguage;

export const supportedLanguages = ["de", "en", "he"] as const satisfies readonly SupportedLang[];

type EntityKind = "Lemma" | "Selection" | "Surface";

type LanguageApiFor<L extends SupportedLang> = L extends "de"
	? typeof dumling.de
	: L extends "en"
		? typeof dumling.en
		: typeof dumling.he;

export function getLanguageApi<L extends SupportedLang>(
	language: L,
): LanguageApiFor<L> {
	switch (language) {
		case "de":
			return dumling.de as LanguageApiFor<L>;
		case "en":
			return dumling.en as LanguageApiFor<L>;
		case "he":
			return dumling.he as LanguageApiFor<L>;
	}
}

export type UniversalLemmaKind = DumlingLemmaKind;

export type UniversalLemmaSubKind = DumlingLemmaSubKind;

export type LemmaKindFor<L extends SupportedLang> = DumlingLemmaKindFor<L>;

export type LemmaSubKindFor<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
> = DumlingLemmaSubKindFor<L, LK>;

export type InherentFeaturesFor<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK>,
> = DumlingInherentFeaturesFor<L, LK, LSK>;

export type InflectionalFeaturesFor<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK>,
> = DumlingInflectionalFeaturesFor<L, LK, LSK>;

export type DumlingId<
	K extends EntityKind = EntityKind,
	L extends SupportedLang = SupportedLang,
> = string & {
	readonly __dumlingIdKind?: K;
	readonly __dumlingIdLanguage?: L;
};

export type Lemma<
	L extends SupportedLang = SupportedLang,
	LK extends LemmaKindFor<L> = LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK> = LemmaSubKindFor<L, LK>,
> = DumlingLemma<L, LK, LSK>;

export type Surface<
	L extends SupportedLang = SupportedLang,
	SK extends string = string,
	LK extends LemmaKindFor<L> = LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK> = LemmaSubKindFor<L, LK>,
> = DumlingSurface<L> & {
	language: L;
	surfaceKind: SK;
	lemma: Lemma<L, LK, LSK>;
};

export type Selection<
	L extends SupportedLang = SupportedLang,
	OS extends string = string,
	SK extends string = string,
	LK extends LemmaKindFor<L> = LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK> = LemmaSubKindFor<L, LK>,
> = DumlingSelection<L> & {
	language: L;
	orthographicStatus: OS;
	surface: Surface<L, SK, LK, LSK>;
};

type EntityForKind<
	K extends EntityKind,
	L extends SupportedLang,
> = K extends "Lemma"
	? Lemma<L>
	: K extends "Surface"
		? Surface<L>
		: Selection<L>;

function isIdDecodeErrorWithCode(
	error: IdDecodeError,
	code: IdDecodeError["code"],
) {
	return error.code === code;
}

export function makeDumlingIdFor<L extends SupportedLang>(
	language: L,
	value: Lemma<L>,
): DumlingId<"Lemma", L>;
export function makeDumlingIdFor<L extends SupportedLang>(
	language: L,
	value: Surface<L>,
): DumlingId<"Surface", L>;
export function makeDumlingIdFor<L extends SupportedLang>(
	language: L,
	value: Selection<L>,
): DumlingId<"Selection", L>;
export function makeDumlingIdFor<L extends SupportedLang>(
	language: L,
	value: Lemma<L> | Surface<L> | Selection<L>,
) {
	const languageApi = getLanguageApi(language) as {
		id: {
			encode(value: unknown): string;
		};
	};
	return languageApi.id.encode(value) as DumlingId<EntityKind, L>;
}

export function decodeDumlingIdAs<
	L extends SupportedLang,
	K extends EntityKind,
>(language: L, kind: K, id: string): EntityForKind<K, L> | undefined {
	const result = getLanguageApi(language).id.decodeAs(kind, id);
	return result.success ? (result.data as EntityForKind<K, L>) : undefined;
}

export function inspectDumlingId(id: string):
	| {
			kind: EntityKind;
			language: SupportedLang;
	  }
	| undefined {
	for (const language of supportedLanguages) {
		const result = getLanguageApi(language).id.decode(id);
		if (result.success) {
			return {
				kind: result.data.entityKind,
				language,
			};
		}

		if (
			!isIdDecodeErrorWithCode(result.error, "LanguageMismatch") &&
			!isIdDecodeErrorWithCode(result.error, "MalformedId")
		) {
			return undefined;
		}
	}

	return undefined;
}
