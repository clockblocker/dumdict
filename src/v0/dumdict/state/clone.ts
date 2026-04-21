import type { V0DumlingId, V0SupportedLang } from "../../dumling-compat";
import { sortIds, sortStrings, toSortedRecord } from "../domain/collections";
import type { V0LemmaEntry, V0PendingLemmaRef, V0SurfaceEntry } from "../public";
import { v0LexicalRelationKeys } from "../relations/lexical";
import { v0MorphologicalRelationKeys } from "../relations/morphological";
import type { V0InternalState } from "./state";

function cloneMapOfSets<K, V>(input: Map<K, Set<V>>): Map<K, Set<V>> {
	const next = new Map<K, Set<V>>();
	for (const [key, values] of input) {
		next.set(key, new Set(values));
	}
	return next;
}

function cloneMapOfMaps<K, IK, V>(
	input: Map<K, Map<IK, V>>,
): Map<K, Map<IK, V>> {
	const next = new Map<K, Map<IK, V>>();
	for (const [key, values] of input) {
		next.set(key, new Map(values));
	}
	return next;
}

function cloneRelationRecord<L extends V0SupportedLang, R extends string>(
	record: Partial<Record<R, V0DumlingId<"Lemma", L>[]>>,
	relationKeys: readonly R[],
) {
	const entries: [R, V0DumlingId<"Lemma", L>[]][] = [];
	for (const relationKey of relationKeys) {
		const values = record[relationKey];
		if (!values || values.length === 0) {
			continue;
		}

		entries.push([relationKey, sortIds(values)]);
	}

	return toSortedRecord(entries);
}

export function cloneLemmaEntry<L extends V0SupportedLang>(
	entry: V0LemmaEntry<L>,
): V0LemmaEntry<L> {
	return {
		id: entry.id,
		lemma: structuredClone(entry.lemma),
		lexicalRelations: cloneRelationRecord(
			entry.lexicalRelations,
			v0LexicalRelationKeys,
		),
		morphologicalRelations: cloneRelationRecord(
			entry.morphologicalRelations,
			v0MorphologicalRelationKeys,
		),
		attestedTranslations: sortStrings(entry.attestedTranslations),
		attestations: sortStrings(entry.attestations),
		notes: entry.notes,
	};
}

export function cloneSurfaceEntry<L extends V0SupportedLang>(
	entry: V0SurfaceEntry<L>,
): V0SurfaceEntry<L> {
	return {
		id: entry.id,
		surface: structuredClone(entry.surface),
		ownerLemmaId: entry.ownerLemmaId,
		attestedTranslations: sortStrings(entry.attestedTranslations),
		attestations: sortStrings(entry.attestations),
		notes: entry.notes,
	};
}

export function clonePendingLemmaRef<L extends V0SupportedLang>(
	ref: V0PendingLemmaRef<L>,
): V0PendingLemmaRef<L> {
	return { ...ref };
}

export function cloneState<L extends V0SupportedLang>(
	state: V0InternalState<L>,
): V0InternalState<L> {
	return {
		lemmasById: new Map(
			Array.from(state.lemmasById, ([id, entry]) => [
				id,
				cloneLemmaEntry(entry),
			]),
		),
		surfacesById: new Map(
			Array.from(state.surfacesById, ([id, entry]) => [
				id,
				cloneSurfaceEntry(entry),
			]),
		),
		surfaceIdsByOwnerLemmaId: cloneMapOfSets(state.surfaceIdsByOwnerLemmaId),
		lemmaLookupIndex: cloneMapOfSets(state.lemmaLookupIndex),
		surfaceLookupIndex: cloneMapOfSets(state.surfaceLookupIndex),
		pendingLemmaRefsById: new Map(
			Array.from(state.pendingLemmaRefsById, ([id, ref]) => [
				id,
				clonePendingLemmaRef(ref),
			]),
		),
		pendingRelationsBySourceLemmaId: cloneMapOfMaps(
			state.pendingRelationsBySourceLemmaId,
		),
		pendingRelationsByPendingId: cloneMapOfMaps(
			state.pendingRelationsByPendingId,
		),
	};
}
