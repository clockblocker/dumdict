import { dumling } from "dumling";
import type {
	IdDecodeError,
	InherentFeaturesFor,
	Lemma,
	LemmaKindFor,
	LemmaSubKindFor,
	Selection,
	SupportedLanguage,
	Surface,
} from "dumling/types";

export { dumling };

export type {
	InherentFeaturesFor,
	Lemma,
	LemmaKindFor,
	LemmaSubKindFor,
	Selection,
	SupportedLanguage,
	Surface,
};

export type DumlingEntityKind = "Lemma" | "Selection" | "Surface";

export type DumlingId<
	K extends DumlingEntityKind = DumlingEntityKind,
	L extends SupportedLanguage = SupportedLanguage,
> = string & {
	readonly __dumlingIdKind?: K;
	readonly __dumlingIdLanguage?: L;
};

const supportedLanguages = ["de", "en", "he"] as const satisfies readonly SupportedLanguage[];

type LanguageApiFor<L extends SupportedLanguage> = L extends "de"
	? typeof dumling.de
	: L extends "en"
		? typeof dumling.en
		: typeof dumling.he;

export function getLanguageApi<L extends SupportedLanguage>(
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
	const languageApi = getLanguageApi(language) as {
		id: { encode(value: unknown): string };
	};
	return languageApi.id.encode(value) as DumlingId<DumlingEntityKind, L>;
}

function isIdDecodeErrorWithCode(
	error: IdDecodeError,
	code: IdDecodeError["code"],
) {
	return error.code === code;
}

export function inspectDumlingId(id: string):
	| {
			kind: DumlingEntityKind;
			language: SupportedLanguage;
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
