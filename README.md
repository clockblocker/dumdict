# `dumdict`

`dumdict` now owns dictionary-level relation helpers that do not belong in `dumling`.

The repo still installs the published `dumling` package from npm and keeps the external consumer tests that verify `dumling`’s public API from the outside.

Current scope:

- relation enums and inverse helpers
- relation schemas keyed by lemma Dumling IDs
- external compatibility tests for the published `dumling` package

Test commands:

```sh
npm install
npm test
npm run test:external
npm run test:internal
```
*** Add File: /Users/annagorelova/work/dumdict/src/index.ts
export * from "./relations/public";
