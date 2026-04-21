# `dumling` Export Requests From `dumdict`

`dumdict` currently keeps a small adapter layer around `dumling` in
`src/dumling.ts`. Most of that layer exists because `dumling` exposes the
language-specific APIs, but not the generic helpers and named types that a
consumer package needs when the language is dynamic.

This note records the helpers, builders, and types that would make sense to
export from `dumling`.

## High Value

### `DumlingId<K, L>`

`dumling.id.encode()` currently returns `string`, so `dumdict` defines its own
branded ID type:

```ts
export type DumlingId<
	K extends DumlingEntityKind = DumlingEntityKind,
	L extends SupportedLanguage = SupportedLanguage,
> = string & {
	readonly __dumlingIdKind?: K;
	readonly __dumlingIdLanguage?: L;
};
```

This should live in `dumling/types` because stable IDs are part of the core
cross-package contract.

### Generic ID encode helper

`dumdict` wraps language-specific `id.encode` as `makeDumlingIdFor(language,
value)`.

Suggested `dumling` shape:

```ts
function encodeId<L extends SupportedLanguage>(
	language: L,
	value: Lemma<L>,
): DumlingId<"Lemma", L>;
function encodeId<L extends SupportedLanguage>(
	language: L,
	value: Surface<L>,
): DumlingId<"Surface", L>;
function encodeId<L extends SupportedLanguage>(
	language: L,
	value: Selection<L>,
): DumlingId<"Selection", L>;
```

This is useful whenever a host stores one language-bound service but receives
the language as runtime data.

### `inspectId` / `decodeAnyId`

`dumdict` currently probes each supported language to inspect an ID:

```ts
for (const language of supportedLanguages) {
	const result = getLanguageApi(language).id.decode(id);
	// ...
}
```

Since `dumling` IDs already contain both language and entity kind in the payload,
`dumling` could expose a package-level helper that returns metadata without the
caller knowing the language up front.

Suggested shape:

```ts
type DumlingIdInspection = {
	kind: EntityKind;
	language: SupportedLanguage;
};

function inspectId(id: string): DumlingIdInspection | undefined;
```

or a fuller `decodeAnyId(id)` returning the decoded DTO as well.

### `getLanguageApi(language)`

`dumdict` keeps a local language switch:

```ts
function getLanguageApi<L extends SupportedLanguage>(language: L) {
	switch (language) {
		case "de":
			return dumling.de;
		case "en":
			return dumling.en;
		case "he":
			return dumling.he;
	}
}
```

This belongs in `dumling` so consumers do not hardcode the supported language
set or lose the `LanguageApi<L>` type relationship.

### `supportedLanguages`

`dumdict` also maintains its own `["de", "en", "he"]` list. That list must track
`dumling` exactly, so it should be exported by `dumling`.

Suggested shape:

```ts
const supportedLanguages: readonly SupportedLanguage[];
```

## Medium Value

### `EntityValue<L>` and `EntityForKind<L, K>`

`dumling` appears to have these internally, but they are not exported. Downstream
packages often need to name `Lemma<L> | Surface<L> | Selection<L>` and map
entity kinds back to DTOs.

Suggested exports:

```ts
type EntityValue<L extends SupportedLanguage> =
	| Lemma<L>
	| Surface<L>
	| Selection<L>;

type EntityForKind<
	L extends SupportedLanguage,
	K extends EntityKind,
> = K extends "Lemma"
	? Lemma<L>
	: K extends "Surface"
		? Surface<L>
		: Selection<L>;
```

### `SelectionOptionsFor<OS>`

`convert.lemma.toSelection()` and `convert.surface.toSelection()` accept this
shape, but the type is internal. Consumers writing wrappers cannot name it
directly.

Suggested export:

```ts
type SelectionOptionsFor<OS extends OrthographicStatus> = {
	orthographicStatus?: OS;
	selectionCoverage?: SelectionCoverage;
	spelledSelection?: string;
	spellingRelation?: SpellingRelation;
};
```

### Named create input types

The create API exposes inline parameter types. Named input types would make it
easier for hosts to type LLM boundaries and builder functions without using
`Parameters<typeof dumling.en.create...>`.

Candidate names:

- `LemmaInput<L, LK, LSK>`
- `LemmaSurfaceInput<L, LK, LSK>`
- `InflectionSurfaceInput<L, LK, LSK>`
- `StandardSelectionInput<L, SK, LK, LSK>`
- `TypoSelectionInput<L, SK, LK, LSK>`

### Lemma identity descriptor including `canonicalLemma`

`dumling` exports `LemmaDescriptor`, but it contains only:

```ts
{
	language: L;
	lemmaKind: LK;
	lemmaSubKind: LSK;
}
```

`dumdict` needs a lookup identity that also includes `canonicalLemma`. It
currently defines similar local shapes as `LemmaDescription` and
`PendingLemmaIdentity`.

Suggested shape:

```ts
type LemmaIdentity<
	L extends SupportedLanguage,
	LK extends LemmaKindFor<L> = LemmaKindFor<L>,
	LSK extends LemmaSubKindFor<L, LK> = LemmaSubKindFor<L, LK>,
> = {
	language: L;
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: LSK;
};
```

This is useful for search, pending references, and user workflows that have
resolved a lemma identity but have not selected a stored sense.

## Lower Priority

### ID assertion helpers

Once `DumlingId`, `inspectId`, and generic ID encoding exist, downstream
packages can easily build their own assertions. Still, these could be useful as
small runtime helpers:

```ts
function assertIdLanguage(
	expectedLanguage: SupportedLanguage,
	id: string,
): void;

function assertIdKind(
	expectedKind: EntityKind,
	id: string,
): void;
```

`dumdict` currently owns equivalent checks in its slice validation and service
language guard code.

## Recommended First PR

The highest-impact `dumling` export set for `dumdict` would be:

- `supportedLanguages`
- `getLanguageApi`
- `DumlingId`
- `EntityValue`
- `EntityForKind`
- `encodeId`
- `inspectId`

That set would remove most of `dumdict`'s local `src/dumling.ts` adapter and
make the dependency on `dumling`'s public API more explicit.
