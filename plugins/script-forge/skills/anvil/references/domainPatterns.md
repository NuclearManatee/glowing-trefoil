# Domain Patterns

> Source: Script Forge rulebook, **Domain Patterns**. Recurring patterns for data formats and LLM calls, applied on top of the syntax rules.

## Data I/O

* **Boundary Validation:** Every dataset read from disk, stream, or remote API must pass through a **Zod** schema at the ingress boundary. Derive downstream types directly via `z.infer`.
* **Dates & Timezones:** Use the native global **`Temporal`** API for all date arithmetic, duration parsing, and ISO/timezone formatting. External date libraries (`dayjs`, `date-fns`) are prohibited. This requires the `@js-temporal/polyfill` global patch described in **Tech Stack → Pre-authorized** until the pinned Bun version ships native support.
* **Standardized Ingress/Egress:** Read raw datasets from `<localDir>/raw_data/<scriptname>/` (default `local/raw_data/`) or explicit CLI flags. Within that folder:
  * `<localDir>/raw_data/<scriptname>/input/` — untouched source dumps, immutable once dropped.
  * `<localDir>/raw_data/<scriptname>/archive/` — *(optional)* prior runs' inputs, for recurring scripts that need to diff or reprocess earlier drops.
  * Moving files from `input/` to `archive/` is a **Planning-time decision**: the plan must state whether this is done manually by the user or automatically by the script at a defined point in the run. The chosen lifecycle must be documented in the script's README **Requirements** section.
  Output transformed datasets to dedicated build directories or SQLite databases (`bun:sqlite`), never into `<localDir>/raw_data/`, avoiding root-level file dumps.
* **Memory-Conscious Ingress:** Avoid loading large files into memory using full `readFile` operations. Process line-by-line using Node/Bun readable streams or chunked batch iteration.

## Handling Files

* **CSV:** Parse using line streaming or Bun string parsing. Any CSV that is not explicitly guaranteed comma-clean must use a quote-aware parser (a small hand-rolled state machine is acceptable; Bun has no native CSV parser). The naive `split(",")` approach is permitted only as a documented fast path for trusted delimiter-only input.
* **Excel (`.xlsx`):** Read and write workbooks using `exceljs`.
* **Word (`.docx`):** Use `mammoth` to convert incoming `.docx` files straight to Markdown/HTML before passing context to an LLM or database. Use `docx` when generating Word output.
* **PowerPoint (`.pptx`):** Unzip the file buffer natively (or via lightweight `fflate`) and extract slide text from XML tags (`<a:t>`). Do not pull in heavy or unmaintained PowerPoint libraries.
* **PDF:** Extract text streams using `pdf-parse`. For PDF output generation, convert content to HTML/Markdown first and print via Playwright (`page.pdf()`).
* **Email (`.eml` / `.msg`):** Parse email files into structured objects via `mailparser` or `@kenjiuno/msgreader`, validating the output payload with Zod.
* **HTML:** Use Bun's native `HTMLRewriter` for fast streaming tag and text extraction. Fall back to `cheerio` only when complex CSS query selectors are required.

## LLMs

* **Surface Area Constraint:** Restrict `@ai-sdk` usage to raw invocation utilities. Do not import UI hooks, client-side wrappers, or external agent framework utilities. Use `@ai-sdk` whenever streaming, tool-calling, or schema-constrained output (`generateObject`) is needed; use native `fetch` only for one-off unstructured text with no retry, streaming, or tool requirement.
* **Structured Output Enforcer:** All LLM responses intended for downstream execution logic must be constrained by Zod schemas via `generateObject`. Never parse loose Markdown text using custom regex when structured output calls are available.
* **Budget & Rate Control:** Wrap external LLM calls using `p-limit` for concurrency caps or `bottleneck` for rate/token limits. Unbounded `Promise.all` over LLM endpoints is forbidden.
* **Fault Handling & Classification:** Model API rate limits (HTTP 429), timeouts, or server errors (HTTP 5xx) must be caught, logged as structured objects, and retried with intra-call exponential backoff for a bounded number of attempts (using `bottleneck` retry support or an explicit wrapper) before escalating to category `external` (exit code `3`) and the checkpoint-restart path.
* **Privacy at Planning:** Before wiring an LLM call into a script, explicitly define during **Planning** whether payload data requires PII masking, local/self-hosted execution (e.g., Ollama or vLLM), or specific vendor data-retention guarantees.
* **Prompt Files:** Prompts live as Markdown files under `assets/prompts/` (see Scaffolding). No templating library is authorized for this — it would violate the minimal-dependency rule for a problem plain TypeScript already solves. A prompt file is delimited frontmatter + body:

  `assets/prompts/summarize.md`
  ```md
  ---
  id: summarize
  description: Summarize order stats for a human reader
  model: gpt-4o-mini
  ---
  Summarize this order data in one sentence: {{stats}}
  ```

  Frontmatter is validated with **Zod**; variable substitution is a native `{{var}}` regex replace — no dependency required:

  > Provider and model in the frontmatter are chosen at prompt-file creation: ask the user, presenting the current default model per provider (see config.md) — no baked-in default.

  `commons/loadPrompt.ts`
  ```ts
  import { readFile } from "node:fs/promises";
  import { z } from "zod";

  const promptMeta = z.object({
    id: z.string(),
    description: z.string(),
    model: z.string(),
  });
  type PromptMeta = z.infer<typeof promptMeta>;

  // Splits frontmatter/body, validates meta, exposes a render fn — no templating lib needed.
  export async function loadPrompt(path: string) {
    const raw = (await readFile(path, "utf8"))
      .replace(/\r\n/g, "\n")
      .trim();
    const [, fm, body] = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/) ?? [];
    if (!fm || !body) {
      console.log({ error: "malformed prompt file", category: "user", path });
      process.exit(1);
    }

    const meta: PromptMeta = promptMeta.parse(
      Object.fromEntries(
        fm.split("\n").map((line) => line.split(/:\s(.+)/).slice(0, 2) as [string, string])
      )
    );

    const render = (vars: Record<string, string>) =>
      body.trim().replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? "");

    return { meta, render };
  }
  ```

  `steps/summarize.ts`
  ```ts
  import { generateText } from "ai";
  import { openai } from "@ai-sdk/openai";
  import { loadPrompt } from "../commons/loadPrompt";

  const { meta, render } = await loadPrompt("assets/prompts/summarize.md");

  const { text } = await generateText({
    model: openai(meta.model),
    prompt: render({ stats: "1284 orders, avg $42.50" }),
  });

  console.log({ summary: text });
  ```

  > When creating new prompt files, start from the shape in `assets/prompt.template.md` (anvil asset).

## Networking

* Use **hono** to handle webhook workflows.
* **Reachability**: Working with webhooks needs a tunnel. Address this as a required operational step during Planning using ngrok.
* **Signature verification**: HMAC/signature check on incoming payloads (Stripe-Signature, X-Hub-Signature-256, etc.) is mandatory.
* **No Naked Data** applies to recieving payloads too.
* A webhook needs its own stop condition (e.g. timeout) defined in Planning phase.
