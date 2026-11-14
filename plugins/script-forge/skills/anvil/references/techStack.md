# Tech Stack

> Source: Script Forge rulebook, **Tech Stack**. Read this before choosing dependencies; the must-have and pre-authorized lists are exhaustive — anything else needs Planning-time authorization.

* Run with **Node.js 22.18+** + **TypeScript**.
* ⚠️ Run with **as little dependencies as possible**. Every library installed outside the Node standard library must be **authorized and strongly motivated**.

## Must-have

Always present, no per-script justification needed:

* **`zod`** — typechecking and data validation at every step.
* **`node --test`** (built-in) — unit and integration testing, no install.

## Pre-authorized

Already vetted — bring in only when the trigger condition applies, no need to re-litigate at Planning:

* **`playwright`** — if E2E tests are needed, or for rendering/printing HTML & Markdown to styled PDF documents.
* **`p-limit`** — plain concurrency caps for bounded parallel for-loops.
* **`bottleneck`** — resource/weight-based rate limiting (e.g. LLM token budgets), when a plain concurrency cap isn't enough.
* **`ai`, `@ai-sdk/provider` & provider adaptors** (`@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.) — for LLM orchestration. **Scope constraint:** Restricted strictly to core completion primitives (`generateText`, `generateObject`, `streamText`, `streamObject`, `embed`, `embedMany` + single-turn `tools`). UI hooks, full agent frameworks (e.g. LangGraph or similar graph/agent orchestration libraries), or extra runtime abstractions are forbidden without explicit authorization.
* **`exceljs`** — when reading or writing multi-sheet or styled Excel workbooks (`.xlsx`). (Plain `.csv` uses a line or string parser).
* **`mammoth`** — for reading Word documents (`.docx`) and converting text directly to clean Markdown/HTML for downstream parsing or LLM ingestion.
* **`docx`** — for programmatically generating or writing Word files (`.docx`).
* **`pdf-parse`** — for extracting UTF-8 text streams from PDF documents.
* **`@js-temporal/polyfill`** — required until Node ships native `Temporal`; pin the Node version in `package.json` via `engines.node`. Import the polyfill once at the script entrypoint (`import "@js-temporal/polyfill";`) so it patches the global before any step code runs. Drop this dependency and import as soon as the pinned Node version has native support; track that removal as a standing cleanup item.
* **`mailparser`** (`.eml`) / **`@kenjiuno/msgreader`** (`.msg`) — for parsing raw MIME and Outlook email files into structured JSON.
* **`sharp`** — when images must be resized, cropped, or converted prior to multimodal/vision LLM ingestion.
* **`hono`** — lightweight HTTP server running on Node via `@hono/node-server` when a script must receive or process webhooks.
* **`cheerio`** — for HTML parsing and CSS selector traversal. Use its `htmlparser2` streaming parser for very large documents; Node has no native `HTMLRewriter`.

Anything outside these lists still needs Planning-time authorization and motivation.

## Development dependencies

Every tooling-script project must have these development dependencies:

* **`eslint`**
* **`@typescript-eslint/eslint-plugin`**
* **`@typescript-eslint/parser`**
* **`@stylistic/eslint-plugin`**
* **`eslint-plugin-unicorn`**
* **`typescript`**
* **`@types/node`**

These belong in `devDependencies`, not runtime `dependencies`.
