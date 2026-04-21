# `dumling` Public Surface Ergonomics

## Purpose

This document captures public-surface ergonomics recommendations for `dumling`
that are adjacent to, but meaningfully distinct from, the foundational API-gap
requests in `src/docs/DUMLING_CHANGE_REQUEST.md`.

The companion change request is primarily about exposing public linguistic-model
primitives that downstream packages currently have to reconstruct themselves.
This document is about how comfortable `dumling` feels to work with once those
primitives are public.

## Relationship To `DUMLING_CHANGE_REQUEST.md`

The two documents are related, but they should be evaluated at different
layers:

- `DUMLING_CHANGE_REQUEST.md`: downstream-unblocking public primitives
- this document: caller ergonomics and public-surface design quality

Some recommendations here depend on the change request landing first, or at
least on the same underlying public type structure becoming available.

## Summary

Highest-value ergonomics improvements:

1. DTO builders for lemma, surface, and selection creation
2. less visible duplication across the public type families
3. callable schema selectors instead of deep registry indexing
4. a more coherent high-level workflow API
5. a clearer primary style for language-bound usage

## 1. Add DTO Builders

### Recommendation

Expose small public constructors or builders for the core DTO families:

```ts
export function createLemma(...): Lemma;
export function createSurface(...): Surface;
export function createSelection(...): Selection;
```

These do not need to hide the underlying DTO model. They should simply remove
repetitive boilerplate and make the happy path less error-prone.

### Why this matters

Today, callers often have to hand-author DTO objects with many discriminator
fields and nested payload relationships. That is precise, but it is not very
forgiving.

Builder APIs would help with:

- typo-prone DTO construction
- defaulting canonical fields in common cases
- reducing the amount of generic annotation required in examples

### Relationship To The Change Request

Not strictly required for `dumdict`, but strongly enabled by the foundational
identity and feature-type exports requested there.

## 2. Reduce Public Type-Family Duplication

### Recommendation

Make the public type layers feel more unified. In the current shape, similar
concepts are exposed separately through:

- DTO types in `dumling/entities`
- operation-facing types in `dumling/operation`
- codec-facing types in `dumling/id`

Where possible, the public API should either:

- accept the canonical DTO types directly
- or re-export obvious aliases rather than presenting parallel type families as
  distinct public concepts

### Why this matters

The current separation is architecturally understandable, but it increases
cognitive load. A caller perceives multiple public APIs for the same conceptual
objects.

### Relationship To The Change Request

This overlaps with the change request's asks around public type helpers and
stable public entrypoints, but it is more opinionated. The change request asks
for the missing structure to be public; this recommendation asks for the public
surface to look more unified.

## 3. Replace Deep Schema Registry Indexing With Callable Selectors

### Recommendation

Keep the registry data model if needed internally, but add a callable public
selector API such as:

```ts
export const v0Schema = {
	selection(args: {
		language: V0SupportedLang;
		orthographicStatus: string;
		surfaceKind: string;
		lemmaKind: string;
		discriminator: string;
	}): z.ZodTypeAny;
};
```

### Why this matters

Deep property indexing is hard to discover, hard to autocomplete, and brittle
to document. A callable selector better communicates which axes matter.

### Relationship To The Change Request

Mostly orthogonal. The change request explicitly prioritizes public identity,
introspection, and feature typing over additional schema-surface work.

## 4. Add A Coherent High-Level Workflow API

### Recommendation

Offer a higher-level public workflow API for the common path from lemma to
surface to selection to ID generation.

Example direction:

```ts
export const v0Annotate = {
	fromLemma(...),
	fromSurface(...),
};
```

This can coexist with the lower-level `operation`, `idCodec`, and schema APIs.

### Why this matters

The current happy path is spread across multiple public areas. That is flexible
but makes `dumling` feel like a bag of adjacent utilities rather than one
coherent tool.

### Relationship To The Change Request

Mostly orthogonal. This is about top-level caller experience, not about
downstream packages recovering missing model primitives.

## 5. Clarify The Primary Language-Bound Style

### Recommendation

Choose and document one primary ergonomic pattern for language-bound usage.

For example, prefer:

```ts
idCodec.forLanguage(language)
operation.forLanguage(language)
```

over presenting that as equally primary with:

```ts
idCodec.English
operation.convert.lemma.toSurface(...)
```

### Why this matters

The current API is flexible, but the recommended path is not fully obvious.
Choosing one primary style would make examples more consistent and reduce
decision noise for callers.

### Relationship To The Change Request

Partially overlaps with the stable-export-surface concerns in the change
request, but this is mainly a documentation and API-design preference rather
than a missing primitive.

## Recommended Order

1. Land the foundational public-primitive work from
   `DUMLING_CHANGE_REQUEST.md`
2. Unify or alias the visible type families
3. Add DTO builders
4. Add callable schema selectors if direct schema consumption remains a common
   use case
5. Add a higher-level workflow API if `dumling` wants to optimize for ordinary
   application authors rather than only advanced integrators

## Bottom Line

The change request and this ergonomics document are complementary rather than
fully orthogonal.

The change request says: expose the public model structure that `dumling`
already owns.

This document says: once that structure is public, make the package feel easier
and more coherent for callers.
