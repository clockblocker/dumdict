import type { V0DumlingId, V0SupportedLang } from "../../dumling-compat";
import type { V0LemmaEntry } from "../public";
import {
	getInverseLexicalRelation,
	type V0LexicalRelation,
	v0LexicalRelationKeys,
} from "../relations/lexical";
import {
	getInverseMorphologicalRelation,
	type V0MorphologicalRelation,
	v0MorphologicalRelationKeys,
} from "../relations/morphological";
import { getMutableLemmaEntry } from "./lemma-store";
import type { V0InternalState } from "./state";

function ensureRelationSet<L extends V0SupportedLang, R extends string>(
	record: Partial<Record<R, V0DumlingId<"Lemma", L>[]>>,
	relation: R,
) {
	const existing = record[relation];
	if (existing) {
		return existing;
	}

	const created: V0DumlingId<"Lemma", L>[] = [];
	record[relation] = created;
	return created;
}

function addRelationValue<L extends V0SupportedLang, R extends string>(
	record: Partial<Record<R, V0DumlingId<"Lemma", L>[]>>,
	relation: R,
	targetId: V0DumlingId<"Lemma", L>,
) {
	const values = ensureRelationSet(record, relation);
	if (!values.includes(targetId)) {
		values.push(targetId);
		values.sort((left, right) => left.localeCompare(right));
	}
}

function removeRelationValue<L extends V0SupportedLang, R extends string>(
	record: Partial<Record<R, V0DumlingId<"Lemma", L>[]>>,
	relation: R,
	targetId: V0DumlingId<"Lemma", L>,
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

export function addResolvedLexicalRelationEdge<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	sourceLemmaId: V0DumlingId<"Lemma", L>,
	relation: V0LexicalRelation,
	targetLemmaId: V0DumlingId<"Lemma", L>,
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

export function removeResolvedLexicalRelationEdge<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	sourceLemmaId: V0DumlingId<"Lemma", L>,
	relation: V0LexicalRelation,
	targetLemmaId: V0DumlingId<"Lemma", L>,
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

export function addResolvedMorphologicalRelationEdge<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	sourceLemmaId: V0DumlingId<"Lemma", L>,
	relation: V0MorphologicalRelation,
	targetLemmaId: V0DumlingId<"Lemma", L>,
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
	L extends V0SupportedLang,
>(
	state: V0InternalState<L>,
	sourceLemmaId: V0DumlingId<"Lemma", L>,
	relation: V0MorphologicalRelation,
	targetLemmaId: V0DumlingId<"Lemma", L>,
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

export function removeAllResolvedRelationsForLemma<L extends V0SupportedLang>(
	state: V0InternalState<L>,
	entry: V0LemmaEntry<L>,
) {
	for (const relation of v0LexicalRelationKeys) {
		const targetIds = [...(entry.lexicalRelations[relation] ?? [])];
		for (const targetId of targetIds) {
			removeResolvedLexicalRelationEdge(state, entry.id, relation, targetId);
		}
	}

	for (const relation of v0MorphologicalRelationKeys) {
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
