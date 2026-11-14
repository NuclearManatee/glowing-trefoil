---
title: Check Script Forge workspace health
description: Check the Script Forge environment and project health — Node runtime, engines.node, dependencies, .env presence, folder layout, ESLint config, and git state.
argument-hint: "[directory]"
---

# Script Forge doctor

Health check for the Script Forge environment and the current (or given)
project. The CLI checks the Node runtime and minimum version, the project
manifest, declared and installed dependencies, `.env` presence only, the
workspace layout, the project-local ESLint config, and git state.

## 1. Run the CLI

{{invocation}}

## 2. Report

- Exit 0: healthy — summarize the SUMMARY line. Warnings are still worth
  mentioning.
- Exit 2: one or more failures — report each `[FAIL]` line and its suggested
  fix. Do not auto-install or rewrite files without consent.
- Exit 1: user/input problem; report the message.
- Exit 3: an external command failed; report its output.
- Exit 4: unexpected internal error; report it verbatim.
- Exit 130: interrupted.

Pass the CLI output through faithfully; do not invent checks it did not run.
