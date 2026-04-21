# `dumdict`

Dictionary storage, lookup indexes, and relation helpers built on top of `dumling`.

`dumdict` keeps three concerns separate:

- `LemmaEntry`: the stored dictionary node
- `SurfaceEntry`: the owned resolved surface entry
- pending lemma refs: unresolved relation targets that can be linked later

## Core idea

A `dumdict` instance is bound to one language:

```ts
const dict = makeDumdict("en");
```

A `LemmaEntry` stores the stable lemma payload plus graph-level dictionary metadata:

<!-- README_BLOCK:english-walk-lemma-entry -->

A `SurfaceEntry` stores a resolved surface plus an explicit owning lemma ID:

<!-- README_BLOCK:english-walk-surface-entry -->

Reciprocal lemma-to-lemma edges are maintained automatically:

<!-- README_BLOCK:reciprocal-relations -->

## Quickstart

Install the packages:

```sh
npm install dumdict dumling
```

Minimal usage with lookup by normalized surface:

<!-- README_BLOCK:quickstart-walk -->

The root export is intentionally small:

- `makeDumdict`: creates a language-bound in-memory dictionary
- `Relations`: enum, inverse, and repr helpers for lexical and morphological links
- `LexicalRelationsSchema`, `MorphologicalRelationsSchema`, and `RelationTargetDumlingIdsSchema`: validation helpers for relation payloads

## Scope

- Languages: `en`, `de`, `he`
- Runtime: `Node >= 20`
- Package format: ESM

For repo development:

- `bun test`
- `bun run build`
- `bun run generate:readme`
