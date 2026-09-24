---
"jev-patterns": patch
---

`rank()`'s type-level `exclude` narrowing no longer collapses to `never`, and no longer over-narrows, when `exclude` isn't a literal tuple.

Previously, `rank()`'s result type subtracted `exclude`'s members from the option union unconditionally. That subtraction is only sound when `exclude` is a tuple whose exact members are known at the type level (e.g. an inline `exclude: ['other']`). Two real cases broke it: an open dictionary input (`Record<string, number>`, option type `string`) with a plain `string[]` or a mixed literal/variable exclude array collapsed `.option` to `never` — the first real consumer had to add an explicit type annotation to recover `string`. Separately, a typed literal input with a union-typed `exclude` array variable (e.g. `readonly ('a' | 'b')[]`) removed every member of that union from the result type, even though only whichever value the array actually held at runtime was excluded — the type claimed a value couldn't appear when it could.

`rank()` now narrows the result only when `exclude`'s length and every one of its members are statically known (a literal tuple of literal values); otherwise the result keeps the full option type. Excluding an inline literal tuple (`exclude: ['other']`) still narrows as before, and excluding a literal outside a typed probability map's keys is still a compile error. No runtime behavior changes.
