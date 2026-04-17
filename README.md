# `dumdict`

This repo is a stripped-down copy of `dumling` that keeps only the external fixtures and external tests.

It installs the published `dumling` package from npm and verifies that the public API still satisfies the external test suite:

```sh
npm install
npm test
```
