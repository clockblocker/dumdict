import type { DumlingId, SupportedLang } from "dumling";
import { sortIds, sortStrings, toSortedRecord } from "../domain/collections";
import type { LemmaEntry, PendingLemmaRef, SurfaceEntry } from "../public";
import { lexicalRelationKeys } from "../relations/lexical";
import { morphologicalRelationKeys } from "../relations/morphological";
import type { InternalState } from "./state";

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

function cloneRelationRecord<L extends SupportedLang, R extends string>(
	record: Partial<Record<R, DumlingId<"Lemma", L>[]>>,
	relationKeys: readonly R[],
) {
	const entries: [R, DumlingId<"Lemma", L>[]][] = [];
	for (const relationKey of relationKeys) {
		const values = record[relationKey];
		if (!values || values.length === 0) {
			continue;
		}

		entries.push([relationKey, sortIds(values)]);
	}

	return toSortedRecord(entries);
}

export function cloneLemmaEntry<L extends SupportedLang>(
	entry: LemmaEntry<L>,
): LemmaEntry<L> {
	return {
		id: entry.id,
		lemma: structuredClone(entry.lemma),
		lexicalRelations: cloneRelationRecord(
			entry.lexicalRelations,
			lexicalRelationKeys,
		),
		morphologicalRelations: cloneRelationRecord(
			entry.morphologicalRelations,
			morphologicalRelationKeys,
		),
		attestedTranslations: sortStrings(entry.attestedTranslations),
		attestations: sortStrings(entry.attestations),
		notes: entry.notes,
	};
}

export function cloneSurfaceEntry<L extends SupportedLang>(
	entry: SurfaceEntry<L>,
): SurfaceEntry<L> {
	return {
		id: entry.id,
		surface: structuredClone(entry.surface),
		ownerLemmaId: entry.ownerLemmaId,
		attestedTranslations: sortStrings(entry.attestedTranslations),
		attestations: sortStrings(entry.attestations),
		notes: entry.notes,
	};
}

export function clonePendingLemmaRef<L extends SupportedLang>(
	ref: PendingLemmaRef<L>,
): PendingLemmaRef<L> {
	return { ...ref };
}

export function cloneState<L extends SupportedLang>(
	state: InternalState<L>,
): InternalState<L> {
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
