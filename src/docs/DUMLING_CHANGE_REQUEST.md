# `dumling` Change Request From `dumdict`

## Purpose

This document proposes a small set of public `dumling` additions around:

- lemma and surface identity
- Dumling ID introspection
- feature-bag typing
- kind/sub-kind type relationships

These are linguistic-model concerns that downstream packages currently have to
reconstruct themselves because `dumling` does not expose them directly.

## Why These Additions Belong In `dumling`

`dumling` already defines the canonical shapes and IDs for `Lemma`, `Surface`,
and `Selection`. But downstream packages still lack a public way to:

- read stable lemma identity in a canonical way
- inspect an arbitrary Dumling ID for kind and language
- express valid kind/sub-kind relationships in public types
- work with inherent and inflectional feature bags directly

That forces downstream packages to duplicate identity logic, re-derive type
relationships, and probe IDs indirectly. Those are all responsibilities that
should stay owned by `dumling`.

## Summary

Highest-value additions:

1. lemma and surface identity helpers
2. Dumling ID parsing and introspection helpers
3. feature-bag type exports
4. public type helpers preserving the relation between lemma kind and sub-kind

## Requested Additions

## 1. Public Identity Helpers

### Request

Expose public helpers for reading the stable identity shape of `Lemma` and
`Surface`.

Suggested API:

```ts
export function getLemmaCanonicalLemma<L extends SupportedLang>(
	lemma: Lemma<L>,
): string;

export function getLemmaLanguage<L extends SupportedLang>(
	lemma: Lemma<L>,
): L;

export function getLemmaKind<L extends SupportedLang>(
	lemma: Lemma<L>,
): LemmaKindFor<L>;

export function getLemmaSubKind<L extends SupportedLang>(
	lemma: Lemma<L>,
): LemmaDiscriminatorFor<L, LemmaKindFor<L>>;

export function getSurfaceLanguage<L extends SupportedLang>(
	surface: Surface<L>,
): L;

export function getSurfaceNormalizedFullSurface<L extends SupportedLang>(
	surface: Surface<L>,
): string;
```

Preferred higher-level API:

```ts
export type LemmaIdentityInput<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	D extends LemmaDiscriminatorFor<L, LK>,
> = {
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: D;
};

export type LemmaIdentity<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	D extends LemmaDiscriminatorFor<L, LK>,
> = LemmaIdentityInput<L, LK, D> & {
	language: L;
};

export type LemmaIdentityForLanguage<L extends SupportedLang> = {
	[LK in LemmaKindFor<L>]: {
		[D in LemmaDiscriminatorFor<L, LK>]: LemmaIdentity<L, LK, D>;
	}[LemmaDiscriminatorFor<L, LK>];
}[LemmaKindFor<L>];

export function getLemmaIdentity<L extends SupportedLang>(
	lemma: Lemma<L>,
): LemmaIdentityForLanguage<L>;
```

A narrower overloaded form that preserves exact `LK` / `D` when the input lemma
is already narrower would be even better.

For surfaces, `dumdict` does not strictly need a brand-new `getSurfaceLemma(...)`
capability. The useful ask is either:

- promote `operation.extract.lemma.fromSurface(...)` as a stable public
  ergonomic export
- or do not add a new surface-to-lemma helper at all

### Why this matters

- `dumdict` already needs this information in multiple places
- downstream packages should not cast runtime shapes themselves
- identity logic should be canonical and owned by `dumling`

### Priority

High.

## 2. Public Lemma Identity Input Types

### Request

Expose a strong public type for "lemma identity without the full lemma payload".

Suggested API:

```ts
export type LemmaIdentityInput<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	D extends LemmaDiscriminatorFor<L, LK>,
> = {
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: D;
};
```

The field name `lemmaSubKind` is fine for DTO readability, but the type helper
names should align with `dumling`'s existing discriminator terminology.

This should preserve the relationship between kind and discriminator inside an
already language-bound context.

For standalone fully-qualified identity DTOs, `LemmaIdentity<...>` should carry
the `language` field. `LemmaIdentityInput<...>` should stay language-bound, so
it fits current downstream usage such as pending unresolved targets inside a
dictionary that already has a fixed language.

### Why this matters

Without this, downstream code falls back to structurally weak shapes like:

```ts
{
	canonicalLemma: string;
	lemmaKind: UniversalLemmaKind;
	lemmaSubKind: string;
}
```

That allows impossible combinations such as:

```ts
{
	canonicalLemma: "foo",
	lemmaKind: "Lexeme",
	lemmaSubKind: "Idiom",
}
```

`dumdict` needs a public `dumling` type here for pending unresolved targets.

### Priority

High.

## 3. Public Dumling ID Parsing And Introspection

### Request

Expose public helpers that let downstream packages inspect a Dumling ID without
having to try every supported language manually.

Suggested API:

```ts
export type ParsedDumlingIdForLanguage<L extends SupportedLang> =
	| {
			kind: "Lemma";
			language: L;
			value: Lemma<L>;
	  }
	| {
			kind: "Surface";
			language: L;
			value: Surface<L>;
	  }
	| {
			kind: "Selection";
			language: L;
			value: Selection<L>;
	  };

export type ParsedDumlingId = {
	[L in SupportedLang]: ParsedDumlingIdForLanguage<L>;
}[SupportedLang];

export function parseDumlingId(id: string): Result<ParsedDumlingId, DumlingIdDecodeError>;

export function inferDumlingIdLanguage(id: string): SupportedLang | undefined;

export function inferDumlingIdKind(
	id: string,
): "Lemma" | "Surface" | "Selection" | undefined;
```

If `parseDumlingId(...)` exists and is good, the smaller helper functions are
optional.

### Why this matters

`dumdict` currently has to do this:

- iterate supported languages
- call `tryToDecodeAs(...)` repeatedly
- infer kind/language by probing multiple APIs

That is duplicated downstream work and scales poorly as `dumling` grows.

### Priority

High.

## 4. Public Feature Type Exports

### Request

Expose the feature-bag types that are already latent in the system as part of
the public API.

Requested exports:

```ts
export type AbstractFeatures = ...;
export type UniversalFeatureKey = ...;
export type UniversalFeatureValue<K extends UniversalFeatureKey> = ...;
export type FeatureValueSet<T> = ...;
```

And add:

```ts
export type InherentFeatures<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
	D extends LemmaDiscriminatorFor<L, LK>,
> = ...;

export type InflectionalFeatures<
	L extends SupportedLang,
	SK extends SurfaceSurfaceKindFor<L>,
	LK extends SurfaceLemmaKindFor<L, SK>,
	D extends SurfaceDiscriminatorFor<L, SK, LK>,
> = ...;
```

### Why this matters

This is a meaningful quality-of-life win for downstream packages:

- generic feature utilities become possible without giant inferred unions
- builders and patch helpers can type feature bags directly
- host applications can manipulate feature maps without reaching into internal
  schema registries

### Relative value

- `InherentFeatures<...>`: high value
- `InflectionalFeatures<...>`: high value
- `AbstractFeatures`: medium value
- `UniversalFeatureValue<K>`: medium value

Taken together, these are a strong improvement.

### Priority

Medium-high.

## 5. Public Type Helpers Around Lemma And Surface Registries

### Request

Expose the type helpers that downstream packages need to express valid generic
constraints over `Lemma` and `Surface`.

Examples of useful helpers:

```ts
export type LemmaKindFor<L extends SupportedLang> = ...;
export type LemmaDiscriminatorFor<
	L extends SupportedLang,
	LK extends LemmaKindFor<L>,
> = ...;

export type SurfaceSurfaceKindFor<L extends SupportedLang> = ...;
export type SurfaceLemmaKindFor<
	L extends SupportedLang,
	SK extends SurfaceSurfaceKindFor<L>,
> = ...;
export type SurfaceDiscriminatorFor<
	L extends SupportedLang,
	SK extends SurfaceSurfaceKindFor<L>,
	LK extends SurfaceLemmaKindFor<L, SK>,
> = ...;
```

### Why this matters

The feature helpers in the previous section are much more useful if these
generic building blocks are public too.

Without them, downstream code ends up using:

- very wide unions
- string literals copied from registry knowledge
- local re-derivation of internal type logic

### Priority

Medium.

## 6. Stable Public Export Surface

### Request

If the above types and helpers exist, they should be available from stable
public entrypoints, not only from deep internal paths.

Root-level exports are optional. Stable public subpaths such as
`dumling/identity`, `dumling/introspection`, or a similar intentionally small
surface would also satisfy this request.

Example:

```ts
import type {
	AbstractFeatures,
	InherentFeatures,
	InflectionalFeatures,
	LemmaDiscriminatorFor,
	LemmaIdentity,
	LemmaIdentityInput,
	LemmaKindFor,
	UniversalFeatureValue,
} from "dumling/identity";

import {
	getLemmaIdentity,
} from "dumling/identity";

import { parseDumlingId } from "dumling/introspection";
```

### Why this matters

If consumers have to import from internal generated declaration paths, the API
is effectively still private.

### Priority

High.

## Nice-To-Have Additions

## 7. Public Guards Or Predicates

Suggested helpers:

```ts
export function isLemma(value: unknown): value is Lemma;
export function isSurface(value: unknown): value is Surface;
export function isSelection(value: unknown): value is Selection;
```

These are not required for `dumdict`, but they would help generic host code.

## 8. Public Identity Derivation Helpers

If `LemmaIdentityInput` exists, helpers like this would be useful:

```ts
export function sameLemmaIdentity<L extends SupportedLang>(
	left: Lemma<L> | LemmaIdentityInput<L, LemmaKindFor<L>, LemmaDiscriminatorFor<L, LemmaKindFor<L>>>,
	right: Lemma<L> | LemmaIdentityInput<L, LemmaKindFor<L>, LemmaDiscriminatorFor<L, LemmaKindFor<L>>>,
): boolean;
```

This is not required, but it would reduce downstream duplication around
identity comparison.

If a standalone `LemmaIdentity<...>` helper also exists, it should compare
language as part of identity.

## Explicit Non-Requests

These are not asks for `dumling`:

- dictionary relation types like synonym, hypernym, or derivedFrom
- dictionary snapshot DTOs
- dictionary pending target DTOs
- dictionary planning APIs
- `dumdict` storage helpers

Those belong in `dumdict`.

## Recommended Implementation Order

1. Add the public generic helper types:
   `LemmaKindFor<...>`, `LemmaDiscriminatorFor<...>`,
   `SurfaceSurfaceKindFor<...>`, `SurfaceLemmaKindFor<...>`,
   `SurfaceDiscriminatorFor<...>`
2. Add `LemmaIdentityInput<...>`, `LemmaIdentity<...>`, and
   `LemmaIdentityForLanguage<...>`
3. Add `getLemmaIdentity(...)` and the lower-level lemma/surface accessors
4. Add `parseDumlingId(...)` or equivalent ID introspection helper
5. Add public feature exports:
   `AbstractFeatures`, `UniversalFeatureValue<K>`,
   `InherentFeatures<...>`, `InflectionalFeatures<...>`
6. Expose the approved APIs through stable public entrypoints

## Expected Downstream Impact On `dumdict`

If the above lands, `dumdict` should be able to remove or simplify:

- `src/dumdict/domain/runtime-accessors.ts`
- language-probing ID inference logic in `src/dumdict/domain/validation.ts`
- language-probing ID checks in `src/dumdict/relations/relation.ts`
- weak identity shapes currently used for pending lemma targets

It would also make future `dumdict` public helpers safer, especially around:

- pending unresolved targets
- builders for lemma/surface-backed DTOs
- typed feature-aware utilities

## Bottom Line

The most important thing `dumling` can add for `dumdict` is not more schema
volume. It is more public structure around identity, ID introspection, and
feature typing.

That would let `dumdict` stay focused on dictionary semantics instead of
reconstructing linguistic internals that `dumling` already knows.
