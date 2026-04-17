# `dumdict` V1 Spec Draft

## Purpose

`dumdict` is a semantic dictionary engine built on top of `dumling`.

Architecturally, v1 sits between persisted dictionary snapshots and
consumer-facing mutation intents.

`dumdict` is semantic authority, not persistence authority:

- hosts load and persist dictionary state
- hosts ask `dumdict` to look up candidates inside that state
- hosts ask `dumdict` to plan dictionary-safe changes from higher-level intents

`dumling` provides:

- linguistic DTOs such as `Lemma` and `Surface`
- stable IDs for resolved entities
- language-bound validation

`dumdict` provides:

- dictionary entry DTOs
- lookup indexes
- relation semantics
- pending unresolved targets
- change planning over snapshots
- a mutable in-memory reference engine that can back the planner internally

## Language Scope

- One `dumdict` instance is bound to exactly one language.
- All public APIs are the same for every language.
- All dictionary DTOs are parameterized by `L extends SupportedLang`.

## Status

This document intentionally mixes:

- current exported reference-engine API
- target host-facing planning API

Today, the package exports the mutable reference engine described in the Read,
Write, Delete, and Pending Resolution sections.

The snapshot-based planning boundary described later in this document is
aspirational v1 architecture and should be treated as target-state until it is
implemented and exported.

Likewise, any DTO field or behavior described here that is not present in
`src/dumdict/public.ts` today, such as host-facing planner types, is
target-state rather than current package surface.

## Consumer Roles

V1 should not treat every consumer as an equal write authority.

The intended default roles are:

- Node + SQLite: canonical shared write authority
- Electron: client/cache over that authority
- Obsidian: either a local-only authority or a client of the Node authority,
  but not both in one mode

The distinction that matters is not application type but authority:

- does this process own persistence and conflict resolution?
- or is it a UI/orchestration shell over another authority?

For shared-write modes, v1 is intentionally optimized around one canonical
writer and full-snapshot planning. That is an explicit product boundary and v1
limitation, not a hidden implementation detail.

## Reference Engine Construction

The mutable in-memory engine remains a useful implementation substrate, but it
is not the architectural center of gravity for host integration.

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
  id: DumlingId<"Surface", L>;
  surface: Surface<L>;
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

Examples:

- if lemma `A` morphologically consists of lemma `B`, store `A --consistsOf-> B`
- the reciprocal stored edge is `B --usedIn-> A`
- for example, `"handbag"` may `consistsOf` `"bag"`, and `"bag"` is `usedIn` `"handbag"`

### Relation Rules

- Reciprocity is maintained automatically by `dumdict`.
- Self-relations are forbidden.
- `dumdict` must not invent fake lemma entries for inflected forms, such as `"go, verb, present"`.

## Ownership And Surface Semantics

- Every `SurfaceEntry` wraps a `Surface<L>`.
- Every `SurfaceEntry` has exactly one `ownerLemmaId`.
- `ownerLemmaId` must match the lemma encoded inside `surface.lemma`.
- `ownerLemmaId` is stored explicitly so `dumdict` can maintain owner-based indexes and reads without re-deriving ownership from `surface`
- Multiple `SurfaceEntry`s may share the same spelling string.
- A `SurfaceEntry` cannot have multiple owners.
- `surface` is immutable after creation.
- `ownerLemmaId` is immutable after creation.

Inflectional and orthographic facts are represented through surface ownership and surface data, not through the lemma-lemma relation graph.

## Collections

- Duplicate adds are no-ops.
- Removing a missing value is a no-op for DTO collection fields and relation-target collections.
- Command-style APIs may define stricter missing-target behavior explicitly.
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
normalizeLowercase(input: string) = input.normalize("NFC").toLowerCase()

makeLookupKey(input: string) = normalizeLowercase(input)
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
  surfaces: Record<DumlingId<"Surface", L>, SurfaceEntry<L>>;
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
- for complete snapshots and the current in-memory reference engine, owner
  lemmas of matched surface entries are expected to be present
- for partial read snapshots, snapshot-based lookup may return only owner lemmas
  that are actually present in the supplied snapshot
- hosts that need stable owner-lemma results from partial read snapshots should
  make those snapshots owner-closed for included surfaces

## Read API

The sections below describe the low-level mutable reference engine API.

This engine may remain exported for advanced hosts and for the internal
implementation of the planner boundary described later, but it is not the
preferred integration surface for ordinary consumers.

```ts
getLemmaEntry(
  id: DumlingId<"Lemma", L>,
): DumdictResult<LemmaEntry<L>>;

getSurfaceEntry(
  id: DumlingId<"Surface", L>,
): DumdictResult<SurfaceEntry<L>>;

getOwnedSurfaceEntries(
  lemmaId: DumlingId<"Lemma", L>,
): DumdictResult<
  Record<DumlingId<"Surface", L>, SurfaceEntry<L>>
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

Behavior:

- if a supplied resolved lemma ID decodes to a different language than the dictionary language, return `LanguageMismatch`
- if a supplied resolved surface ID decodes to a different language than the dictionary language, return `LanguageMismatch`
- if a supplied pending ID decodes to a different language than the dictionary language, return `LanguageMismatch`
- if a supplied resolved lemma or resolved surface ID is malformed, return `DecodeFailed`
- if a supplied pending ID is malformed, return `DecodeFailed`
- `getLemmaEntry` returns `LemmaEntryNotFound` if the lemma does not exist
- `getSurfaceEntry` returns `SurfaceEntryNotFound` if the surface does not exist
- `getOwnedSurfaceEntries` returns `LemmaEntryNotFound` if the owner lemma does not exist
- `getOwnedSurfaceEntries` returns an empty record if the owner lemma exists but owns no surfaces
- `getPendingLemmaRef` returns `PendingRefNotFound` if the pending ref does not exist
- `listPendingLemmaRefs` returns an empty record when there are no pending refs
- `listPendingRelationsForLemma` returns `LemmaEntryNotFound` if the lemma does not exist
- `listPendingRelationsForLemma` returns an empty array if the lemma exists but has no pending relations

## Write API

### Upsert

Upsert replaces one entry's own stored fields and its resolved relation
projection.

```ts
upsertLemmaEntry(entry: LemmaEntry<L>): DumdictResult<LemmaEntry<L>>;
upsertSurfaceEntry(entry: SurfaceEntry<L>): DumdictResult<SurfaceEntry<L>>;
```

Rules:

- `upsert` is not a partial merge
- identity-bearing fields must be internally consistent
- `upsertLemmaEntry` requires `entry.id` to exactly match the stable `dumling` ID derived from `entry.lemma`
- `upsertSurfaceEntry` requires `entry.id` to exactly match the stable `dumling` ID derived from `entry.surface`
- if the entry payload language or entry ID language does not match the dictionary language, return `LanguageMismatch`
- if `entry.id` does not match the derived stable entity ID, return `InvariantViolation`
- `upsertLemmaEntry` is a full replacement of the `LemmaEntry` DTO only
- `upsertLemmaEntry` is graph-aware for resolved lemma relations
- `upsertLemmaEntry` may reference only existing resolved lemma IDs in its relation fields
- if any resolved relation target ID does not exist, return `RelationTargetNotFound`
- `upsertLemmaEntry` does not convert missing resolved IDs into pending refs
- if the caller wants a pending target, it must use `patchLemmaEntry` with `target.kind === "pending"`
- raw upsert is therefore stricter than pending-aware patch/planning flows
- replacing a lemma's resolved relation sets also removes stale inverse edges from previously related lemmas
- resolved relation rewrites are atomic across the affected lemma graph
- pending relation state is separate from `LemmaEntry` and is not replaced by `upsertLemmaEntry`
- `upsertLemmaEntry` therefore does not replace the lemma's full pending-plus-resolved relation state in one operation
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
  id: DumlingId<"Surface", L>,
  ops: SurfaceEntryPatchOp<L> | SurfaceEntryPatchOp<L>[],
): DumdictResult<SurfaceEntry<L>>;
```

Rules:

- patch execution is atomic across the full op list
- duplicate add is a no-op
- remove-missing is a no-op
- patch may not mutate identity-bearing fields by generic merge
- if the patched entry ID decodes to a different language than the dictionary language, return `LanguageMismatch`
- if the patched entry ID is malformed, return `DecodeFailed`
- if a lemma patch op uses `target.kind === "existing"` and that target lemma ID does not exist, return `RelationTargetNotFound`
- if a lemma patch op uses `target.kind === "existing"` and that target lemma ID decodes to a different language than the dictionary language, return `LanguageMismatch`
- if a lemma patch op uses `target.kind === "existing"` and that target lemma ID is malformed, return `DecodeFailed`
- `patchLemmaEntry` is the only API that can create new pending relation refs from lemma relation writes

### Pending Relation Write API

```ts
removePendingRelation(
  edge: PendingLemmaRelation<L>,
): DumdictResult<void>;
```

Rules:

- `removePendingRelation(...)` is a command API exception to the generic collection no-op rule
- if `edge.sourceLemmaId` decodes to a different language than the dictionary language, return `LanguageMismatch`
- if `edge.sourceLemmaId` is malformed, return `DecodeFailed`
- if `edge.targetPendingId` decodes to a different language than the dictionary language, return `LanguageMismatch`
- if `edge.targetPendingId` is malformed, return `DecodeFailed`
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
deleteSurfaceEntry(id: DumlingId<"Surface", L>): DumdictResult<void>;
```

Behavior:

- deleting a `LemmaEntry` deletes its owned `SurfaceEntry`s
- deleting a `LemmaEntry` removes inbound and outbound lemma relations
- deleting a `LemmaEntry` removes pending relations where `sourceLemmaId` is that lemma
- deleting those edges also removes now-unreferenced pending refs
- if the supplied lemma ID decodes to a different language than the dictionary language, return `LanguageMismatch`
- if the supplied surface ID decodes to a different language than the dictionary language, return `LanguageMismatch`
- if the supplied lemma or surface ID is malformed, return `DecodeFailed`
- deleting a missing lemma returns `LemmaEntryNotFound`
- deleting a missing surface returns `SurfaceEntryNotFound`
- deleting a `SurfaceEntry` only deletes that surface entry

## Pending Unresolved Targets

Missing relation targets may be preserved as pending unresolved refs in v1, but
only through pending-aware mutation flows.

Pending refs and pending relations are first-class readable state.

Pending refs are placeholders for future `LemmaEntry`s at `dumling` lemma
identity granularity. They are not bare spelling-only stubs.

### Pending DTOs

```ts
type PendingLemmaId<L extends SupportedLang> = string & {
  readonly __brand: "PendingLemmaId";
  readonly __language: L;
};

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
- `PendingLemmaId<L>` is an opaque branded string in the public API
- `PendingLemmaId<L>` is deterministically derived from `(language, canonicalLemma, lemmaKind, lemmaSubKind)`
- the v1 wire format is:

```ts
type PendingLemmaIdV1 =
  `pending:v1:${EncodedLanguage}:${EncodedCanonicalLemma}:${EncodedLemmaKind}:${EncodedLemmaSubKind}`;
```

- each encoded segment is `encodeURIComponent(...)` of the corresponding raw field value
- `language` is the exact `SupportedLang` discriminant string
- `canonicalLemma`, `lemmaKind`, and `lemmaSubKind` use exact field values with no lookup normalization
- the separator is literal `:`
- the prefix is literal `pending:v1:`
- callers may persist or transmit `PendingLemmaId<L>` across processes and implementations; conforming v1 implementations must round-trip this exact string format
- callers do not construct `PendingLemmaId<L>` directly; `dumdict` creates and returns it
- the caller must provide enough discriminators to create a pending ref
- pending refs must preserve the identity granularity that `dumling` uses for real lemmas
- pending refs stand for a future lemma identity, not just a future canonical spelling
- pending refs are deduped by language plus `(canonicalLemma, lemmaKind, lemmaSubKind)`
- pending-ref dedupe uses exact field equality over the stored pending-ref fields
- lookup normalization does not apply to pending-ref identity or dedupe
- `dumdict` does not infer semantic sufficiency beyond the pending-ref fields it is given
- it is the caller's responsibility to supply discriminator fields that are specific enough for the intended future lemma identity
- host-local unresolved disambiguation metadata must not participate in shared
  pending identity in v1
- if a host needs extra local-only discriminators for UI or workflow reasons,
  it should store them outside the shared `dumdict` snapshot contract
- if `dumling` lemma identity later requires more discriminators, `PendingLemmaRefInput`, pending dedupe, and pending resolution validation must expand in lockstep
- pending refs exist only while referenced by at least one pending relation

### Pending Resolution

This section describes the current exported reference-engine API.

Its current exported signature is:

```ts
resolvePendingLemma(
  pendingId: PendingLemmaId<L>,
  lemmaId: DumlingId<"Lemma", L>,
): DumdictResult<LemmaEntry<L>>;
```

Behavior:

- resolves the pending ref onto an already-existing lemma entry
- if `pendingId` decodes to a different language than the dictionary language, return `LanguageMismatch`
- if `lemmaId` decodes to a different language than the dictionary language, return `LanguageMismatch`
- if `pendingId` or `lemmaId` is malformed, return `DecodeFailed`
- returns `LemmaEntryNotFound` if the target lemma does not exist
- returns `PendingRefNotFound` if the pending ref does not exist
- validates the target lemma's `lemma` against the pending ref before resolution
- v1 validation checks `canonicalLemma`, `lemmaKind`, and `lemmaSubKind`
- mismatches return `PendingResolutionMismatch`
- if resolution would materialize any self-relation, return `SelfRelationForbidden`
- self-relation detection during resolution is atomic: no pending edges are consumed and no partial materialization occurs
- resolution does not overwrite the target lemma's notes, attestations, translations, or existing resolved relations beyond adding materialized edges from the pending ref
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
  | "LemmaEntryNotFound"
  | "SurfaceEntryNotFound"
  | "PendingRefNotFound"
  | "OwnerLemmaNotFound"
  | "PendingRelationNotFound"
  | "RelationTargetNotFound"
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
- `Surface`
- `DumlingId`
- language-bound decoding and validation
- universal lemma discriminator helper types

`dumdict` remains responsible for:

- dictionary lookup
- dictionary mutation semantics and planning
- lookup and normalization
- relation types and inverse logic
- pending unresolved targets

## Boundary With External Hosts

`dumdict` v1 is not a general storage adapter and does not read or write
directly to files, databases, or remote services.

The public architectural boundary for host integration should be:

- snapshot in
- lookup / mutation planning
- change-set out

The mutable in-memory API described in the Read, Write, and Delete sections
above remains the reference engine API. It may stay exported and may back the
planner internally, but it is not the architectural truth that hosts should be
built around.

At the host boundary, `dumdict` acts as the semantic engine that:

- validates dictionary DTOs
- maintains lookup indexes
- maintains reciprocal resolved relations
- creates and resolves pending targets
- turns mutation intents into dictionary-safe change operations

An external host remains responsible for:

- loading persisted dictionary data from its own storage
- serializing and deserializing that storage format
- committing planned writes to that storage format
- conflict detection and revision management
- sync with any remote or local authority outside `dumdict`

This keeps `dumdict` implementation-independent while allowing multiple hosts
to reuse the same dictionary semantics.

### Public Planning Boundary

The host-facing API should be snapshot-based, even if the implementation under
the hood remains mutable.

This section is target-state architecture, not a claim about the package's
current exports.

Minimal shape:

```ts
type DictionarySnapshotData<L extends SupportedLang> = {
  revision: string;
  lemmas: LemmaEntry<L>[];
  surfaces: SurfaceEntry<L>[];
  pendingRefs: PendingLemmaRef<L>[];
  pendingRelations: PendingLemmaRelation<L>[];
};

type ReadDictionarySnapshot<L extends SupportedLang> =
  DictionarySnapshotData<L> & {
    authority: "read";
    completeness: "partial" | "full";
  };

type AuthoritativeWriteSnapshot<L extends SupportedLang> =
  DictionarySnapshotData<L> & {
    authority: "write";
    completeness: "full";
  };

type ReadableDictionarySnapshot<L extends SupportedLang> =
  | ReadDictionarySnapshot<L>
  | AuthoritativeWriteSnapshot<L>;

type NewLemmaPayload<L extends SupportedLang> = {
  lemma: Lemma<L>;
  attestedTranslations: string[];
  attestations: string[];
  notes: string;
};

type OwnedSurfacePayload<L extends SupportedLang> = {
  surface: Surface<L>;
  ownerLemmaId: DumlingId<"Lemma", L>;
  attestedTranslations: string[];
  attestations: string[];
  notes: string;
};

type IntentRelationTarget<L extends SupportedLang> =
  | { kind: "existing"; lemmaId: DumlingId<"Lemma", L> }
  | { kind: "pending"; ref: PendingLemmaRefInput<L> };

type MutationIntentV1<L extends SupportedLang> =
  | {
      version: "v1";
      kind: "appendLemmaAttestation";
      lemmaId: DumlingId<"Lemma", L>;
      attestation: string;
    }
  | {
      version: "v1";
      kind: "insertLemma";
      entry: NewLemmaPayload<L>;
      ownedSurfaces?: OwnedSurfacePayload<L>[];
      initialRelations?: Array<
        | {
            relationFamily: "lexical";
            relation: LexicalRelation;
            target: IntentRelationTarget<L>;
          }
        | {
            relationFamily: "morphological";
            relation: MorphologicalRelation;
            target: IntentRelationTarget<L>;
          }
      >;
    }
  | {
      version: "v1";
      kind: "resolvePendingLemma";
      pendingId: PendingLemmaId<L>;
      lemmaId: DumlingId<"Lemma", L>;
    }
  | {
      version: "v1";
      kind: "upsertOwnedSurface";
      entry: OwnedSurfacePayload<L>;
    }
  | {
      version: "v1-extension";
      namespace: string;
      kind: string;
      payload: unknown;
    };

type ChangePrecondition<L extends SupportedLang> =
  | { kind: "snapshotRevisionMatches"; revision: string }
  | { kind: "lemmaExists"; lemmaId: DumlingId<"Lemma", L> }
  | { kind: "lemmaMissing"; lemmaId: DumlingId<"Lemma", L> }
  | { kind: "surfaceExists"; surfaceId: DumlingId<"Surface", L> }
  | { kind: "surfaceMissing"; surfaceId: DumlingId<"Surface", L> }
  | { kind: "pendingRefExists"; pendingId: PendingLemmaId<L> }
  | { kind: "pendingRefMissing"; pendingId: PendingLemmaId<L> };

type PlannedChangeOp<L extends SupportedLang> =
  | {
      type: "createLemma";
      entry: LemmaEntry<L>;
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "patchLemma";
      lemmaId: DumlingId<"Lemma", L>;
      ops: LemmaEntryPatchOp<L>[];
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "deleteLemma";
      id: DumlingId<"Lemma", L>;
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "createSurface";
      entry: SurfaceEntry<L>;
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "patchSurface";
      surfaceId: DumlingId<"Surface", L>;
      ops: SurfaceEntryPatchOp<L>[];
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "deleteSurface";
      id: DumlingId<"Surface", L>;
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "createPendingRef";
      ref: PendingLemmaRef<L>;
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "deletePendingRef";
      pendingId: PendingLemmaId<L>;
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "createPendingRelation";
      relation: PendingLemmaRelation<L>;
      preconditions?: ChangePrecondition<L>[];
    }
  | {
      type: "deletePendingRelation";
      relation: PendingLemmaRelation<L>;
      preconditions?: ChangePrecondition<L>[];
    };

interface DumdictSnapshotBoundary<L extends SupportedLang> {
  validateReadableSnapshot(
    snapshot: ReadableDictionarySnapshot<L>,
  ): DumdictResult<void>;
  validateAuthoritativeWriteSnapshot(
    snapshot: AuthoritativeWriteSnapshot<L>,
  ): DumdictResult<void>;
  applyPlannedChanges(
    snapshot: AuthoritativeWriteSnapshot<L>,
    changes: PlannedChangeOp<L>[],
  ): DumdictResult<AuthoritativeWriteSnapshot<L>>;
  hydrate(
    snapshot: AuthoritativeWriteSnapshot<L>,
  ): DumdictResult<Dumdict<L>>;
  exportSnapshot(
    dict: Dumdict<L>,
    revision: string,
  ): DumdictResult<AuthoritativeWriteSnapshot<L>>;
}

interface DumdictPlanningBoundary<L extends SupportedLang>
  extends DumdictSnapshotBoundary<L> {
  lookupBySurface(
    snapshot: ReadableDictionarySnapshot<L>,
    surface: string,
  ): DumdictResult<LookupResult<L>>;
  lookupLemmasBySurface(
    snapshot: ReadableDictionarySnapshot<L>,
    surface: string,
  ): DumdictResult<Record<DumlingId<"Lemma", L>, LemmaEntry<L>>>;
  plan(
    snapshot: AuthoritativeWriteSnapshot<L>,
    intent: MutationIntentV1<L>,
  ): DumdictResult<PlannedChangeOp<L>[]>;
}
```

`MutationIntentV1` is a starter interop set for shared consumers, not a claim
that the intent vocabulary is already complete.

Additional workflows may arrive through future versioned additions or
namespaced `v1-extension` intents.

For `insertLemma`, `entry` is intentionally relation-free. Initial graph edges
must come only from `initialRelations`, so the planner has a single source of
truth for relation materialization.

The planner should derive stable IDs from `lemma` and `surface` payloads rather
than requiring ordinary callers to manufacture them.

`PlannedChangeOp<L>[]` is intentionally patch-like and preconditioned. The
shared host boundary should preserve mutation intent and avoid forcing hosts to
invent merge semantics around whole-record upserts.

The snapshot helper surface is part of the intended interop contract, not an
optional convenience. Hosts should not each reimplement their own semantic
hydrate, validate, apply, or export logic around the low-level mutable engine.

### Authority Model

V1 distinguishes between:

- semantic authority: `dumdict`
- persistence authority: the host

`dumdict` is authoritative for:

- whether a payload is a valid `LemmaEntry` or `SurfaceEntry`
- whether a snapshot is semantically coherent
- what reciprocal relations must be added or removed
- how pending refs are deduped
- how pending refs resolve into real relations
- how valid change plans are derived from mutation intents

The host is authoritative for:

- where data is stored
- how revisions are tracked
- what slice of data is loaded into memory
- whether commits succeed or conflict
- how planned change operations are applied to the host's native storage model

`dumdict` should not invent fake lemma entries merely to represent unresolved
related targets.

When a related lemma does not yet exist, v1 should represent it as a
`PendingLemmaRef` plus one or more `PendingLemmaRelation`s. A host may project
that unresolved state into its UI as a "stub", but the stub is a host concern,
not a `dumdict` entity kind.

### Snapshot Safety

The current reference engine maintains reciprocal graph edges against whatever
lemma set is already loaded in memory.

That means partial state is unsafe for graph mutations.

V1 therefore distinguishes between:

- read snapshots: may be partial
- write snapshots: must be complete authoritative snapshots

This distinction should be explicit in the public types, not only in prose:

- `lookup...` APIs accept `ReadableDictionarySnapshot<L>`
- `plan(...)` accepts only `AuthoritativeWriteSnapshot<L>`
- a partial cache therefore cannot type-check as planning input

For v1, the simplest safe rule is:

- hosts may run read-only lookup flows against partial slices if they accept
  partial results
- partial read snapshots are allowed to violate owner-closure, but in that case
  snapshot-based lookup can only return owner lemmas that are actually present
  in the snapshot
- hosts must not ask `dumdict` to plan lemma-graph mutations against an
  arbitrary partial slice
- before planning any mutation, the writing host must load a full authoritative
  snapshot for the language
- if a consumer is not the write authority, it should forward the mutation
  intent to the canonical authority rather than planning locally against a
  cache

Until `dumdict` grows a different planning model, v1 write planning requires a
full-language snapshot.

This is an explicit v1 limitation intended for small-to-medium dictionaries and
single-authority shared-write deployments. It is not claimed to be the final
scaling model for very large dictionaries.

### Canonical Host Profile

To interoperate cleanly with different storage backends, hosts should provide a
small persistence contract around snapshots and planned changes.

Minimal shape:

```ts
interface DumdictHost<L extends SupportedLang> {
  readonly language: L;
  loadSnapshot(
    mode: "read",
  ): Promise<ReadableDictionarySnapshot<L>>;
  loadSnapshot(
    mode: "write",
  ): Promise<AuthoritativeWriteSnapshot<L>>;
  commitChanges(
    changes: PlannedChangeOp<L>[],
    baseRevision: string,
  ): Promise<
    | { ok: true; revision: string }
    | {
        ok: false;
        conflictAt: string;
        latest: AuthoritativeWriteSnapshot<L>;
      }
  >;
}
```

Rules:

- hosts may store richer local metadata, but the shared contract should stay
  centered on dictionary DTOs, pending state, and planned changes
- `revision` is host-defined and opaque to `dumdict`
- mutation planning requires a full authoritative snapshot in memory
- partial loads are read-only
- lookup ownership remains with `dumdict`
- `pendingRefs` are persisted explicitly in the snapshot contract
- pending refs must not be reconstructed only from encoded pending IDs
- pending IDs must come from `dumdict` / `dumling`-compatible identity
  handling, not arbitrary raw LLM text
- `commitChanges(...)` is atomic relative to `baseRevision`
- a conforming host must apply the full `PlannedChangeOp<L>[]` set or none of
  it
- a conforming host must not expose partially applied reciprocal edges, pending cleanup, or mixed revisions to other readers
- if a backend cannot provide atomic graph commits, it is not a conforming shared write authority for this contract
- such non-transactional backends may still be used in explicitly local-only mode, typically by materializing and atomically replacing a full snapshot projection
- incremental sync is out of scope for v1; on conflict or uncertainty, full
  reload is allowed and preferred
- canonical multi-writer hosts must provide a real `revision`
- weaker revision discipline is acceptable only in explicitly local-only,
  single-writer modes
- a `DumdictHost<L>` instance is language-bound
- a multi-language service should expose one host instance per language rather
  than multiplexing language through one unbound runtime contract
- a host must not invent ad hoc merge semantics for planner output; on
  conflict, it should reload, replan, and retry
- a host may apply `PlannedChangeOp<L>[]` directly to its own native storage or
  by using `dumdict.applyPlannedChanges(...)`
- a host that uses the mutable reference engine internally should use the
  shared `hydrate(...)` and `exportSnapshot(...)` helpers rather than each
  adapter inventing its own semantic import/export path

### Consumer Model

V1 does not need three separate architectures for Obsidian, a research server,
and an Electron app.

Instead, v1 needs one semantic contract and multiple host adapters.

Expected host roles:

- Node server: host adapter over SQLite and the canonical shared write
  authority
- Electron app: client/cache over that authority by default
- Obsidian plugin: either a local-only authority over markdown files or a
  client of the Node authority, but not both in one mode

The distinction that matters is not "which app type is this?" but:

- is this process a persistence authority?
- or is this process a UI/orchestration shell over another authority?

V1 host modes should be explicit:

- the Node/SQLite service is the only shared write authority
- Obsidian is either a local-only authority or a client-side adapter, but not
  both in the same mode
- Electron is a client/cache unless offline-first multi-writer sync is an
  explicit product goal

### Example User Flow

For a user flow such as selecting a surface form and deciding whether to patch
an existing lemma or insert a new one:

1. the consumer asks a small LLM to derive the probable lemma identity and any
   needed discriminators
2. in the read phase, the consumer may use a cheap host-side read path or
   storage index keyed by `dumdict`'s lookup normalization to fetch a narrow
   candidate slice
3. if the interaction remains read-only, no full authoritative snapshot is
   required
4. once the consumer decides it may mutate dictionary state, it routes the
   write through the canonical authority for that mode
5. the writing host loads the current authoritative full snapshot into memory
6. the writing host asks `dumdict.lookupBySurface(snapshot, surface)` or
   `dumdict.lookupLemmasBySurface(snapshot, surface)` for authoritative
   candidate entries
7. the consumer narrows candidates using its own discriminator logic and LLM
   assistance if needed
8. the consumer forms a higher-level `MutationIntentV1<L>` and asks
   `dumdict.plan(snapshot, intent)` for dictionary-safe
   `PlannedChangeOp<L>[]`
9. unresolved related targets remain represented as explicit `PendingLemmaRef`s
   plus `PendingLemmaRelation`s
10. the host commits the planned `PlannedChangeOp<L>[]` against its own
    storage using `baseRevision`
11. if the commit conflicts, the host reloads the latest full authoritative
    snapshot, replans from fresh state, and retries

In this model, the LLM does not directly mutate storage and `dumdict` does not
directly talk to storage. The host remains the bridge between semantic planning
and persistence.
