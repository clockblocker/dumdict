/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */
import { dumling, type Lemma, type ResolvedSurface } from "dumling";
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
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const runLemma = {
	canonicalLemma: "run",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🏃",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const walkSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	inflectionalFeatures: {
		tense: "Pres",
		verbForm: "Fin",
	},
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Inflection",
	lemma: walkLemma,
} satisfies ResolvedSurface<
	"English",
	"Standard",
	"Inflection",
	"Lexeme",
	"VERB"
>;

// README_BLOCK:english-walk-lemma-entry:start
const walkEntry = {
	id: dumling.idCodec.English.makeDumlingIdFor(walkLemma),
	lemma: walkLemma,
	lexicalRelations: {},
	morphologicalRelations: {},
	attestedTranslations: ["caminar", "gehen"],
	attestations: ["They walk home together."],
	notes: "Core motion verb.",
} satisfies LemmaEntry<"English">;
// README_BLOCK:english-walk-lemma-entry:end

// README_BLOCK:english-walk-surface-entry:start
const walkSurfaceEntry = {
	id: dumling.idCodec.English.makeDumlingIdFor(walkSurface),
	surface: walkSurface,
	ownerLemmaId: walkEntry.id,
	attestedTranslations: ["walk"],
	attestations: ["They walk home together."],
	notes: "Present finite surface.",
} satisfies SurfaceEntry<"English">;
// README_BLOCK:english-walk-surface-entry:end

// README_BLOCK:reciprocal-relations:start
const runEntry = {
	id: dumling.idCodec.English.makeDumlingIdFor(runLemma),
	lemma: runLemma,
	lexicalRelations: {},
	morphologicalRelations: {},
	attestedTranslations: [],
	attestations: [],
	notes: "",
} satisfies LemmaEntry<"English">;

const dictForRelations = makeDumdict("English");
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
const dict = makeDumdict("English");
unwrap(dict.upsertLemmaEntry(walkEntry));
unwrap(dict.upsertSurfaceEntry(walkSurfaceEntry));

const lookup = unwrap(dict.lookupBySurface("WALK"));
const foundLemmaIds = Object.keys(lookup.lemmas);
const foundSurfaceIds = Object.keys(lookup.surfaces);
// README_BLOCK:quickstart-walk:end
