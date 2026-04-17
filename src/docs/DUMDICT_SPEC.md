# `dumdict` V1 Spec Draft

## Purpose

`dumdict` is a dictionary-storage layer built on top of `dumling`.

`dumling` provides:

- typed linguistic DTOs such as `Lemma` and `ResolvedSurface`
- stable IDs for resolved entities
- language-bound runtime validation

`dumdict` provides:

- dictionary entry DTOs
- lookup indexes
- CRUD operations
- lemma-lemma relation semantics
- pending unresolved targets for later hydration

The intent is to support UI implementors with a small, stable, language-generic API.

## Language Scope

- One `dumdict` instance is bound to exactly one language.
- All public APIs are the same for every language.
- All entry DTOs share one universal shape parameterized by `L extends SupportedLang`.
- If `dumling` lacks universal helper types needed for this, they should be added there.

## Suggested Final Naming

For `dumdict` public DTOs and API-facing types, prefer short concrete names without the `Universal` prefix:

- `LemmaEntry<L>`
- `SurfaceEntry<L>`
- `LookupResult<L>`
- `PendingLemmaRef<L>`
- `PendingLemmaRefInput<L>`
- `PendingLemmaRelation<L>`
- `LemmaEntryPatchOp<L>`
- `SurfaceEntryPatchOp<L>`
- `DumdictError`
- `DumdictResult<T>`

For helper types that may need to come from `dumling`, `Universal` is still fine because those are taxonomy helpers rather than dictionary DTOs:

- `SupportedLang`
- `UniversalLemmaKind`
- `UniversalLemmaSubKind`
- `UniversalLexicalRelation`
- `UniversalMorphologicalRelation`
- `UniversalLexicalRelations<L>`
- `UniversalMorphologicalRelations<L>`

The naming split should be:

- `dumling`: universal taxonomy and linguistic helper types
- `dumdict`: concrete dictionary storage DTOs

## Construction

Factory-based API:

```ts
const deDict = makeDumdict("German");
const heDict = makeDumdict("Hebrew");
```

Suggested shape:

```ts
declare function makeDumdict<L extends SupportedLang>(language: L): Dumdict<L>;
```

## Clarifications From Design Discussion

The following points are clarified enough to treat as working v1 assumptions.

### Confirmed Direction

- `dumling` should provide identity, DTO shapes, and language-bound validation.
- `dumdict` should own dictionary semantics:
  - stored dictionary entities
  - lookup indexes
  - CRUD behavior
  - relation semantics
  - reciprocity rules
  - delete cleanup rules
- The primary dictionary entity is lemma-level.
- Lexical relations are lemma-to-lemma only.
- Morphological relations are lemma-to-lemma only.
- Inflectional / grammatical facts must not be modeled as the same generic relation bag as lexical or morphological relations.
- Surface ownership is the primary v1 mechanism for representing inflected or orthographic forms tied to a lemma.
- Reciprocal lemma relations must be updated atomically by `dumdict`.

### Questions Clarified Into Sharper V1 Decisions

These questions came up in discussion and are now sharpened enough that the spec should answer them explicitly:

- Is the primary dictionary entity lemma-level or arbitrary over all `DumlingId`s?
  - Current direction: lemma-level.
- Are lexical and morphological relations `dumling` concerns or `dumdict` concerns?
  - Current direction: `dumdict` owns them completely.
- Should grammatical / inflectional relations share the same relation model as synonymy or derivation?
  - Current direction: no; they are represented via surface ownership and surface data, not the lemma-lemma relation graph.
- Does relation reciprocity happen manually or automatically?
  - Current direction: automatically, inside `dumdict`, with atomic updates.

### Questions Still Open

- Are surfaces nested inside a lemma entry, or stored as separate `SurfaceEntry`s in a second store?
- Should `lookupBySurface` return:
  - mixed lemma and surface entries
  - lemma entries only
- Is a missing relation target rejected in v1, or preserved as a pending unresolved target?
- What exact normalization pipeline should surface lookup use beyond Unicode normalization?
- Are translations and notes intentionally lemma-level in v1, even when a form-specific or sense-specific distinction may exist?

## Core Ontology

### Entry Kinds

#### `LemmaEntry`

Primary dictionary entity.

```ts
type LemmaEntry<L extends SupportedLang> = {
	id: DumlingId<"Lemma", L>;
	lemma: Lemma<L>;
	lexicalRelations: UniversalLexicalRelations<L>;
	morphologicalRelations: UniversalMorphologicalRelations<L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};
```

#### `SurfaceEntry`

Secondary dictionary entity for resolved surfaces such as inflections or orthographic variants.

```ts
type SurfaceEntry<L extends SupportedLang> = {
	id: DumlingId<"ResolvedSurface", L>;
	surface: ResolvedSurface<L>;
	ownerLemmaId: DumlingId<"Lemma", L>;
	attestedTranslations: string[];
	attestations: string[];
	notes: string;
};
```

### Non-Entities

- `Selection` is not a dictionary entry.
- There is no `SelectionEntry` in v1.
- `Selection` may be used by outer systems as evidence or acquisition context, but not as a first-class `dumdict` entity.

## Allowed Links

### `LemmaEntry <-> LemmaEntry`

Allowed:

- lexical relations
- morphological relations

These relations are owned by `dumdict`, not by `dumling`.

### `SurfaceEntry -> LemmaEntry`

Allowed:

- ownership only

This is not a generic relation bag. A `SurfaceEntry` belongs to exactly one lemma entry.
Inflectional / grammatical facts should be represented through surface ownership and surface data rather than by reusing the lemma-lemma relation graph.

### Forbidden Links In V1

- no `Selection -> *` entry graph
- no `SurfaceEntry <-> SurfaceEntry` relation graph
- no generic `SurfaceEntry <-> LemmaEntry` relations beyond ownership

## Invariants

### Surface Ownership

- Every `SurfaceEntry` wraps a `ResolvedSurface<L>`.
- Every `SurfaceEntry` has exactly one `ownerLemmaId`.
- `ownerLemmaId` must match the lemma encoded inside `surface.lemma`.
- Multiple `SurfaceEntry`s may share the same normalized spelling string.
- A `SurfaceEntry` cannot have multiple owner lemmas.

### Relation Invariants

- Lemma-lemma relation reciprocity is maintained automatically by `dumdict`.
- Self-relations are forbidden.
- `dumdict` must not invent fake lemma entries for inflected forms, such as `"go, verb, present"`.

### Collection Invariants

- Duplicate adds are no-ops.
- Removing a missing value is a no-op.
- Collection fields are deduped.
- Collection fields are semantically sets.
- Public contract does not guarantee insertion order.

## Lookup

### Lookup Result

```ts
type LookupResult<L extends SupportedLang> = {
	lemmas: Record<DumlingId<"Lemma", L>, LemmaEntry<L>>;
	surfaces: Record<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>;
};
```

### `lookupBySurface`

```ts
lookupBySurface(surface: string): Result<LookupResult<L>, DumdictError>;
```

Behavior:

- exact-match only
- no fuzzy search
- no prefix search
- no substring search
- lookup key is preprocessed before matching
- preprocessing currently means:
    - Unicode normalization via `input.normalize("NFC")`
    - lowercasing
- returns only direct matches
- does not automatically include owner lemmas of matched surfaces unless they also match directly

### `lookupLemmasBySurface`

```ts
lookupLemmasBySurface(
  surface: string,
): Result<Record<DumlingId<"Lemma", L>, LemmaEntry<L>>, DumdictError>;
```

Behavior:

- uses the same lookup-key preprocessing as `lookupBySurface`
- returns only lemma entries
- includes both:
    - owner lemmas of matched surface entries
    - directly matched lemma entries

## Read API

```ts
getLemmaEntry(
  id: DumlingId<"Lemma", L>,
): Result<LemmaEntry<L>, DumdictError>;

getSurfaceEntry(
  id: DumlingId<"ResolvedSurface", L>,
): Result<SurfaceEntry<L>, DumdictError>;

getOwnedSurfaceEntries(
  lemmaId: DumlingId<"Lemma", L>,
): Result<
  Record<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>,
  DumdictError
>;
```

## Write API

### Upsert

Upsert is full replacement of the targeted entry.

```ts
upsertLemmaEntry(
  entry: LemmaEntry<L>,
): Result<LemmaEntry<L>, DumdictError>;

upsertSurfaceEntry(
  entry: SurfaceEntry<L>,
): Result<SurfaceEntry<L>, DumdictError>;
```

Rules:

- `upsert` is not a partial merge
- identity-bearing fields must be internally consistent
- `upsertSurfaceEntry` must enforce `ownerLemmaId` consistency against `surface.lemma`

### Patch

Patch is command-based, not deep-partial object merge.

```ts
patchLemmaEntry(
  id: DumlingId<"Lemma", L>,
  ops: LemmaEntryPatchOp<L> | LemmaEntryPatchOp<L>[],
): Result<LemmaEntry<L>, DumdictError>;

patchSurfaceEntry(
  id: DumlingId<"ResolvedSurface", L>,
  ops: SurfaceEntryPatchOp<L> | SurfaceEntryPatchOp<L>[],
): Result<SurfaceEntry<L>, DumdictError>;
```

Rules:

- patch execution is atomic across the full op list
- duplicate add is a no-op
- remove-missing is a no-op
- patch may not mutate identity-bearing fields by generic merge

### Lemma Patch Operations

```ts
type LemmaEntryPatchOp<L extends SupportedLang> =
	| { op: "addTranslation"; value: string }
	| { op: "removeTranslation"; value: string }
	| { op: "addAttestation"; value: string }
	| { op: "removeAttestation"; value: string }
	| { op: "setNotes"; value: string }
	| {
			op: "addLexicalRelation";
			relation: UniversalLexicalRelation;
			target: LemmaRelationTarget<L>;
	  }
	| {
			op: "removeLexicalRelation";
			relation: UniversalLexicalRelation;
			target: LemmaRelationTarget<L>;
	  }
	| {
			op: "addMorphologicalRelation";
			relation: UniversalMorphologicalRelation;
			target: LemmaRelationTarget<L>;
	  }
	| {
			op: "removeMorphologicalRelation";
			relation: UniversalMorphologicalRelation;
			target: LemmaRelationTarget<L>;
	  };
```

### Surface Patch Operations

```ts
type SurfaceEntryPatchOp<L extends SupportedLang> =
	| { op: "addTranslation"; value: string }
	| { op: "removeTranslation"; value: string }
	| { op: "addAttestation"; value: string }
	| { op: "removeAttestation"; value: string }
	| { op: "setNotes"; value: string };
```

## Delete API

```ts
deleteLemmaEntry(
  id: DumlingId<"Lemma", L>,
): Result<void, DumdictError>;

deleteSurfaceEntry(
  id: DumlingId<"ResolvedSurface", L>,
): Result<void, DumdictError>;
```

Behavior:

- deleting a `LemmaEntry` deletes its owned `SurfaceEntry`s
- deleting a `LemmaEntry` removes inbound and outbound lemma relations
- deleting a `SurfaceEntry` only deletes that surface entry

## Pending Unresolved Targets

### Motivation

The outer system may discover a related lemma before full lemma hydration exists.

Example flow:

- user clicks a token in text
- outer system resolves one real lemma entry and some related lemmas
- some related lemmas already exist
- some related lemmas do not yet exist as full dictionary entries

`dumdict` should preserve those unresolved targets without breaking the invariant that confirmed relations live on confirmed lemma entries.

### Chosen Model

Use a separate pending layer.

- confirmed relations live on confirmed `LemmaEntry`s
- unresolved relation targets live in pending refs plus pending edges
- later hydration rewires pending edges into real lemma relations

### Pending DTOs

```ts
type PendingLemmaRef<L extends SupportedLang> = {
	pendingId: PendingLemmaId<L>;
	language: L;
	canonicalLemma: string;
	lemmaKind: UniversalLemmaKind;
	lemmaSubKind: UniversalLemmaSubKind;
};

type PendingLemmaRelation<L extends SupportedLang> = {
	sourceLemmaId: DumlingId<"Lemma", L>;
	relationFamily: "lexical" | "morphological";
	relation: UniversalLexicalRelation | UniversalMorphologicalRelation;
	targetPendingId: PendingLemmaId<L>;
};
```

Notes:

- pending refs are not `LemmaEntry`s
- pending refs are not keyed by `DumlingId<"Lemma">`
- pending refs exist specifically to preserve unresolved acquisition state

### Relation Targets

Lemma relation patch operations target either:

- an existing lemma ID
- a pending unresolved lemma ref

```ts
type LemmaRelationTarget<L extends SupportedLang> = { kind: "existing"; lemmaId: DumlingId<"Lemma", L> } | { kind: "pending"; ref: PendingLemmaRefInput<L> };

type PendingLemmaRefInput<L extends SupportedLang> = {
	canonicalLemma: string;
	lemmaKind: UniversalLemmaKind;
	lemmaSubKind: UniversalLemmaSubKind;
};
```

The user must provide enough discriminators to create a pending ref.

### Pending Resolution

Later, when a pending target is hydrated into a full lemma entry:

```ts
resolvePendingLemma(
  pendingId: PendingLemmaId<L>,
  entry: LemmaEntry<L>,
): Result<LemmaEntry<L>, DumdictError>;
```

Behavior:

- creates or upserts the real lemma entry
- materializes pending inbound relations onto the real entry
- materializes reciprocal relations onto other real entries as needed
- removes the resolved pending ref and its pending edges

## Error Model

Use `neverthrow`.

```ts
type DumdictResult<T> = Result<T, DumdictError>;
```

Suggested error codes:

```ts
type DumdictErrorCode =
	| "EntryNotFound"
	| "EntryAlreadyExists"
	| "PendingRefNotFound"
	| "LanguageMismatch"
	| "InvalidOwnership"
	| "InvalidPatchOp"
	| "SelfRelationForbidden"
	| "DecodeFailed";

type DumdictError = {
	code: DumdictErrorCode;
	message: string;
	cause?: unknown;
};
```

## Boundaries With `dumling`

`dumling` should remain responsible for:

- `Lemma`
- `ResolvedSurface`
- `DumlingId`
- language-bound runtime decoding and validation

`dumdict` should remain responsible for:

- dictionary CRUD
- lookup indexes
- relation semantics
- pending unresolved targets

### Potential `dumling` Additions

If missing, `dumling` may need to expose:

- universal lemma-kind helper types
- universal lemma-subkind helper types
- universal lexical-relation helper types
- universal morphological-relation helper types

`dumdict` should not require `dumling` to add unresolved lemma IDs in v1 because pending refs are modeled separately.
