# Prompt template — shape of a script's prompt files (rulebook: LLMs → prompt files).

Scripts keep prompt files (under `prompts/` in the script folder) versioned in
the repo so the same LLM call is reproducible. Fill every slot. Delete this
instruction comment.

---
id: <prompt-id — kebab-case, unique in the script>
description: <what this prompt does — when it is used>
model: <provider/model chosen at creation — ask the user now, presenting the current default model per provider (looked up at ask time — current model docs / web search — never a stale list or memory)>
---

<instructions to the model, in order>

- <constraint 1>
- <constraint 2>
- <input contract: what the calling step passes in>
- <output contract: what the caller parses out>
