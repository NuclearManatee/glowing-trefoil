# Cowork VM runtime: what is documented

Research question: what runtime does a Claude Cowork task provide for plugin
shell commands, and can a Node-based CLI assume anything about it?

Method: first-party Anthropic documentation only, accessed **2026-11-14**.
Where a page does not state something, this note says "not documented" rather
than inferring from behaviour. Empirical probes are marked separately.

## Findings

### Shell commands run in a VM, not on the host

> When a Cowork task runs on your computer, Claude runs its shell commands in a
> virtual machine (VM).
>
> - [Network access for shell commands](https://claude.com/docs/cowork/guide/network-access)

The VM is local to the user's machine. The docs describe what it can reach, not
what is installed inside it.

### The npm registry is reachable, but download-only

The `Package managers only` allowlist tier reaches "common package registries
and `github.com`". For npm specifically:

> `registry.npmjs.org`, `registry.yarnpkg.com`, `crates.io` | Package installs
> and `npm audit` | Publishing, unpublishing, and account changes

A publish attempt returns `403 Package registry is download-only`.

This means `npx -y <package>` is plausible under the default package-manager
tier. It does not say which Node version runs `npx`.

### Plugin components load unevenly

From [Plugin feature support across platforms](https://claude.com/docs/plugins/platform-support):

| Component | Cowork |
| --- | --- |
| Skills | Loads |
| Commands | Loads; run with `/plugin-name:command` |
| Agents | Loads |
| Hooks | Loads |
| Remote MCP server | Loads |
| Local MCP server | Loads only when the session runs on your computer |
| Executables in a top-level `bin/` | **Can't be installed** |
| LSP servers, output styles, themes, settings | Ignored |

The `bin/` rule is the important packaging constraint: a plugin with a
top-level `bin/` is refused entirely. The current design already avoids it by
publishing the CLI as an npm package and invoking it through `npx`.

### The Node version is not documented

The Cowork overview, the plugin guide, the platform-support matrix, and the
network-access page describe the VM, file access, plugins, and egress. None of
them state a Node, npm, or Bun version. A search of the published documentation
index (`https://claude.com/docs/llms.txt`) finds no runtime or toolchain page
for the VM.

This is a negative result, not a version claim.

## What the repository currently assumes

- `README.md`: "Cowork has Node and npm but not guaranteed Bun."
- `docs/plans/2026-11-04-install-dx-proposal.md`: an internal observation that
  Cowork's VM runs Node 22.22.

Both are assumptions. The first is consistent with `npx` being the distribution
path; the second has no linked Anthropic source.

## Probe procedure

Run this in a real Cowork task, not in Claude Code and not on the host:

1. `node --version` and `npm --version`.
2. `npx -y glowing-trefoil version`.
3. Create `probe.ts` containing `const x: string = "ok"; console.log(x);` and
   run `node probe.ts`.
4. Create `probe.test.ts` importing `node:test`, then run `node --test`.
5. Run `node --env-file-if-exists=.env.example probe.ts` with a missing file.

Record the exact output. Step 1 is the gate: if it is below 22.18.0, generated
workspaces cannot use native TypeScript and the plan must change. If Node is
absent, the npm package cannot run at all.

## Implication for the decision

Cowork compatibility is a strong reason to target Node: the documented
distribution channel is npm, and npm requires Node. It is not evidence for a
specific Node version, and it is not evidence for Bun.

The decision document therefore treats Node 22.18+ as an assumption to verify,
not a proven fact. The compiled-CLI design is deliberately independent of that
assumption: it runs on any Node 22.x, including versions before type stripping
became default.

## Sources

- [Network access for shell commands](https://claude.com/docs/cowork/guide/network-access)
- [Plugin feature support across platforms](https://claude.com/docs/plugins/platform-support)
- [Cowork overview](https://claude.com/docs/cowork/overview)
- [Install plugins in Cowork](https://claude.com/docs/cowork/guide/plugins)
- [Plugin structure and testing](https://claude.com/docs/plugins/build)
