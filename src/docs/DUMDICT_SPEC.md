# `dumdict` V1 Spec Draft

## Purpose

`dumdict` is a dictionary-storage layer built on top of `dumling`.

`dumling` provides:

- linguistic DTOs such as `Lemma` and `ResolvedSurface`
- stable IDs for resolved entities
- language-bound validation

`dumdict` provides:

- dictionary entry DTOs
- lookup indexes
- CRUD operations
- relation semantics
- pending unresolved targets

## Language Scope

- One `dumdict` instance is bound to exactly one language.
- All public APIs are the same for every language.
- All dictionary DTOs are parameterized by `L extends SupportedLang`.

## Construction

Factory-based API:

```ts
const deDict = makeDumdict("German");
const heDict = makeDumdict("Hebrew");
```

```ts
declare function makeDumdict<L extends SupportedLang>(language: L): Dumdict<L>;
```

## Core Model

### Entity Kinds

There are two entry kinds in v1:

- `LemmaEntry<L>`: primary dictionary entity
- `SurfaceEntry<L>`: secondary owned entity for resolved surfaces

`Selection` is not a dictionary entity in v1.

### `LemmaEntry`

```ts
type LemmaEntry<L extends SupportedLang> = {
  id: DumlingId<"Lemma", L>;
  lemma: Lemma<L>;
  lexicalRelations: LexicalRelations<L>;
  morphologicalRelations: MorphologicalRelations<L>;
  attestedTranslations: string[];
  attestations: string[];
  notes: string;
};
```

### `SurfaceEntry`

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

### Storage Model

Storage is two-entity, not nested:

- `lemmasById`
- `surfacesById`
- `surfaceIdsByOwnerLemmaId`
- lemma lookup index by normalized `lemma.canonicalLemma`
- surface lookup index by normalized `surface.normalizedFullSurface`
- `pendingLemmaRefsById`
- pending relation state keyed by source lemma and target pending ref

But the API is lemma-primary:

- lemma entries are the main graph
- surface entries are secondary owned data
- most navigation starts from lemmas

This means:

- `SurfaceEntry` is first-class for storage and CRUD
- `SurfaceEntry` is secondary for ontology and relation semantics

## Relations

All relation logic belongs to `dumdict`, not `dumling`.

### Relation Types

```ts
type LexicalRelation =
  | "synonym"
  | "nearSynonym"
  | "antonym"
  | "hypernym"
  | "hyponym"
  | "meronym"
  | "holonym";

type MorphologicalRelation =
  | "consistsOf"
  | "derivedFrom"
  | "usedIn"
  | "sourceFor";
```

### Relation Maps

```ts
type LexicalRelations<L extends SupportedLang> =
  Partial<Record<LexicalRelation, DumlingId<"Lemma", L>[]>>;

type MorphologicalRelations<L extends SupportedLang> =
  Partial<Record<MorphologicalRelation, DumlingId<"Lemma", L>[]>>;
```

`LemmaEntry.lexicalRelations` and `LemmaEntry.morphologicalRelations` contain
only resolved lemma IDs.

Pending relation targets are stored as separate readable state and are not
embedded inside `LemmaEntry`.

### Allowed Links

- `LemmaEntry <-> LemmaEntry`: lexical relations
- `LemmaEntry <-> LemmaEntry`: morphological relations
- `SurfaceEntry -> LemmaEntry`: ownership only

### Forbidden Links

- no `Selection -> *` entry graph
- no `SurfaceEntry <-> SurfaceEntry` relation graph
- no generic `SurfaceEntry <-> LemmaEntry` relations beyond ownership

### Relation Inverses

Reciprocity is automatic and uses these inverse pairs:

```ts
type LexicalInverseMap = {
  synonym: "synonym";
  nearSynonym: "nearSynonym";
  antonym: "antonym";
  hypernym: "hyponym";
  hyponym: "hypernym";
  meronym: "holonym";
  holonym: "meronym";
};

type MorphologicalInverseMap = {
  consistsOf: "usedIn";
  usedIn: "consistsOf";
  derivedFrom: "sourceFor";
  sourceFor: "derivedFrom";
};
```

### Relation Rules

- Reciprocity is maintained automatically by `dumdict`.
- Self-relations are forbidden.
- `dumdict` must not invent fake lemma entries for inflected forms, such as `"go, verb, present"`.

## Ownership And Surface Semantics

- Every `SurfaceEntry` wraps a `ResolvedSurface<L>`.
- Every `SurfaceEntry` has exactly one `ownerLemmaId`.
- `ownerLemmaId` must match the lemma encoded inside `surface.lemma`.
- Multiple `SurfaceEntry`s may share the same spelling string.
- A `SurfaceEntry` cannot have multiple owners.
- `surface` is immutable after creation.
- `ownerLemmaId` is immutable after creation.

Inflectional and orthographic facts are represented through surface ownership and surface data, not through the lemma-lemma relation graph.

## Collections

- Duplicate adds are no-ops.
- Removing a missing value is a no-op.
- Collection fields are deduped.
- Collection fields are semantically sets.
- Public reads are deterministically ordered.
- `string[]` collections are sorted lexicographically.
- ID collections are sorted by ascending stable ID.
- Record-shaped reads must be constructed in ascending key order.

## Lookup

### Normalization

Current v1 lookup normalization:

```ts
makeLookupKey(input: string) = input.normalize("NFC").toLowerCase()
```

This is a known v1 limitation and is not claimed to be linguistically complete
for all supported languages.

### Indexed Fields

- lemma lookup indexes `lemma.canonicalLemma`
- surface lookup indexes `surface.normalizedFullSurface`
- both indexes use the same `makeLookupKey(...)` normalization

### `lookupBySurface`

```ts
type LookupResult<L extends SupportedLang> = {
  lemmas: Record<DumlingId<"Lemma", L>, LemmaEntry<L>>;
  surfaces: Record<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>;
};

lookupBySurface(surface: string): DumdictResult<LookupResult<L>>;
```

Behavior:

- exact-match only
- no fuzzy, prefix, or substring search
- matches by normalized lookup key
- returns direct matches only
- direct lemma matches are matches on `lemma.canonicalLemma`
- direct surface matches are matches on `surface.normalizedFullSurface`
- may return both matched lemma entries and matched surface entries

### `lookupLemmasBySurface`

```ts
lookupLemmasBySurface(
  surface: string,
): DumdictResult<Record<DumlingId<"Lemma", L>, LemmaEntry<L>>>;
```

Behavior:

- uses the same lookup normalization
- returns lemma entries only
- includes:
  - directly matched lemma entries
  - owner lemmas of matched surface entries

## Read API

```ts
getLemmaEntry(
  id: DumlingId<"Lemma", L>,
): DumdictResult<LemmaEntry<L>>;

getSurfaceEntry(
  id: DumlingId<"ResolvedSurface", L>,
): DumdictResult<SurfaceEntry<L>>;

getOwnedSurfaceEntries(
  lemmaId: DumlingId<"Lemma", L>,
): DumdictResult<
  Record<DumlingId<"ResolvedSurface", L>, SurfaceEntry<L>>
>;

getPendingLemmaRef(
  pendingId: PendingLemmaId<L>,
): DumdictResult<PendingLemmaRef<L>>;

listPendingLemmaRefs(): DumdictResult<
  Record<PendingLemmaId<L>, PendingLemmaRef<L>>
>;

listPendingRelationsForLemma(
  lemmaId: DumlingId<"Lemma", L>,
): DumdictResult<PendingLemmaRelation<L>[]>;
```

## Write API

### Upsert

Upsert is full replacement.

```ts
upsertLemmaEntry(entry: LemmaEntry<L>): DumdictResult<LemmaEntry<L>>;
upsertSurfaceEntry(entry: SurfaceEntry<L>): DumdictResult<SurfaceEntry<L>>;
```

Rules:

- `upsert` is not a partial merge
- identity-bearing fields must be internally consistent
- `upsertLemmaEntry` is a full replacement of the `LemmaEntry` DTO only
- `upsertLemmaEntry` is graph-aware for resolved lemma relations
- replacing a lemma's resolved relation sets also removes stale inverse edges from previously related lemmas
- resolved relation rewrites are atomic across the affected lemma graph
- pending relation state is separate from `LemmaEntry` and is not replaced by `upsertLemmaEntry`
- `upsertSurfaceEntry` must enforce `ownerLemmaId` consistency against `surface.lemma`
- `upsertSurfaceEntry` requires the owner lemma to already exist
- if the owner lemma does not exist, return `OwnerLemmaNotFound`
- for an existing surface entry, `surface` and `ownerLemmaId` must match the stored values
- mutating immutable surface identity fields returns `InvariantViolation`

### Patch

Patch is command-based, not deep-partial merge.

```ts
patchLemmaEntry(
  id: DumlingId<"Lemma", L>,
  ops: LemmaEntryPatchOp<L> | LemmaEntryPatchOp<L>[],
): DumdictResult<LemmaEntry<L>>;

patchSurfaceEntry(
  id: DumlingId<"ResolvedSurface", L>,
  ops: SurfaceEntryPatchOp<L> | SurfaceEntryPatchOp<L>[],
): DumdictResult<SurfaceEntry<L>>;
```

Rules:

- patch execution is atomic across the full op list
- duplicate add is a no-op
- remove-missing is a no-op
- patch may not mutate identity-bearing fields by generic merge

### Pending Relation Write API

```ts
removePendingRelation(
  edge: PendingLemmaRelation<L>,
): DumdictResult<void>;
```

Rules:

- removing a missing pending relation returns `PendingRelationNotFound`
- if removing an edge leaves a pending ref with no remaining inbound pending relations, that pending ref is removed automatically

### Lemma Patch Operations

```ts
type LemmaRelationTarget<L extends SupportedLang> =
  | { kind: "existing"; lemmaId: DumlingId<"Lemma", L> }
  | { kind: "pending"; ref: PendingLemmaRefInput<L> };

type LemmaEntryPatchOp<L extends SupportedLang> =
  | { op: "addTranslation"; value: string }
  | { op: "removeTranslation"; value: string }
  | { op: "addAttestation"; value: string }
  | { op: "removeAttestation"; value: string }
  | { op: "setNotes"; value: string }
  | {
      op: "addLexicalRelation";
      relation: LexicalRelation;
      target: LemmaRelationTarget<L>;
    }
  | {
      op: "removeLexicalRelation";
      relation: LexicalRelation;
      target: LemmaRelationTarget<L>;
    }
  | {
      op: "addMorphologicalRelation";
      relation: MorphologicalRelation;
      target: LemmaRelationTarget<L>;
    }
  | {
      op: "removeMorphologicalRelation";
      relation: MorphologicalRelation;
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

Rules:

- surface patch only edits notes, translations, and attestations
- surface patch cannot mutate `surface` or `ownerLemmaId`

## Delete API

```ts
deleteLemmaEntry(id: DumlingId<"Lemma", L>): DumdictResult<void>;
deleteSurfaceEntry(id: DumlingId<"ResolvedSurface", L>): DumdictResult<void>;
```

Behavior:

- deleting a `LemmaEntry` deletes its owned `SurfaceEntry`s
- deleting a `LemmaEntry` removes inbound and outbound lemma relations
- deleting a `LemmaEntry` removes pending relations where `sourceLemmaId` is that lemma
- deleting those edges also removes now-unreferenced pending refs
- deleting a `SurfaceEntry` only deletes that surface entry

## Pending Unresolved Targets

Missing relation targets are preserved as pending unresolved refs in v1.

They are not rejected.

Pending refs and pending relations are first-class readable state.

Pending refs are placeholders for future `LemmaEntry`s at `dumling` lemma
identity granularity. They are not bare spelling-only stubs.

### Pending DTOs

```ts
type PendingLemmaRefInput<L extends SupportedLang> = {
  canonicalLemma: string;
  lemmaKind: UniversalLemmaKind;
  lemmaSubKind: UniversalLemmaSubKind;
};

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
  relation: LexicalRelation | MorphologicalRelation;
  targetPendingId: PendingLemmaId<L>;
};
```

Rules:

- pending refs are not `LemmaEntry`s
- pending refs are not keyed by `DumlingId<"Lemma">`
- the caller must provide enough discriminators to create a pending ref
- pending refs must preserve the identity granularity that `dumling` uses for real lemmas
- pending refs stand for a future lemma identity, not just a future canonical spelling
- pending refs are deduped by language plus `(canonicalLemma, lemmaKind, lemmaSubKind)`
- `dumdict` does not infer semantic sufficiency beyond the pending-ref fields it is given
- it is the caller's responsibility to supply discriminator fields that are specific enough for the intended future lemma identity
- if `dumling` lemma identity later requires more discriminators, `PendingLemmaRefInput`, pending dedupe, and pending resolution validation must expand in lockstep
- pending refs exist only while referenced by at least one pending relation

### Pending Resolution

```ts
resolvePendingLemma(
  pendingId: PendingLemmaId<L>,
  entry: LemmaEntry<L>,
): DumdictResult<LemmaEntry<L>>;
```

Behavior:

- creates or upserts the real lemma entry
- validates the resolved `entry.lemma` against the pending ref before resolution
- v1 validation checks `canonicalLemma`, `lemmaKind`, and `lemmaSubKind`
- mismatches return `PendingResolutionMismatch`
- materializes pending inbound relations onto the real entry
- materializes reciprocal relations onto other real entries
- removes the resolved pending ref and its pending edges

## Sense Granularity

V1 does not introduce a separate `SenseEntry` entity.

That means:

- `dumdict` stores `LemmaEntry`s keyed by `dumling` lemma identity
- `dumdict` stores `SurfaceEntry`s keyed by `dumling` resolved surface identity
- translations are attached at lemma or surface level
- notes are attached at lemma or surface level
- relations are attached at lemma level

If `dumling` distinguishes two meanings as different lemma identities, `dumdict`
stores them as different `LemmaEntry`s.

What v1 does not support is multiple separately patchable sub-senses nested
inside one `LemmaEntry`.

V1 is lossy only when multiple sub-senses share one `dumling` lemma identity,
because `dumdict` does not add an extra sense layer on top.

## Error Model

Use `neverthrow`.

```ts
type DumdictResult<T> = Result<T, DumdictError>;

type DumdictErrorCode =
  | "EntryNotFound"
  | "PendingRefNotFound"
  | "OwnerLemmaNotFound"
  | "PendingRelationNotFound"
  | "PendingResolutionMismatch"
  | "LanguageMismatch"
  | "InvalidOwnership"
  | "InvalidPatchOp"
  | "SelfRelationForbidden"
  | "InvariantViolation"
  | "DecodeFailed";

type DumdictError = {
  code: DumdictErrorCode;
  message: string;
  cause?: unknown;
};
```

## Boundary With `dumling`

`dumling` remains responsible for:

- `Lemma`
- `ResolvedSurface`
- `DumlingId`
- language-bound decoding and validation
- universal lemma discriminator helper types

`dumdict` remains responsible for:

- dictionary CRUD
- lookup and normalization
- relation types and inverse logic
- pending unresolved targets
