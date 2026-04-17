function ensureLookupBucket<K extends string>(
	index: Map<string, Set<K>>,
	key: string,
): Set<K> {
	const existing = index.get(key);
	if (existing) {
		return existing;
	}

	const created = new Set<K>();
	index.set(key, created);
	return created;
}

export function addLookupValue<K extends string>(
	index: Map<string, Set<K>>,
	key: string,
	value: K,
) {
	ensureLookupBucket(index, key).add(value);
}

export function removeLookupValue<K extends string>(
	index: Map<string, Set<K>>,
	key: string,
	value: K,
) {
	const bucket = index.get(key);
	if (!bucket) {
		return;
	}

	bucket.delete(value);
	if (bucket.size === 0) {
		index.delete(key);
	}
}
