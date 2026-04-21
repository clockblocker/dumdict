# dumdict V1 Architecture Notes

## Goal

`dumdict` is semantic glue between dictionary note storage and user-facing
applications.

It does not own persistence. At setup time, a host gives `dumdict` semantic
storage functions. At runtime, user-facing code calls a small task-oriented
service API. The service loads the storage context it needs, plans semantic
changes, and asks the host storage port to apply them.

The intended consumers are:

- an Obsidian plugin that serializes entries into markdown files
- a Node server backed by SQLite for research-oriented dictionary data
- an Electron app backed by remote LLM/database services plus a local cache

## Core Commitments

1. `dumdict` is semantic authority, not persistence authority.
2. `dumdict` has two integration surfaces: a clean runtime service API and a
   setup-time storage port API.
3. Hosts own storage, sync, serialization, conflict UX, and LLM orchestration.
4. Normal user flows do not load the full dictionary.
5. `dumdict-core` works over operation-shaped dictionary slices.
6. In-memory state may be used as per-operation scratch/indexing, but not as a
   long-lived source of truth.
7. Missing related lemmas are represented as pending refs plus pending
   relations, not fake entries.
8. Pending refs are picked up by deterministic lemma identity matches.
9. Plans return semantic commands. Hosts translate those commands into their
   own storage writes.
10. Plans include semantic preconditions, not only revision checks.
11. IDs are derived by `dumling`. Hosts store IDs but do not mint them.
12. LLM output enters `dumdict` as typed `dumling` DTOs plus `dumdict`
    note/relation DTOs, not persistence-specific payloads.
13. Full-corpus/admin APIs are separate maintenance tools, not the normal app
    integration path.

## Layers

### UI Caller

Lives outside `dumdict`.

The UI/application workflow owns:

- UI events and user workflows
- LLM prompts and calls
- sentence, selection, and discriminator context

It calls `dumdict` through a small task-oriented service API. It should not need
to know about pending relation pickup, operation-shaped slices, or storage query
details.

Example runtime calls:

```ts
await dict.findStoredLemmaSenses({ lemmaDescription });
await dict.addAttestation({ lemmaId, attestation });
await dict.addNewNote({ draft });
```

### Configured Dumdict Service

The service is created once with a language, optional config, and a storage
port.

```ts
const dict = createDumdictService({
  language: "ru",
  storage,
});
```

The service orchestrates each operation:

1. ask the storage port for the required semantic context
2. validate the loaded slice
3. plan semantic changes with `dumdict-core`
4. ask the storage port to commit those changes
5. return a clean result to the UI caller

The service may expose planned changes for debugging or advanced workflows, but
the ordinary UI-facing API should not require callers to handle plans directly.

### Storage Port

The storage port is supplied by the host at setup time.

It owns:

- persistence format
- sync and conflict UX
- database, file, or server access
- translation from semantic loads/writes into markdown, SQL, server calls, or
  another storage-specific operation

The storage port API may be detailed because it is implemented once by the host
adapter, not touched by ordinary UI code.

### Semantic Core

`dumdict-core` owns:

- entry validation
- lookup normalization
- relation semantics
- reciprocal relation maintenance
- pending unresolved targets
- planning from high-level intents to low-level semantic changes

The core shape should remain close to:

```ts
lookup(slice, request) -> LookupResult
planMutation(slice, intent) -> PlanMutationResult
validate(slice) -> Result
apply(slice, plan) -> nextSlice // reference/helper, not persistence
```

`dumdict-core` can remain exported for tests and advanced consumers, but the
main integration surface should be the configured service.

### In-Memory Engine

The in-memory implementation remains useful as:

- per-operation scratch state
- a fast index built from a supplied slice
- a reference implementation for applying plans
- a test helper

It must not become the app session source of truth unless a host explicitly
chooses a local-only mode.

## Setup API

At setup time, a host passes language/config plus storage functions.

```ts
type CreateDumdictServiceOptions<L> = {
  language: L;
  storage: DumdictStoragePort<L>;
  config?: DumdictServiceConfig<L>;
};

declare function createDumdictService<L>(
  options: CreateDumdictServiceOptions<L>,
): DumdictService<L>;
```

The storage port is the lower-level adapter boundary:

```ts
type DumdictStoragePort<L> = {
  loadStoredLemmaSensesContext(
    request: FindStoredLemmaSensesRequest<L>,
  ): Promise<StoredLemmaSensesSlice<L>>;

  loadInsertLemmaContext(
    request: InsertLemmaContextRequest<L>,
  ): Promise<InsertLemmaSlice<L>>;

  loadPatchLemmaContext(
    request: PatchLemmaContextRequest<L>,
  ): Promise<PatchLemmaSlice<L>>;

  commitChanges(
    request: CommitSemanticChangesRequest<L>,
  ): Promise<CommitSemanticChangesResult<L>>;
};
```

The exact storage port methods are still open, but this is the right layer for
operation-shaped details such as incoming pending relations.

## UI-Facing Service API

The v1 UI-facing service API should stay small and task-oriented.

```ts
type DumdictService<L> = {
  findStoredLemmaSenses(
    request: FindStoredLemmaSensesRequest<L>,
  ): Promise<FindStoredLemmaSensesResult<L>>;

  addAttestation(
    request: AddAttestationRequest<L>,
  ): Promise<MutationAppliedResult<L>>;

  addNewNote(
    request: AddNewNoteRequest<L>,
  ): Promise<MutationAppliedResult<L>>;
};
```

### Find Stored Lemma Senses

The UI performs lemma resolution before calling `dumdict`.

For example, after the end user selects a word, the UI may ask its LLM to
resolve the selected form into a lemma description. At this point the UI knows
the language, canonical lemma, lemma kind, and lemma subkind. It does not yet
know inherent features, emoji/discriminator identity, or which stored sense
matches the attestation.

`dumdict` receives only the resolved lemma description and returns stored
candidate senses for that lemma description.

```ts
type FindStoredLemmaSensesRequest<L> = {
  lemmaDescription: {
    language: L;
    canonicalLemma: string;
    lemmaKind: LemmaKindFor<L>;
    lemmaSubKind: LemmaSubKindFor<L, any>;
  };
};
```

The result should contain enough note data for the UI to ask its LLM which
candidate, if any, matches the attested lemma.

Returning only IDs is allowed as a strict minimum, but the preferred result is a
small disambiguation note per candidate.

```ts
type FindStoredLemmaSensesResult<L> = {
  revision: StoreRevision;
  candidates: LemmaSenseCandidate<L>[];
  diagnostics?: DumdictDiagnostic[];
};

type LemmaSenseCandidate<L> = {
  lemmaId: DumlingId<"Lemma", L>;
  note: LemmaNoteForDisambiguation<L>;
};

type LemmaNoteForDisambiguation<L> = {
  lemma: Lemma<L>;
  attestedTranslations: string[];
  attestations: string[];
  notes: string;
  relations?: RelationNotesForDisambiguation<L>;
};
```

The UI then asks its LLM whether one of these candidates matches the attestation.
If yes, it calls `addAttestation`. If no, it performs additional LLM calls to
construct a new note draft and then calls `addNewNote`.

`dumdict` does not accept sentence context for this lookup. It cannot interpret
context because it is not connected to the LLM.

### Add Attestation

The UI calls this when its LLM decided that the new attestation belongs to an
existing stored sense.

```ts
type AddAttestationRequest<L> = {
  lemmaId: DumlingId<"Lemma", L>;
  attestation: string;
};
```

The service hides loading patch context, planning semantic changes, and asking
the storage port to commit.

### Add New Note

The UI calls this when no stored sense matches and it has collected a full new
note draft through its own LLM flow.

```ts
type AddNewNoteRequest<L> = {
  draft: DumdictEntryDraft<L>;
};
```

The UI/LLM should not mint a new ID. It should provide a full `Lemma<L>` DTO,
and `dumdict`/`dumling` derive the stable lemma ID from that DTO.

`addNewNote` hides:

- detecting whether the lemma already exists
- creating the lemma if missing
- creating or updating owned surfaces
- adding explicit existing relations
- creating pending refs for missing relation targets
- picking up old pending refs that match the inserted lemma
- committing all semantic changes through the storage port

### Mutation Applied Result

Runtime mutation methods such as `addAttestation` and `addNewNote` should return a
clean applied result after the storage port accepts the semantic changes.

```ts
type MutationAppliedResult<L> = {
  status: "applied";
  baseRevision: StoreRevision;
  nextRevision: StoreRevision;
  affected: AffectedDictionaryEntities<L>;
  summary: MutationSummary;
  diagnostics?: DumdictDiagnostic[];
};
```

Conflict or storage errors should be reported as service errors/results at this
layer. The UI caller should not have to manually apply `PlannedChangeOp`s during
ordinary operation.

## Core Planning Result

The semantic core still produces plans internally.

A mutation plan answers: "Given this structured intent and loaded slice, what
semantic changes should the host write?"

```ts
type PlanMutationResult<L> = {
  baseRevision: StoreRevision;
  intent: DictionaryIntent<L>;
  changes: PlannedChangeOp<L>[];
  affected: AffectedDictionaryEntities<L>;
  summary: MutationPlanSummary;
  diagnostics?: DumdictDiagnostic[];
};
```

The configured service consumes this plan and passes its semantic changes to
the storage port. `dumdict-core` itself still does not commit.

## Pending References

Unresolved references are not stored as fake lemma entries.

They are stored as:

```ts
type PendingLemmaRef<L> = {
  pendingId: PendingLemmaId<L>;
  language: L;
  canonicalLemma: string;
  lemmaKind: LemmaKindFor<L>;
  lemmaSubKind: LemmaSubKindFor<L, any>;
};

type PendingLemmaRelation<L> = {
  sourceLemmaId: DumlingId<"Lemma", L>;
  relationFamily: "lexical" | "morphological";
  relation: LexicalRelation | MorphologicalRelation;
  targetPendingId: PendingLemmaId<L>;
};
```

Invariants:

- unresolved relation targets are not embedded inside `LemmaEntry` relation maps
- unresolved targets are not represented as `LemmaEntry` stubs
- every unresolved target is represented by `PendingLemmaRef`
- every link to an unresolved target is represented by `PendingLemmaRelation`
  from a real source lemma
- pending refs with no incoming pending relations are invalid and should be
  removed

Example:

If the host inserts a real lemma for `коса 𓌳` and the proposed relations include
missing `грабли`, `dumdict` should not create a fake `грабли` lemma.

It should plan:

```txt
createPendingRef(грабли identity tuple)
createPendingRelation(source = коса𓌳, target = pending-грабли)
```

## Pending Pickup

When a real lemma is inserted, `dumdict` must check whether existing pending
refs match that lemma's identity tuple:

```ts
{
  language,
  canonicalLemma,
  lemmaKind,
  lemmaSubKind,
}
```

For every matching pending ref, each incoming pending relation is materialized
into resolved reciprocal lemma relations.

Given:

```txt
sourceLemma --relation--> pendingTarget
```

And a newly inserted real lemma that matches `pendingTarget`, the plan should
include:

```txt
patchLemma(sourceLemma, add relation -> newLemma)
patchLemma(newLemma, add inverse relation -> sourceLemma)
deletePendingRelation(sourceLemma -> pendingTarget)
```

If that was the last pending relation pointing at the pending ref, the pending
ref disappears automatically.

Pickup is deterministic. It is based on the `dumling` lemma identity tuple, not
LLM judgment and not spelling-only matching.

## Consumer Draft Shape

LLMs and consumer applications should collect generated dictionary data into
typed DTOs before calling `dumdict`.

```ts
type DumdictEntryDraft<L> = {
  lemma: Lemma<L>;
  note: {
    attestedTranslations: string[];
    attestations: string[];
    notes: string;
  };
  ownedSurfaces?: OwnedSurfaceDraft<L>[];
  relations?: ProposedRelation<L>[];
};
```

Relation targets may be existing or pending:

```ts
type ProposedRelationTarget<L> =
  | { kind: "existing"; lemmaId: DumlingId<"Lemma", L> }
  | {
      kind: "pending";
      ref: {
        canonicalLemma: string;
        lemmaKind: LemmaKindFor<L>;
        lemmaSubKind: LemmaSubKindFor<L, any>;
      };
    };
```

This keeps LLM output persistence-agnostic while giving `dumdict` enough
structure to validate, normalize, and plan changes.

## Semantic Preconditions

Plans should carry semantic preconditions so hosts can detect conflicts without
depending only on a coarse revision check.

Examples:

```ts
type ChangePrecondition<L> =
  | { kind: "revisionMatches"; revision: StoreRevision }
  | { kind: "lemmaExists"; lemmaId: DumlingId<"Lemma", L> }
  | { kind: "lemmaMissing"; lemmaId: DumlingId<"Lemma", L> }
  | { kind: "surfaceExists"; surfaceId: DumlingId<"Surface", L> }
  | { kind: "surfaceMissing"; surfaceId: DumlingId<"Surface", L> }
  | { kind: "pendingRefExists"; pendingId: PendingLemmaId<L> }
  | { kind: "pendingRefMissing"; pendingId: PendingLemmaId<L> }
  | {
      kind: "lemmaAttestationMissing";
      lemmaId: DumlingId<"Lemma", L>;
      value: string;
    };
```

The host translates these checks into its own persistence model.

## Open Design: Operation-Shaped Slices

The next design decision is the exact host load contract.

For insert-lemma planning, the loaded slice must include enough data to:

- detect whether the lemma already exists
- create explicit proposed relations to existing lemmas
- create pending refs for missing relation targets
- find existing pending refs matching the inserted lemma
- pick up incoming pending relations from those refs
- patch the source lemmas of those incoming pending relations
- maintain reciprocal relation invariants

A likely shape:

```ts
type InsertLemmaSlice<L> = {
  revision: StoreRevision;
  existingLemma?: LemmaEntry<L>;
  matchingPendingRefs: PendingLemmaRef<L>[];
  incomingPendingRelations: PendingLemmaRelation<L>[];
  incomingPendingSourceLemmas: LemmaEntry<L>[];
  explicitlyRelatedExistingLemmas: LemmaEntry<L>[];
};
```

The host can satisfy this slice from markdown, SQLite, MySQL, a remote service,
or a local cache. `dumdict` should only depend on the semantic slice.

## Admin APIs

Full-corpus APIs may exist for maintenance:

```ts
exportAll()
importAll()
validateCorpus()
rebuildIndexes()
migrateSnapshot()
```

These APIs are not part of the normal lookup/mutation flow.
