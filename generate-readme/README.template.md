# `dumdict`

Dictionary storage, lookup indexes, and relation helpers built on top of `dumling`.

`dumdict` keeps three concerns separate:

- `LemmaEntry`: the stored dictionary node
- `SurfaceEntry`: the owned resolved surface entry
- pending lemma refs: unresolved relation targets that can be linked later

## Core idea

A `dumdict` service is bound to one language and one storage adapter:

```ts
const dict = createDumdictService({ language: "en", storage });
```

A `LemmaEntry` stores the stable lemma payload plus graph-level dictionary metadata:

<!-- README_BLOCK:english-walk-lemma-entry -->

A `SurfaceEntry` stores a resolved surface plus an explicit owning lemma ID:

<!-- README_BLOCK:english-walk-surface-entry -->

Service reads return storage-facing lemma sense candidates:

<!-- README_BLOCK:service-lookup -->

## Quickstart

Install the packages:

```sh
npm install dumdict dumling
```

Minimal usage with the service API:

<!-- README_BLOCK:quickstart-walk -->

The root export is intentionally small:

- `createDumdictService`: creates a language-bound service over a storage port
- DTO types such as `LemmaEntry`, `SurfaceEntry`, `DumdictEntryDraft`, and relation payloads
- dumling helpers such as `makeDumlingIdFor` and `inspectDumlingId`

## Scope

- Languages: `en`, `de`, `he`
- Runtime: `Node >= 20`
- Package format: ESM

For repo development:

- `bun test`
- `bun run build`
- `bun run generate:readme`
