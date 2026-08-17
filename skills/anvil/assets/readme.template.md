# README template — shape of a script's README.md (rulebook: Documentation).

Fill every slot. Keep the frontmatter keys and section names exactly; the
mermaid diagram must be a superset of the steps with decision diamonds and
loop edges. Delete this instruction comment.

---
title: <script title>
purpose: <one-liner: what the script does>
initial input: <where the raw input comes from>
final output: <what the script produces>
run: <namespace:scriptname — namespace from user_config.defaultNamespace, default "tools">
namespace: <namespace>
---

# <script title>

```mermaid
flowchart TD
    <!-- superset of steps: one node per step, decision diamonds for branches,
         loop edges for repeat/until patterns, checkpoint key per step -->
    A[<first step>] --> B{<branch?>}
    B -- yes --> C[<step>]
    B -- no --> D[<step>]
    C -.->|repeat| B
    D --> E[<final step>]
```

## Steps

### <step name>
- **input:** <what this step consumes>
- **output:** <what this step produces>
- **rollback:** <compensating action, or `null`>
- **rollbackFn:** <`yes` or `manual-only`>
- **checkpoint key:** <literal step name, or naming pattern for generated steps>
- <what the step does, in order; the "why" of non-obvious choices>

## Requirements

- <environment variables — declared here, never read from `.env` as a file>
- <ngrok / tunnel needs, if any>
- <non-standard dependencies used>
- <expected shape of `${user_config.localDirectory}/raw_data/<scriptname>/input/` (default `local/raw_data/`) and its archive lifecycle>
