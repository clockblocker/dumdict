export function normalizeLowercase(input: string) {
	return input.normalize("NFC").toLowerCase();
}

export function makeLookupKey(input: string) {
	return normalizeLowercase(input);
}

export function sortStrings(values: readonly string[]) {
	return Array.from(new Set(values)).sort((left, right) =>
		left.localeCompare(right),
	);
}

export function sortIds<T extends string>(values: readonly T[]) {
	return Array.from(new Set(values)).sort((left, right) =>
		left.localeCompare(right),
	);
}

export function toSortedRecord<K extends string, V>(
	entries: readonly (readonly [K, V])[],
) {
	return Object.fromEntries(
		[...entries].sort(([left], [right]) => left.localeCompare(right)),
	) as Record<K, V>;
}
