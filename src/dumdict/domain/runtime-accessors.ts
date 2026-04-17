import type {
	Lemma,
	ResolvedSurface,
	SupportedLang,
	UniversalLemmaKind,
	UniversalLemmaSubKind,
} from "dumling";

type LemmaRuntimeShape<L extends SupportedLang> = Lemma<L> & {
	canonicalLemma: string;
	language: L;
	lemmaKind: UniversalLemmaKind;
	morphemeKind?: UniversalLemmaSubKind;
	phrasemeKind?: UniversalLemmaSubKind;
	pos?: UniversalLemmaSubKind;
};

type ResolvedSurfaceRuntimeShape<L extends SupportedLang> =
	ResolvedSurface<L> & {
		lemma: Lemma<L>;
		language: L;
		normalizedFullSurface: string;
	};

function asLemmaRuntimeShape<L extends SupportedLang>(lemma: Lemma<L>) {
	return lemma as LemmaRuntimeShape<L>;
}

function asResolvedSurfaceRuntimeShape<L extends SupportedLang>(
	surface: ResolvedSurface<L>,
) {
	return surface as ResolvedSurfaceRuntimeShape<L>;
}

export function getLemmaCanonicalLemma<L extends SupportedLang>(lemma: Lemma<L>) {
	return asLemmaRuntimeShape(lemma).canonicalLemma;
}

export function getLemmaLanguage<L extends SupportedLang>(lemma: Lemma<L>) {
	return asLemmaRuntimeShape(lemma).language;
}

export function getLemmaSubKind<L extends SupportedLang>(lemma: Lemma<L>) {
	const runtimeLemma = asLemmaRuntimeShape(lemma);
	switch (runtimeLemma.lemmaKind) {
		case "Lexeme":
			return runtimeLemma.pos!;
		case "Morpheme":
			return runtimeLemma.morphemeKind!;
		case "Phraseme":
			return runtimeLemma.phrasemeKind!;
	}
}

export function getLemmaKind<L extends SupportedLang>(lemma: Lemma<L>) {
	return asLemmaRuntimeShape(lemma).lemmaKind;
}

export function getSurfaceLanguage<L extends SupportedLang>(
	surface: ResolvedSurface<L>,
) {
	return asResolvedSurfaceRuntimeShape(surface).language;
}

export function getSurfaceNormalizedFullSurface<L extends SupportedLang>(
	surface: ResolvedSurface<L>,
) {
	return asResolvedSurfaceRuntimeShape(surface).normalizedFullSurface;
}

export function getSurfaceLemma<L extends SupportedLang>(
	surface: ResolvedSurface<L>,
) {
	return asResolvedSurfaceRuntimeShape(surface).lemma;
}
