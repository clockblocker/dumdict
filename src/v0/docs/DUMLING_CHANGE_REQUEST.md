# `dumling` Change Request From `dumdict`

## Purpose

This document proposes a small set of public `dumling` additions around:

- lemma and surface identity
- Dumling ID introspection
- feature-bag typing
- kind/sub-kind type relationships

These are linguistic-model concerns that downstream packages currently have to
reconstruct themselves because `dumling` does not expose them directly.

This document is intentionally about foundational public API gaps that block
downstream packages such as `dumdict`. Broader caller-experience and ergonomic
recommendations live in the companion document
`src/docs/DUMLING_PUBLIC_SURFACE_ERGONOMICS.md`.

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

These asks are meant to expose public model structure that `dumling` already
owns internally. They are not meant to redesign the higher-level caller
experience for ordinary application code.

## Requested Additions

## 1. Public Identity Helpers

### Request

Expose public helpers for reading the stable identity shape of `Lemma` and
`Surface`.

Suggested API:

```ts
export function getLemmaIdentity<L extends V0SupportedLang>(
	lemma: Lemma<L>,
): V0LemmaIdentityForLanguage<L>;

export function getSurfaceLanguage<L extends V0SupportedLang>(
	surface: Surface<L>,
): L;

export function getSurfaceNormalizedFullSurface<L extends V0SupportedLang>(
	surface: Surface<L>,
): string;

export function getSurfaceOwnerLemmaId<L extends V0SupportedLang>(
	surface: Surface<L>,
): DumlingId<"Lemma", L>;

// Optional convenience helpers. These are weaker than getLemmaIdentity(...)
// because they do not preserve the relation between kind and discriminator.
export function getLemmaCanonicalLemma<L extends V0SupportedLang>(
	lemma: Lemma<L>,
): string;

export function getLemmaLanguage<L extends V0SupportedLang>(
	lemma: Lemma<L>,
): L;

export function getLemmaKind<L extends V0SupportedLang>(
	lemma: Lemma<L>,
): V0LemmaKindFor<L>;

export function getLemmaSubKind<L extends V0SupportedLang>(
	lemma: Lemma<L>,
): V0LemmaDiscriminatorFor<L, V0LemmaKindFor<L>>;
```

Preferred higher-level API:

```ts
export type V0LemmaIdentityInput<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	D extends V0LemmaDiscriminatorFor<L, LK>,
> = {
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: D;
};

export type V0LemmaIdentityInputForLanguage<L extends V0SupportedLang> = {
	[LK in V0LemmaKindFor<L>]: {
		[D in V0LemmaDiscriminatorFor<L, LK>]: V0LemmaIdentityInput<L, LK, D>;
	}[V0LemmaDiscriminatorFor<L, LK>];
}[V0LemmaKindFor<L>];

export type V0LemmaIdentity<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	D extends V0LemmaDiscriminatorFor<L, LK>,
> = V0LemmaIdentityInput<L, LK, D> & {
	language: L;
};

export type V0LemmaIdentityForLanguage<L extends V0SupportedLang> = {
	[LK in V0LemmaKindFor<L>]: {
		[D in V0LemmaDiscriminatorFor<L, LK>]: V0LemmaIdentity<L, LK, D>;
	}[V0LemmaDiscriminatorFor<L, LK>];
}[V0LemmaKindFor<L>];

export function getLemmaIdentity<L extends V0SupportedLang>(
	lemma: Lemma<L>,
): V0LemmaIdentityForLanguage<L>;
```

`getLemmaIdentity(...)` should be treated as the primary typed identity API.
A narrower overloaded form that preserves exact `LK` / `D` when the input lemma
is already narrower would be even better.

For surfaces, the downstream need is stable ownership introspection, not a
public promise that `Surface` exposes an embedded full lemma payload. The useful
ask is:

- add a small stable helper such as `getSurfaceOwnerLemmaId(...)`
- or expose a comparably narrow helper such as `getSurfaceLemmaIdentity(...)`

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
export type V0LemmaIdentityInput<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	D extends V0LemmaDiscriminatorFor<L, LK>,
> = {
	canonicalLemma: string;
	lemmaKind: LK;
	lemmaSubKind: D;
};

export type V0LemmaIdentityInputForLanguage<L extends V0SupportedLang> = {
	[LK in V0LemmaKindFor<L>]: {
		[D in V0LemmaDiscriminatorFor<L, LK>]: V0LemmaIdentityInput<L, LK, D>;
	}[V0LemmaDiscriminatorFor<L, LK>];
}[V0LemmaKindFor<L>];
```

The field name `lemmaSubKind` is fine for DTO readability, but the type helper
names should align with `dumling`'s existing discriminator terminology.

This should preserve the relationship between kind and discriminator inside an
already language-bound context.

This request is about the current v1 lemma identity model used by `dumdict`.
If `dumling` lemma identity later requires more discriminators, these public
types should expand in lockstep rather than freezing today's field list as a
permanent final shape.

In the common "any lemma identity input for language `L`" case, downstream code
should be able to use `V0LemmaIdentityInputForLanguage<L>` rather than writing
`V0LemmaIdentityInput<L, V0LemmaKindFor<L>, V0LemmaDiscriminatorFor<L, V0LemmaKindFor<L>>>`,
which would collapse the relationship between `lemmaKind` and `lemmaSubKind`
back into a weak cross-product.

For standalone fully-qualified identity DTOs, `V0LemmaIdentity<...>` should carry
the `language` field. `V0LemmaIdentityInput<...>` should stay language-bound, so
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
export type V0InspectedDumlingIdForLanguage<L extends V0SupportedLang> = {
	kind: "Lemma" | "Surface" | "Selection";
	language: L;
};

export type V0InspectedDumlingId = {
	[L in V0SupportedLang]: V0InspectedDumlingIdForLanguage<L>;
}[V0SupportedLang];

export function inspectDumlingId(
	id: string,
): V0InspectedDumlingId | undefined;

// Optional full decode helper if dumling wants to expose it too.
export type V0ParsedDumlingIdForLanguage<L extends V0SupportedLang> =
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

export type V0ParsedDumlingId = {
	[L in V0SupportedLang]: V0ParsedDumlingIdForLanguage<L>;
}[V0SupportedLang];

export function parseDumlingId(id: string): Result<V0ParsedDumlingId, DumlingIdDecodeError>;
```

`inspectDumlingId(...)` is the core ask. A full `parseDumlingId(...)` helper is
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
export type V0AbstractFeatures = ...;
export type V0UniversalFeatureKey = ...;
export type V0UniversalFeatureValue<K extends V0UniversalFeatureKey> = ...;
export type V0FeatureValueSet<T> = ...;
```

And add:

```ts
export type V0InherentFeatures<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
	D extends V0LemmaDiscriminatorFor<L, LK>,
> = ...;

export type V0InflectionalFeatures<
	L extends V0SupportedLang,
	SK extends V0SurfaceSurfaceKindFor<L>,
	LK extends V0SurfaceLemmaKindFor<L, SK>,
	D extends V0SurfaceDiscriminatorFor<L, SK, LK>,
> = ...;
```

### Why this matters

This is a meaningful quality-of-life win for downstream packages:

- generic feature utilities become possible without giant inferred unions
- builders and patch helpers can type feature bags directly
- host applications can manipulate feature maps without reaching into internal
  v0Schema registries

### Relative value

- `V0InherentFeatures<...>`: high value
- `V0InflectionalFeatures<...>`: high value
- `V0AbstractFeatures`: medium value
- `V0UniversalFeatureValue<K>`: medium value

Taken together, these are a strong improvement.

### Priority

Medium-high.

## 5. Public Type Helpers Around Lemma And Surface Registries

### Request

Expose the type helpers that downstream packages need to express valid generic
constraints over `Lemma` and `Surface`.

Examples of useful helpers:

```ts
export type V0LemmaKindFor<L extends V0SupportedLang> = ...;
export type V0LemmaDiscriminatorFor<
	L extends V0SupportedLang,
	LK extends V0LemmaKindFor<L>,
> = ...;

export type V0SurfaceSurfaceKindFor<L extends V0SupportedLang> = ...;
export type V0SurfaceLemmaKindFor<
	L extends V0SupportedLang,
	SK extends V0SurfaceSurfaceKindFor<L>,
> = ...;
export type V0SurfaceDiscriminatorFor<
	L extends V0SupportedLang,
	SK extends V0SurfaceSurfaceKindFor<L>,
	LK extends V0SurfaceLemmaKindFor<L, SK>,
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
	V0LemmaDiscriminatorFor,
	V0LemmaIdentity,
	V0LemmaIdentityInput,
	V0LemmaIdentityInputForLanguage,
	V0LemmaKindFor,
} from "dumling/identity";

import {
	getLemmaIdentity,
} from "dumling/identity";

import {
	getSurfaceOwnerLemmaId,
	inspectDumlingId,
} from "dumling/introspection";

import type {
	V0AbstractFeatures,
	V0InherentFeatures,
	V0InflectionalFeatures,
	V0UniversalFeatureValue,
} from "dumling/features";
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

If `V0LemmaIdentityInput` exists, helpers like this would be useful:

```ts
export function sameLemmaIdentity<L extends V0SupportedLang>(
	left: Lemma<L> | V0LemmaIdentityInputForLanguage<L>,
	right: Lemma<L> | V0LemmaIdentityInputForLanguage<L>,
): boolean;
```

This is not required, but it would reduce downstream duplication around
identity comparison.

If a standalone `V0LemmaIdentity<...>` helper also exists, it should compare
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
   `V0LemmaKindFor<...>`, `V0LemmaDiscriminatorFor<...>`,
   `V0SurfaceSurfaceKindFor<...>`, `V0SurfaceLemmaKindFor<...>`,
   `V0SurfaceDiscriminatorFor<...>`
2. Add `V0LemmaIdentityInput<...>`, `V0LemmaIdentityInputForLanguage<...>`,
   `V0LemmaIdentity<...>`, and `V0LemmaIdentityForLanguage<...>`
3. Add `getLemmaIdentity(...)` as the primary typed API, plus any approved
   convenience accessors
4. Add `inspectDumlingId(...)` or equivalent kind/language introspection helper
5. Add a stable narrow surface ownership helper such as
   `getSurfaceOwnerLemmaId(...)`
6. Optionally add `parseDumlingId(...)` if `dumling` wants a public full decode
   API
7. Add public feature exports:
   `V0AbstractFeatures`, `V0UniversalFeatureValue<K>`,
   `V0InherentFeatures<...>`, `V0InflectionalFeatures<...>`
8. Expose the approved APIs through stable public entrypoints

## Expected Downstream Impact On `dumdict`

If the above lands, `dumdict` should be able to remove or simplify:

- private lemma/surface identity casting in `src/dumdict/domain/runtime-accessors.ts`
- language-probing ID inference logic in `src/dumdict/domain/validation.ts`
- language-probing ID checks in `src/dumdict/relations/relation.ts`
- weak identity shapes currently used for pending lemma targets

It would also make future `dumdict` public helpers safer, especially around:

- pending unresolved targets
- builders for lemma/surface-backed DTOs
- typed feature-aware utilities

## Bottom Line

The most important thing `dumling` can add for `dumdict` is not more v0Schema
volume. It is more public structure around identity, ID introspection, and
feature typing.

That would let `dumdict` stay focused on dictionary semantics instead of
reconstructing linguistic internals that `dumling` already knows.
