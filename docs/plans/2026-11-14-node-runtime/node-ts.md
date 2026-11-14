# Node native TypeScript: capability matrix

Scope: running `.ts` files with no flags, on the Node lines Script Forge cares
about. Documented limits come from the Node API docs; behaviour marked
"probed" was run locally on **2026-11-14**.

## Version facts

| Version | Behaviour |
| --- | --- |
| 22.6.0 | Type stripping added behind `--experimental-strip-types`. |
| 22.18.0 | Enabled by default; experimental warning removed; `import.meta.main` added. |
| 22.x (current 22.23.5) | Docs still label the feature **Stability 1.2 - Release candidate**. |
| 24.x | Docs label the feature **Stability 2 - Stable**. |
| 26.x | Current LTS; type stripping remains Stable. Not probed here. |

The 22.18.0 release note is explicit: "This feature is experimental and is
subject to change." "No flags" and "no experimental status" are different
claims.

## Matrix

| Capability | 22.18 | 22.22 (probed) | 24.21 (probed) |
| --- | --- | --- | --- |
| Run erasable `.ts` with no flag | Yes | Yes | Yes |
| Experimental warning printed | No | No | No |
| Type checking performed | No | No | No |
| Inline type annotations | Yes | Yes | Yes |
| `import type` / `export type` | Yes | Yes | Yes |
| Type-only import without `type` | Runtime error | Runtime error (documented) | Runtime error (documented) |
| `enum` | Error | `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` | Error |
| `namespace` with runtime code | Error | Error (documented) | Error (documented) |
| `namespace` with types only | Yes | Yes (documented) | Yes (documented) |
| Parameter properties | Error | Error (documented) | Error (documented) |
| Import aliases (`import x = require`) | Error | Error (documented) | Error (documented) |
| Decorators | Parse error | Parse error (documented) | Parse error (documented) |
| `.tsx` | Unsupported | Unsupported | Unsupported |
| `tsconfig` `paths` | Unsupported | Unsupported | Unsupported |
| Extensionless relative import | `ERR_MODULE_NOT_FOUND` | `ERR_MODULE_NOT_FOUND` | `ERR_MODULE_NOT_FOUND` |
| Relative import with `.ts` extension | Yes | Yes | Yes |
| `.ts` file under `node_modules` | Refused | Refused | Refused |
| Source maps | Not generated | Not generated | Not generated |
| `import.meta.dirname` | Yes | Yes | Yes |
| `import.meta.main` | Yes (22.18+) | Yes (`true` when run directly) | Yes |
| `--env-file-if-exists` | Yes (22.9+) | Yes; missing file warns and continues | Yes |
| `node --test` discovers `.test.ts` | Expected | Yes | Yes |
| `node:sqlite` | Stability 1.1 | Works with `ExperimentalWarning` | Stability 1.2, no warning |
| Global `Temporal` | No | `undefined` | `undefined` |
| `--experimental-transform-types` needed for enums etc. | Yes | Yes | Yes |

## Code rules that follow

1. **No enums.** Use `as const` objects plus union types, or plain string
   unions.
2. **No namespaces with runtime code.** Type-only namespaces are fine, but
   there is no reason to use them in new code.
3. **No parameter properties.** Declare fields and assign them in the
   constructor.
4. **No import aliases.** Use standard ESM imports.
5. **Every relative import ends in `.ts`** in source. `tsc` can rewrite these
   to `.js` for the published CLI; the workspace runs them as-is.
6. **`import type` is mandatory for types.** Enable `verbatimModuleSyntax` so
   `tsc` enforces the same rule the runtime needs.
7. **No `tsconfig` paths.** Use relative imports or `#` subpath imports.
8. **No `.tsx`.**
9. **`tsc --noEmit` is the type checker.** The runtime never checks types, and
   `tsc` does not read the runtime's stripped output.
10. **Never ship `.ts` through npm.** Node refuses it under `node_modules`;
    compile the CLI.

## Test runner

`node --test` discovers `*.test.ts` from the working directory and runs it with
type stripping. Verified on 22.22 from a directory containing one
`probe.test.ts`:

```text
✔ native ts in node:test (0.478ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

TAP is the default reporter; `--test-reporter=spec` produces the output above.
Use default discovery rather than passing a directory argument.

## What this means for Script Forge

- **Generated workspaces:** native TypeScript is viable on Node 22.18+, with
  the code rules above. The TS support is a release candidate on Node 22.
- **Published CLI:** compile with `tsc`. Native TypeScript cannot be used from
  `node_modules`, so the CLI must ship JavaScript.
- **Checkpoint store:** do not use `node:sqlite` on Node 22. It works, but it
  prints an experimental warning and is Stability 1.1. A JSON store with
  atomic rename avoids the issue and matches the runner's access pattern.
- **Dates:** keep `@js-temporal/polyfill`. Neither 22.22 nor 24.21 exposes a
  global `Temporal`.
- **CI:** pin 22.18.x as the floor and the current LTS (26.x) as the forward
  canary. The floor catches accidental use of newer syntax; the canary catches
  drift in the opposite direction.

## Sources

- [Node.js v22 TypeScript docs](https://nodejs.org/docs/latest-v22.x/api/typescript.html)
- [Node.js v24 TypeScript docs](https://nodejs.org/docs/latest-v24.x/api/typescript.html)
- [Node.js 22.18.0 release notes](https://nodejs.org/en/blog/release/v22.18.0)
- [Node.js v22 SQLite docs](https://nodejs.org/docs/latest-v22.x/api/sqlite.html)
- [Node.js v24 SQLite docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
