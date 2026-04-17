export function makeLexemeSurfaceReference<lemmaSubKind extends string>(
	lemmaSubKind: lemmaSubKind,
	canonicalLemma: string,
) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind,
		},
		lemma: {
			canonicalLemma,
		},
	};
}

export function makeMorphemeSurfaceReference<lemmaSubKind extends string>(
	lemmaSubKind: lemmaSubKind,
	canonicalLemma: string,
) {
	return {
		discriminators: {
			lemmaKind: "Morpheme" as const,
			lemmaSubKind,
		},
		lemma: {
			canonicalLemma,
		},
	};
}

export function makePhrasemeSurfaceReference<lemmaSubKind extends string>(
	lemmaSubKind: lemmaSubKind,
	canonicalLemma: string,
) {
	return {
		discriminators: {
			lemmaKind: "Phraseme" as const,
			lemmaSubKind,
		},
		lemma: {
			canonicalLemma,
		},
	};
}
