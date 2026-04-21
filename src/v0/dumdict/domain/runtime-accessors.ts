import {
	type V0DumlingId,
	type V0Lemma,
	type V0LemmaKindFor,
	type V0LemmaSubKindFor,
	makeDumlingIdFor,
	type V0SupportedLang,
	type V0Surface,
} from "../../dumling-compat";

export type V0LemmaIdentityInput<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK>,
> = {
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: LSK;
};

export type V0LemmaIdentityInputForLanguage<L extends V0SupportedLang> = {
	[LK in V0LemmaKindFor<L>]: {
		[LSK in V0LemmaSubKindFor<L, LK>]: V0LemmaIdentityInput<L, LK, LSK>;
	}[V0LemmaSubKindFor<L, LK>];
}[V0LemmaKindFor<L>];

export type V0LemmaIdentity<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	LSK extends V0LemmaSubKindFor<L, LK>,
> = V0LemmaIdentityInput<L, LK, LSK> & {
	language: L;
};

export type V0LemmaIdentityForLanguage<L extends V0SupportedLang> = {
	[LK in V0LemmaKindFor<L>]: {
		[LSK in V0LemmaSubKindFor<L, LK>]: V0LemmaIdentity<L, LK, LSK>;
	}[V0LemmaSubKindFor<L, LK>];
}[V0LemmaKindFor<L>];

export function getLemmaIdentity<L extends V0SupportedLang>(lemma: V0Lemma<L>) {
	return {
		canonicalLemma: lemma.canonicalLemma,
		language: lemma.language,
		lemmaKind: lemma.lemmaKind,
		lemmaSubKind: lemma.lemmaSubKind,
	} as V0LemmaIdentityForLanguage<L>;
}

export function getLemmaCanonicalLemma<L extends V0SupportedLang>(
	lemma: V0Lemma<L>,
) {
	return lemma.canonicalLemma;
}

export function getLemmaLanguage<L extends V0SupportedLang>(lemma: V0Lemma<L>) {
	return lemma.language;
}

export function getLemmaSubKind<L extends V0SupportedLang>(lemma: V0Lemma<L>) {
	return lemma.lemmaSubKind as V0Lemma<L>["lemmaSubKind"];
}

export function getLemmaKind<L extends V0SupportedLang>(
	lemma: V0Lemma<L>,
): V0Lemma<L>["lemmaKind"] {
	return lemma.lemmaKind;
}

export function getSurfaceLanguage<L extends V0SupportedLang>(
	surface: V0Surface<L>,
) {
	return surface.language;
}

export function getSurfaceNormalizedFullSurface<L extends V0SupportedLang>(
	surface: V0Surface<L>,
) {
	return surface.normalizedFullSurface;
}

export function getSurfaceLemma<L extends V0SupportedLang>(
	surface: V0Surface<L>,
): V0Lemma<L> {
	return surface.lemma;
}

export function getSurfaceOwnerLemmaId<L extends V0SupportedLang>(
	surface: V0Surface<L>,
) {
	return makeDumlingIdFor(surface.language, surface.lemma) as V0DumlingId<
		"Lemma",
		L
	>;
}
