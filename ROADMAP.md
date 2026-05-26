# 🗺️ skillsman Roadmap

This document outlines the planned features, enhancements, and architectural milestones for **skillsman**.

---

## 🎯 Short-Term Goals (v0+)

* *Planning in progress (minor fixes, stabilization)*

---

## 🚀 Medium-Term Goals (v1+)

### 1. ⌨️ Shell Auto-Completion

* Implement tab-completion for `skillsman use`, `activate`, and `deactivate` commands.
* Support shell profiles:
  * **Bash** (`~/.bashrc`)
  * **Zsh** (`~/.zshrc`)
  * **PowerShell** (Windows profile script)

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
