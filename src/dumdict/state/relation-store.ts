import type { DumlingId, SupportedLang } from "../../dumling-compat";
import type { LemmaEntry } from "../public";
import {
	getInverseLexicalRelation,
	type LexicalRelation,
	lexicalRelationKeys,
} from "../relations/lexical";
import {
	getInverseMorphologicalRelation,
	type MorphologicalRelation,
	morphologicalRelationKeys,
} from "../relations/morphological";
import { getMutableLemmaEntry } from "./lemma-store";
import type { InternalState } from "./state";

function ensureRelationSet<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relation: R,
) {
	const existing = record[relation];
	if (existing) {
		return existing;
	}

	const created: DumlingId<"Lemma", L>[] = [];
	record[relation] = created;
	return created;
}

function addRelationValue<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relation: R,
	targetId: DumlingId<"Lemma", L>,
) {
	const values = ensureRelationSet(record, relation);
	if (!values.includes(targetId)) {
		values.push(targetId);
		values.sort((left, right) => left.localeCompare(right));
	}
}

function removeRelationValue<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relation: R,
	targetId: DumlingId<"Lemma", L>,
) {
	const values = record[relation];
	if (!values) {
		return;
	}

	const filtered = values.filter((value) => value !== targetId);
	if (filtered.length === 0) {
		delete record[relation];
		return;
	}

	record[relation] = filtered;
}

export function addResolvedLexicalRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: LexicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	addRelationValue(sourceEntry.lexicalRelations, relation, targetLemmaId);
	addRelationValue(
		targetEntry.lexicalRelations,
		getInverseLexicalRelation(relation),
		sourceLemmaId,
	);
}

export function removeResolvedLexicalRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: LexicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	removeRelationValue(sourceEntry.lexicalRelations, relation, targetLemmaId);
	removeRelationValue(
		targetEntry.lexicalRelations,
		getInverseLexicalRelation(relation),
		sourceLemmaId,
	);
}

export function addResolvedMorphologicalRelationEdge<L extends SupportedLang>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: MorphologicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	addRelationValue(sourceEntry.morphologicalRelations, relation, targetLemmaId);
	addRelationValue(
		targetEntry.morphologicalRelations,
		getInverseMorphologicalRelation(relation),
		sourceLemmaId,
	);
}

export function removeResolvedMorphologicalRelationEdge<
	L extends SupportedLang,
>(
	state: InternalState<L>,
	sourceLemmaId: DumlingId<"Lemma", L>,
	relation: MorphologicalRelation,
	targetLemmaId: DumlingId<"Lemma", L>,
) {
	const sourceEntry = getMutableLemmaEntry(state, sourceLemmaId);
	const targetEntry = getMutableLemmaEntry(state, targetLemmaId);
	if (!sourceEntry || !targetEntry) {
		return;
	}

	removeRelationValue(
		sourceEntry.morphologicalRelations,
		relation,
		targetLemmaId,
	);
	removeRelationValue(
		targetEntry.morphologicalRelations,
		getInverseMorphologicalRelation(relation),
		sourceLemmaId,
	);
}

export function removeAllResolvedRelationsForLemma<L extends SupportedLang>(
	state: InternalState<L>,
	entry: LemmaEntry<L>,
) {
	for (const relation of lexicalRelationKeys) {
		const targetIds = [...(entry.lexicalRelations[relation] ?? [])];
		for (const targetId of targetIds) {
			removeResolvedLexicalRelationEdge(state, entry.id, relation, targetId);
		}
	}

	for (const relation of morphologicalRelationKeys) {
		const targetIds = [...(entry.morphologicalRelations[relation] ?? [])];
		for (const targetId of targetIds) {
			removeResolvedMorphologicalRelationEdge(
				state,
				entry.id,
				relation,
				targetId,
			);
		}
	}
}
