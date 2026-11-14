# Harness runtime matrix: can a Claude-style plugin run here?

Research question: which coding-agent harnesses can consume a plugin shaped like
Script Forge — Markdown commands, a `SKILL.md` skill, and an `npx`-invoked CLI —
and what runtime do they actually provide?

Method: only first-party documentation and first-party repositories were used.
Every claim is linked to its source; quoted text is verbatim. All sources were
accessed **2026-11-14**. Where a page does not state something, the cell says
"not documented" rather than inferring from behaviour.

## Matrix

| Harness | Execution environment | Node guaranteed / version | Bun | `npx` / network | Plugin / command format |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** | Local terminal, IDE extension, desktop Code tab; Bash tool runs on the host | No when installed natively ("doesn't use your Node.js at runtime"); the npm package requires **Node 22+** | Available to plugin installs: `bun.lock` selects Bun | Host network; `npx` works only if the host has Node/npm | `.claude-plugin/plugin.json`; `commands/*.md`; `skills/<name>/SKILL.md`; marketplace at `.claude-plugin/marketplace.json` |
| **Claude Cowork** | Shell commands run in a **VM on your computer** (desktop app) | Not documented | Not documented | npm registry reachable under "Package managers only"; publishes blocked | Same Claude plugin folder; `.claude-plugin/plugin.json`; top-level `bin/` makes the plugin **uninstallable** |
| **Cursor (local)** | Your machine: IDE agent and `agent` CLI | Not documented; inherits host | Not documented | Host network and host `npx` | Cursor Plugins (`.cursor-plugin/plugin.json`) or Agent Plugins (root `plugin.json`); **no `.claude-plugin` documented** |
| **Cursor Cloud Agents** | "isolated Ubuntu machines", snapshot-based | Not documented | Not documented | Internet on by default; egress allowlists; `npm install`/`pnpm install` in `environment.json` | Same plugin formats; installed per environment |
| **OpenCode** | Terminal, desktop, web; native binary, client/server | Not documented as a prerequisite | Not documented | Plugins are installed from npm/Git by OpenCode itself | `.opencode/commands/*.md`, `.opencode/skills/<id>/SKILL.md`; plugins are npm packages in `opencode.json`; **no `.claude-plugin`** |
| **Codex CLI** | Local machine; Rust binary | Not required by the CLI | Not documented | Host network; `npx` only if host Node exists | Root `plugin.json` (Agent Plugins schema) or legacy `.codex-plugin/plugin.json`; **no `.claude-plugin`** |
| **Codex Cloud** | Per-task workspace from a prepared filesystem | **Selectable 18 / 20 / 22** in the reference image (npm, corepack, yarn, pnpm included) | **1.2.10** in the reference image | Allow package managers, allowlist domains, or enable all public internet | Same Codex plugin format; `/plugins` in CLI |
| **Gemini CLI** | Local shell; tools with side effects run in a container by default | **Node.js 20.0.0+** | Not documented | `npx @google/gemini-cli` documented; network inherits host | Extensions (`gemini-extension.json`); skills in `.gemini/skills` or `.agents/skills`; **no `.claude-plugin`** |
| **GitHub Copilot CLI** | Local machine; native install or npm | **Node 22+** for the npm install path | Not documented | Host network and host `npx` | **Reads `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`** as legacy locations; Agent Plugins 1.0 root `plugin.json` |
| **Copilot coding agent** | Cloud sandbox per session, GitHub Actions, or custom environment | Runner image ships **Node 22.23.4 / npm 10.9.9** (Actions path) | Not documented | Firewall-configurable; Actions runner has npm/npx | Plugins configured "through repository settings"; same manifest locations as CLI |
| **Devin** | Linux VM snapshot per session (cloud), plus Devin CLI/Desktop | Not documented in the default image; installable via blueprint | Not documented | Not documented | **Falls back to `.claude-plugin/plugin.json`**; `${CLAUDE_PLUGIN_ROOT}` expands; also `.devin-plugin/plugin.json` and Agent Plugins |

## Per-harness notes

### Claude Code

Claude Code is the reference implementation, so a Claude-style plugin works by
definition. The runtime detail that matters is Node: the native installer ships a
binary that "doesn't use your Node.js at runtime", while the npm package
"requires Node.js 22 or later"
([setup](https://code.claude.com/docs/en/setup)). System requirements list macOS
13.0+, Windows 10 1809+, Ubuntu 20.04+, and "internet connection required".

Plugin dependency installation is more capable than expected: when Claude Code
caches a plugin it "also installs the plugin's Node.js package dependencies
there, so the plugin's hooks and MCP servers can load them". The lockfile picks
the package manager — `bun.lock` → Bun, `npm-shrinkwrap.json` or
`package-lock.json` → npm — and `yarn.lock` / `pnpm-lock.yaml` are explicitly
skipped ([plugin loading](https://code.claude.com/docs/en/plugins/loading)).

Plugin layout: `.claude-plugin/plugin.json`, `commands/*.md`,
`skills/<name>/SKILL.md`, hooks and MCP servers
([components](https://code.claude.com/docs/en/plugins/components)). A marketplace
is "a directory or repository with a `.claude-plugin/marketplace.json` file"
([marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)).

### Claude Cowork

Cowork is the closest analogue to a sandboxed consumer of the same plugin folder,
and it diverges in two ways that matter.

First, shell commands do not run directly on the host: "When a Cowork task runs on
your computer, Claude runs its shell commands in a virtual machine (VM)"
([network access](https://claude.com/docs/cowork/guide/network-access)). Network
egress is a setting: "Allow network egress" off, "Domain allowlist: None",
"Package managers only", or "All domains". The package-manager tier reaches
`registry.npmjs.org` for "Package installs and `npm audit`", but publishing is
blocked with `403 Package registry is download-only`. So `npx` from the public
registry is plausible there; an arbitrary host is not.

Second, component support is narrower. Skills, commands, agents, hooks and remote
MCP servers load; local MCP servers load only "when the Cowork session runs on
your computer"; and "Executables in a top-level `bin/` directory" are marked
"Can't be installed" ([platform support](https://claude.com/docs/plugins/platform-support)).
Cowork also "doesn't read the Claude Code CLI's `~/.claude` directory"
([overview](https://claude.com/docs/cowork/overview)).

Node version inside the Cowork VM is **not documented**.

### Cursor

Cursor has two plugin formats and neither is documented as Claude-compatible:
"Cursor supports the Agent Plugins open standard alongside its own plugin
format", where Agent Plugins use a root `plugin.json` and Cursor Plugins use
`.cursor-plugin/plugin.json` ([plugins](https://cursor.com/docs/plugins)). The
docs name `${CURSOR_PLUGIN_ROOT}`, not `${CLAUDE_PLUGIN_ROOT}`. Commands and
hooks exist only in the Cursor Plugins format.

Local Cursor runs on the developer's machine, so Node/Bun/npx are whatever the
host provides; the CLI installs from a shell script or PowerShell one-liner and
does not document a Node prerequisite
([CLI install](https://cursor.com/docs/cli/installation)).

Cloud Agents are a different proposition: "Cloud agents run on isolated Ubuntu
machines" with a snapshot-based environment, and `.cursor/environment.json` uses
`"install": "npm install"` or `pnpm install && ./custom_script.sh`
([setup](https://cursor.com/docs/cloud-agent/setup)). Network defaults to open —
"The agent has internet access by default. You can configure network egress
controls" ([secrets & network](https://cursor.com/docs/cloud-agent/security-network)).
Node and Bun versions in that image are **not documented**.

### OpenCode

OpenCode's plugin surface is not file-shaped like Claude's. Skills live at
`.opencode/skills/<skill-id>/SKILL.md`, commands at `.opencode/commands/*.md`
with `$ARGUMENTS`, and plugins are npm packages or local paths listed in
`opencode.json` ([skills](https://opencode.ai/docs/skills/),
[commands](https://opencode.ai/docs/commands/),
[plugins](https://opencode.ai/docs/plugins/)). "Package installation accepts npm
names with versions, tags, or ranges, plus npm-compatible Git package
specifications" — so distributing a CLI through npm fits, but there is no
`.claude-plugin` loader.

Installation is a native binary with several wrappers: "The npm package uses a
postinstall script to select the native `opencode` binary for your platform"
([intro](https://opencode.ai/docs/)). Neither a Node nor a Bun requirement is
stated for users, and neither is guaranteed by the docs. Plugins are TypeScript
modules executed by the OpenCode server, which is the practical reason Bun-like
semantics appear, but the docs do not promise a Bun binary on `PATH`.

### OpenAI Codex

Codex splits cleanly. The CLI is a local Rust binary; the repository publishes
`codex-x86_64-unknown-linux-musl.tar.gz`-style archives, and Node is not a
prerequisite ([codex repo](https://github.com/openai/codex)). Plugins are a root
`plugin.json` using the Agent Plugins schema, with `.codex-plugin/plugin.json`
kept "as a compatibility fallback"; installation is via `/plugins` and a
configured marketplace ([plugins](https://learn.chatgpt.com/docs/plugins),
[packaging](https://developers.openai.com/plugins/build/plugins)). No
`.claude-plugin` support is documented.

Codex Cloud is explicitly polyglot. The reference base image is "the reference
implementation of the base Docker image available in OpenAI Codex", built
`FROM ubuntu:24.04`; it exposes `CODEX_ENV_NODE_VERSION` with values `18`, `20`,
`22` and ships `corepack`, `yarn`, `pnpm`, `npm`, plus "`bun`: 1.2.10"
([codex-universal](https://github.com/openai/codex-universal)). A task starts in
its own workspace, and "Existing tasks keep their own working state"
([cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)).

Network is a per-environment control: enable all public internet, or "allow
package managers or add specific hosts under **Additional allowed domains**".
Restricted mode still permits the allowed destinations, so an npm-registry `npx`
can work without full egress.

### Gemini CLI

Gemini CLI states the requirement plainly: "Runtime: Node.js 20.0.0+", and both
`npm install -g @google/gemini-cli` and `npx @google/gemini-cli` are documented
([installation](https://www.geminicli.com/docs/get-started/installation)). It also
sandboxes by default: "For security and isolation, Gemini CLI can be run inside a
container. This is the default way that the CLI executes tools that might have
side effects."

Extensibility uses its own manifest, `gemini-extension.json`, installed with
`gemini extensions install <source>`
([extension reference](https://www.geminicli.com/docs/extensions/reference)).
Skills follow the Agent Skills standard and are discovered from
`~/.gemini/skills/`, `.gemini/skills/`, or the `.agents/skills/` alias
([skills](https://www.geminicli.com/docs/cli/skills)). No `.claude-plugin`
support is documented.

Caveat: the docs carry a banner that for "Unpaid tier and Google One users:
Gemini CLI was replaced by Antigravity CLI on June 18th, 2026."

### GitHub Copilot

Copilot is the strongest non-Claude adopter of the Claude plugin layout. The CLI
reference states: "A root `plugin.json` that targets Agent Plugins takes
precedence over `.plugin/plugin.json` and `.claude-plugin/plugin.json`", and the
marketplace loader checks "`marketplace.json`, `.plugin/marketplace.json`,
`.github/plugin/marketplace.json`, or `.claude-plugin/marketplace.json`".
`${PLUGIN_DATA}` is "also available as `${COPILOT_PLUGIN_DATA}` and
`${CLAUDE_PLUGIN_DATA}`" ([CLI plugin reference](https://docs.github.com/en/copilot/reference/cli-plugin-reference)).
That is an explicit compatibility statement, not an inference.

Installing the CLI via npm requires "Node.js 22 or later"
([install](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli)),
but native installers exist for Windows, macOS, and Linux.

The coding agent is cloud-side. Plugins are available on "Copilot in the cloud.
Configure plugins through repository settings", alongside VS Code, the CLI, and
the Copilot app ([plugins concept](https://docs.github.com/en/copilot/concepts/customizations/plugins)).
Sessions run in a cloud sandbox, GitHub Actions, or a custom environment, with a
`copilot-setup-steps` job on `ubuntu-latest`
([environment customization](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/customize-the-agent-environment)).
On the Actions path the image provides Node 22.23.4 and npm 10.9.9
([runner image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)).
Bun is not documented on that image.

### Devin

Devin's cloud environment is "a Linux-based virtual machine with your repositories
cloned, tools installed, dependencies resolved" and is frozen into a snapshot that
every session boots from ([environment](https://docs.devin.ai/onboard-devin/environment)).
No Node version is stated for the default image; Node is something a blueprint
installs, and the docs point at Node.js blueprint templates
([blueprints](https://docs.devin.ai/onboard-devin/environment/blueprints)).

Devin supports Claude plugins explicitly: "if there's no `.devin-plugin/plugin.json`,
Devin falls back to `.claude-plugin/plugin.json`. Claude plugins' root `.mcp.json`
and manifest `mcpServers` field are honored, and `${CLAUDE_PLUGIN_ROOT}` in server
configs expands to the plugin root." The same page lists manifest precedence
`.devin-plugin/plugin.json` > `.claude-plugin/plugin.json` > root `plugin.json`
([CLI plugins](https://docs.devin.ai/cli/extensibility/plugins/overview)). Devin
CLI itself installs from a shell script, Homebrew, or an `.exe`, so no Node
prerequisite is documented.

`npx` and registry access inside Devin sessions are **not documented**; treat them
as unknown until tested.

## What this means for a Claude-style plugin

- **Portable as-is:** Claude Code, Copilot CLI (explicit `.claude-plugin` paths),
  Devin (explicit fallback), Cowork for the components it loads. Copilot and Devin
  also honour `${CLAUDE_PLUGIN_ROOT}`, so bundled paths survive.
- **Needs an adapter:** Cursor, OpenCode, Codex, Gemini CLI. Cursor and Codex read
  Agent Plugins, which covers skills and MCP but not Claude `commands/`; OpenCode
  needs `.opencode/commands` and `.opencode/skills`; Gemini needs
  `gemini-extension.json`.
- **Node is not a safe assumption on the harness side.** Only Gemini CLI (Node
  20+), Copilot CLI (22+ on npm), and Claude Code's npm path (22+) state a
  requirement. Native installs of Claude Code, Codex CLI, Cursor CLI, OpenCode,
  and Devin CLI deliberately do not depend on host Node.
- **`npx` is a network question, not a runtime question.** It needs both a Node
  toolchain and registry egress. Cowork's "Package managers only" tier and Codex
  Cloud's package-manager allowance are the documented cases where that holds
  without full internet; Cursor Cloud and Copilot's runner are open by default or
  configurable.
- **Avoid a top-level `bin/`.** Cowork refuses to install plugins that contain one,
  which would silently drop the plugin on that surface.
