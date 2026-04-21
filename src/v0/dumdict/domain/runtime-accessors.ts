import {
	type DumlingId,
	type Lemma,
	type LemmaKindFor,
	type LemmaSubKindFor,
	makeDumlingIdFor,
	type SupportedLang,
	type Surface,
} from "../../dumling-compat";

export type LemmaIdentityInput<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK>,
> = {
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: LSK;
};

export type LemmaIdentityInputForLanguage<L extends SupportedLang> = {
	[LK in LemmaKindFor<L>]: {
		[LSK in LemmaSubKindFor<L, LK>]: LemmaIdentityInput<L, LK, LSK>;
	}[LemmaSubKindFor<L, LK>];
}[LemmaKindFor<L>];

export type LemmaIdentity<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK>,
> = LemmaIdentityInput<L, LK, LSK> & {
	language: L;
};

export type LemmaIdentityForLanguage<L extends SupportedLang> = {
	[LK in LemmaKindFor<L>]: {
		[LSK in LemmaSubKindFor<L, LK>]: LemmaIdentity<L, LK, LSK>;
	}[LemmaSubKindFor<L, LK>];
}[LemmaKindFor<L>];

export function getLemmaIdentity<L extends SupportedLang>(lemma: Lemma<L>) {
	return {
		canonicalLemma: lemma.canonicalLemma,
		language: lemma.language,
		lemmaKind: lemma.lemmaKind,
		lemmaSubKind: lemma.lemmaSubKind,
	} as LemmaIdentityForLanguage<L>;
}

export function getLemmaCanonicalLemma<L extends SupportedLang>(
	lemma: Lemma<L>,
) {
	return lemma.canonicalLemma;
}

export function getLemmaLanguage<L extends SupportedLang>(lemma: Lemma<L>) {
	return lemma.language;
}

export function getLemmaSubKind<L extends SupportedLang>(lemma: Lemma<L>) {
	return lemma.lemmaSubKind as Lemma<L>["lemmaSubKind"];
}

export function getLemmaKind<L extends SupportedLang>(
	lemma: Lemma<L>,
): Lemma<L>["lemmaKind"] {
	return lemma.lemmaKind;
}

export function getSurfaceLanguage<L extends SupportedLang>(
	surface: Surface<L>,
) {
	return surface.language;
}

export function getSurfaceNormalizedFullSurface<L extends SupportedLang>(
	surface: Surface<L>,
) {
	return surface.normalizedFullSurface;
}

export function getSurfaceLemma<L extends SupportedLang>(
	surface: Surface<L>,
): Lemma<L> {
	return surface.lemma;
}

export function getSurfaceOwnerLemmaId<L extends SupportedLang>(
	surface: Surface<L>,
) {
	return makeDumlingIdFor(surface.language, surface.lemma) as DumlingId<
		"Lemma",
		L
	>;
}
