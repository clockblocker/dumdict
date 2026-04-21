/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */
import {
	dumling,
	type Lemma,
	type Surface,
} from "../../src/dumling-compat";
import {
	type DumdictResult,
	type LemmaEntry,
	makeDumdict,
	type SurfaceEntry,
} from "../../src";

function unwrap<T>(result: DumdictResult<T>) {
	if (result.isErr()) {
		throw new Error(`${result.error.code}: ${result.error.message}`);
	}

	return result.value;
}

const walkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "en",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	lemmaSubKind: "VERB",
} satisfies Lemma<"en", "Lexeme", "VERB">;

const runLemma = {
	canonicalLemma: "run",
	inherentFeatures: {},
	language: "en",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🏃",
	lemmaSubKind: "VERB",
} satisfies Lemma<"en", "Lexeme", "VERB">;

const walkSurface = {
	inflectionalFeatures: {
		tense: "Pres",
		verbForm: "Fin",
	},
	language: "en",
	normalizedFullSurface: "walk",
	surfaceKind: "Inflection",
	lemma: walkLemma,
} satisfies Surface<"en", "Inflection", "Lexeme", "VERB">;

// README_BLOCK:english-walk-lemma-entry:start
const walkEntry = {
	id: dumling.en.id.encode(walkLemma) as LemmaEntry<"en">["id"],
	lemma: walkLemma,
	lexicalRelations: {},
	morphologicalRelations: {},
	attestedTranslations: ["caminar", "gehen"],
	attestations: ["They walk home together."],
	notes: "Core motion verb.",
} satisfies LemmaEntry<"en">;
// README_BLOCK:english-walk-lemma-entry:end

// README_BLOCK:english-walk-surface-entry:start
const walkSurfaceEntry = {
	id: dumling.en.id.encode(walkSurface) as SurfaceEntry<"en">["id"],
	surface: walkSurface,
	ownerLemmaId: walkEntry.id,
	attestedTranslations: ["walk"],
	attestations: ["They walk home together."],
	notes: "Present finite surface.",
} satisfies SurfaceEntry<"en">;
// README_BLOCK:english-walk-surface-entry:end

// README_BLOCK:reciprocal-relations:start
const runEntry = {
	id: dumling.en.id.encode(runLemma) as LemmaEntry<"en">["id"],
	lemma: runLemma,
	lexicalRelations: {},
	morphologicalRelations: {},
	attestedTranslations: [],
	attestations: [],
	notes: "",
} satisfies LemmaEntry<"en">;

const dictForRelations = makeDumdict("en");
unwrap(dictForRelations.upsertLemmaEntry(walkEntry));
unwrap(dictForRelations.upsertLemmaEntry(runEntry));
unwrap(
	dictForRelations.patchLemmaEntry(walkEntry.id, {
		op: "addLexicalRelation",
		relation: "synonym",
		target: { kind: "existing", lemmaId: runEntry.id },
	}),
);

const runRelations = unwrap(
	dictForRelations.getLemmaEntry(runEntry.id),
).lexicalRelations;
// { synonym: [walkEntry.id] }
// README_BLOCK:reciprocal-relations:end

// README_BLOCK:quickstart-walk:start
const dict = makeDumdict("en");
unwrap(dict.upsertLemmaEntry(walkEntry));
unwrap(dict.upsertSurfaceEntry(walkSurfaceEntry));

const lookup = unwrap(dict.lookupBySurface("WALK"));
const foundLemmaIds = Object.keys(lookup.lemmas);
const foundSurfaceIds = Object.keys(lookup.surfaces);
// README_BLOCK:quickstart-walk:end
