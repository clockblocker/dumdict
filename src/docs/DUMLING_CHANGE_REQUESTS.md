# `dumling` Change Requests

## Goal

Expose the smallest possible helper surface from `dumling` so `dumdict` can define language-generic DTOs and pending lemma refs cleanly.

## Request

### 1. `SupportedLang`

```ts
export type SupportedLang = TargetLanguage;
```

Why:

- clearer downstream API naming

### 2. `UniversalLemmaKind`

```ts
export type UniversalLemmaKind = ...;
```

Why:

- needed for pending unresolved lemma refs

### 3. `UniversalLemmaSubKind`

```ts
export type UniversalLemmaSubKind = ...;
```

Why:

- needed for pending unresolved lemma refs

## Nice To Have

### 4. Helper For Lemma ID From Resolved Surface

```ts
getLemmaIdForResolvedSurface(surface)
```

Why:

- makes `SurfaceEntry.ownerLemmaId` checks simpler

