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

export type V0SupportedLang = DumlingSupportedLanguage;

export const v0SupportedLanguages = ["de", "en", "he"] as const satisfies readonly V0SupportedLang[];

type EntityKind = "Lemma" | "Selection" | "Surface";

type LanguageApiFor<L extends V0SupportedLang> = L extends "de"
	? typeof dumling.de
	: L extends "en"
		? typeof dumling.en
		: typeof dumling.he;

export function getLanguageApi<L extends V0SupportedLang>(
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

export type V0UniversalLemmaKind = DumlingLemmaKind;

export type V0UniversalLemmaSubKind = DumlingLemmaSubKind;

export type V0LemmaKindFor<L extends V0SupportedLang> = DumlingLemmaKindFor<L>;

export type V0LemmaSubKindFor<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
> = DumlingLemmaSubKindFor<L, LK>;

export type V0InherentFeaturesFor<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK>,
> = DumlingInherentFeaturesFor<L, LK, LSK>;

export type V0InflectionalFeaturesFor<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK>,
> = DumlingInflectionalFeaturesFor<L, LK, LSK>;

export type V0DumlingId<
	K extends EntityKind = EntityKind,
	L extends V0SupportedLang = V0SupportedLang,
> = string & {
	readonly __dumlingIdKind?: K;
	readonly __dumlingIdLanguage?: L;
};

export type V0Lemma<
	L extends V0SupportedLang = V0SupportedLang,
	LK extends V0LemmaKindFor<L> = V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK> = V0LemmaSubKindFor<L, LK>,
> = DumlingLemma<L, LK, LSK>;

export type V0Surface<
	L extends V0SupportedLang = V0SupportedLang,
	SK extends string = string,
	LK extends V0LemmaKindFor<L> = V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK> = V0LemmaSubKindFor<L, LK>,
> = DumlingSurface<L> & {
	language: L;
	surfaceKind: SK;
	lemma: V0Lemma<L, LK, LSK>;
};

export type V0Selection<
	L extends V0SupportedLang = V0SupportedLang,
	OS extends string = string,
	SK extends string = string,
	LK extends V0LemmaKindFor<L> = V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK> = V0LemmaSubKindFor<L, LK>,
> = DumlingSelection<L> & {
	language: L;
	orthographicStatus: OS;
	surface: V0Surface<L, SK, LK, LSK>;
};

type EntityForKind<
	K extends EntityKind,
	L extends V0SupportedLang,
> = K extends "Lemma"
	? V0Lemma<L>
	: K extends "Surface"
		? V0Surface<L>
		: V0Selection<L>;

function isIdDecodeErrorWithCode(
	error: IdDecodeError,
	code: IdDecodeError["code"],
) {
	return error.code === code;
}

export function makeDumlingIdFor<L extends V0SupportedLang>(
	language: L,
	value: V0Lemma<L>,
): V0DumlingId<"Lemma", L>;
export function makeDumlingIdFor<L extends V0SupportedLang>(
	language: L,
	value: V0Surface<L>,
): V0DumlingId<"Surface", L>;
export function makeDumlingIdFor<L extends V0SupportedLang>(
	language: L,
	value: V0Selection<L>,
): V0DumlingId<"Selection", L>;
export function makeDumlingIdFor<L extends V0SupportedLang>(
	language: L,
	value: V0Lemma<L> | V0Surface<L> | V0Selection<L>,
) {
	const languageApi = getLanguageApi(language) as {
		id: {
			encode(value: unknown): string;
		};
	};
	return languageApi.id.encode(value) as V0DumlingId<EntityKind, L>;
}

export function decodeDumlingIdAs<
	L extends V0SupportedLang,
	K extends EntityKind,
>(language: L, kind: K, id: string): EntityForKind<K, L> | undefined {
	const result = getLanguageApi(language).id.decodeAs(kind, id);
	return result.success ? (result.data as EntityForKind<K, L>) : undefined;
}

export function inspectDumlingId(id: string):
	| {
			kind: EntityKind;
			language: V0SupportedLang;
	  }
	| undefined {
	for (const language of v0SupportedLanguages) {
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
