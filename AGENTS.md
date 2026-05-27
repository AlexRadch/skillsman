# AGENTS.md

This file provides critical guidance and architectural instructions for AI coding agents working on the `skillsman` codebase.

---

## 🗺️ Documentation Navigation

Before making changes or implementing features, refer to the dedicated guides instead of duplicating technical specs:

* **High-Level Concept & Quick Start**: Read [**`README.md`**](README.md). Use this to understand the Unified CLI wrap concept, installation patterns, and standard usage.
* **CLI Behaviors & Core Mechanics**: Read [**`docs/user_guide.md`**](docs/user_guide.md). Use this when adding commands, changing preset sync behaviors, DFS cycle resolution logic, conflict overrides, or `never.md` flat-blacklist rules.
* **Local Development & Programmatic API**: Read [**`docs/developer_guide.md`**](docs/developer_guide.md). Use this when modifying internal paths, changing mock environments for tests, updating package dependencies, or writing new unit/integration tests.

---

## 🗿 Communication Style: Caveman Mode

This project uses the **caveman** skill. All AI agents working on this codebase **must** activate it and follow its rules throughout the entire session.

* Read and apply the `caveman` skill instructions before responding.
* Keep responses short and direct — drop filler words, pleasantries, and redundant explanations.
* Communicate only technical substance. No "Great question!", no "Sure, I can help with that!".

---

## 🏗️ Codebase Rules for AI Agents

Full coding conventions are documented in [**`docs/developer_guide.md`**](docs/developer_guide.md). Key constraints:

### 1. Zero Build-Step Type Safety

* Every JS file uses `// @ts-check`. Annotate all new/modified functions with JSDoc.
* Ensure the IDE has zero TypeScript warnings before finishing your turn.
* Do **not** install transpilers (`tsc`, `ts-node`, `esbuild`, `tsx`).

### 2. Subprocess Delegation without `npx`

* Never execute `npx skills` at runtime.
* Resolve the `skills` binary via `require.resolve('skills/package.json')` and spawn `node` directly.
* Keep `skills` as a production dependency in `package.json`.

### 3. Safe Error Catching

* `catch (err)` is typed `unknown` under `// @ts-check`. Never read `.message` directly.
* Use: `err instanceof Error ? err.message : String(err)`

### 4. Testing & Sandbox Protection

* Use `node:test` + `node:assert`. No third-party test frameworks.
* Call `setTestEnv` in test hooks. Never touch `~/.agents/skills/` in tests.

### 5. Prioritize Native Library APIs over Workarounds

* **Mandatory Documentation Check**: Before proposing or writing custom arguments preprocessing, helper wrappers, or workaround implementations, the AI agent **MUST** thoroughly read and analyze the official documentation/API specification of the library in use (e.g., `commander`).
* Always prefer native features (such as Commander's Variadic Options) over custom scripting code.

### 6. Version Bumps & Releases

* **Changelog Validation**: Before recommending, executing, or automating any `npm version` bump, the agent **MUST** ensure the `CHANGELOG.md` is fully populated with a comprehensive summary description and detailed `### Added`/`### Changed`/`### Fixed` sections.
* **Never** leave version sections empty in `CHANGELOG.md`.
* **User-Facing Changes Only**: Document only user-facing features, bug fixes, configuration additions, and API/CLI changes. **Never** include internal developer instructions, changes to `AGENTS.md`, or test-suite setup modifications in the public `CHANGELOG.md`.
* Always remind the user to update the changelog details first before performing a version increment.

---

## 🚀 Common Developer Commands

```bash
npm test                               # Run full test suite
node --test --watch                    # Watch mode
node --test --experimental-test-coverage  # Coverage report
```
