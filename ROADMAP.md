# 🗺️ skillsman Roadmap

This document outlines the planned features, enhancements, and architectural milestones for **skillsman**.

---

## 🎯 Short-Term Goals (v0+)

### 1. 🪄 Smart Preset Auto-Creation

* Implement automatic intelligent preset creation. Analyze workspace structure or guide the user interactively to simplify preset setups.

### 2. 🤖 Dedicated skillsman Skill for AI Agents

* Create a native `skillsman` skill to instruct AI agents on how to use `skillsman` to configure and activate presets automatically on user demand.

### 3. 📂 Local (Project) Presets Support

* Add support for local project-specific presets inside `.skillsman/presets/` that can overlay or extend global presets.

### 4. 📦 Robust Skill Storage for Delegated CLIs

* Standardize storage structures and environment overrides (`HOME`, `USERPROFILE`, XDG paths) to ensure perfect compatibility when executing the official `skills` CLI across different terminal environments, node versions, and package managers. See [Robust Skill Storage Spec](docs/robust_skill_storage.md) for full design.

---

## 🚀 Medium-Term Goals (v1+)

### 1. ⌨️ Shell Auto-Completion

* Implement tab-completion for `skillsman use`, `activate`, and `deactivate` commands.
* Support shell profiles:
  * **Bash** (`~/.bashrc`)
  * **Zsh** (`~/.zshrc`)
  * **PowerShell** (Windows profile script)

### 2. 🔌 Refined Programmatic API

* Clean up the exported API surface, standardizing the public namespace while grouping test/debug functions inside a nested module space.

---

## 🌌 Long-Term Goals (v2+)

### 1. ⚡ Hot-Reloading daemon

* Optional background worker watching active directories and dynamically rebuilding links/projections on-the-fly without manual execution of `skillsman use`.

### 2. 🔍 Interactive Preset Selection (TUI)

* Add an interactive menu using simple ANSI escapes or lightweight CLI prompt prompts to toggle active presets visually.
* Command signature: `skillsman interactive` (or `skillsman ui`).

### 3. 🧪 Testing & Coverage

* Reach **100% code coverage** in native Node.js tests (`node:test`).
* Add automated Windows CI runs to verify directory junctions behaviour.

### 4. 📥 Automatic Missing Skill Installation

* Automatically detect when a preset requires skills that are missing from the local library.
* Automatically download and install missing skill packages via the delegated installation command.

### 5. ⚙️ Workspace Isolation (Research Phase vX+)

* Introduce local project configurations (e.g. `.skillsman` file) to automatically load project-specific skills.
* **Architectural Challenge (High Complexity)**:
  * Overriding global environment variables (`HOME` / `USERPROFILE`) is highly hazardous as it breaks standard utilities like `ssh`, `git`, and `npm` for all nested spawns.
  * Running multiple IDEs/agents (e.g. Cursor, VS Code with Cline) concurrently in different projects creates race conditions over the shared `~/.agents/skills` directory.
* **Proposed Concept**:
  * Implement Node.js-level monkey-patching via a lightweight preload hook (`node -r` / `NODE_OPTIONS`) to dynamically intercept `os.homedir()` or `fs` file operations specifically and only inside the agent process, keeping the host shell environment intact.

---

## ✅ Completed

### 📁 Workspace & Project-Level Skills

* Enable local project-level state management and workspace isolation:
  * Local state file `.agents/skillsman-state.json` tracks active, always-loaded, and blacklisted presets at the local project level.
  * Presets remain global (stored in XDG configuration directory) for seamless sharing.
  * Synchronizes active local projections (`.agents/skills/`, etc.) relative to the local project workspace's state.
  * Implemented automatic dynamic fallback loading: if the local project-level state file is absent, `skillsman` falls back to loading the global XDG state.
  * On-demand creation: The `.agents/` folder and `skillsman-state.json` are automatically created on the fly when saving state changes (e.g. running `skillsman use <presets>`), eliminating the need for manual initialization commands.

### 🎯 Target Specific Agents (Project Level)

* Support targeting specific agents (e.g., `claude-code`, `codex`) at the local project/workspace level via `.agents/skillsman-state.json`.

### 🤖 Target Specific Agents (Global Level)

* Implemented `-a, --agent <agent...>` global Commander option (variadic, space-separated or repeated flags).
* `SUPPORTED_AGENTS` registry covers 50+ agents mapped to their canonical XDG skill directories.
* `state.json` transitioned to per-agent multi-agent structure; each agent tracks its own `activePresets`, `alwaysPresets`, and `neverPresets` independently.
* `collect()`, `showStatus()`, and `usePresets()` target specific agents when `-a` is provided, or operate globally across all agents otherwise.
* Agent key validation: passing an unrecognised agent name (including comma-joined strings like `replit,aider-desk`) prints `Error: Invalid agent: <agent>` to stderr and exits with code 1.
