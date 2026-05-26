# 📘 skillsman User Guide

Welcome to the **skillsman** User Guide. This document provides a complete reference for using `skillsman` to manage, structure, and dynamically switch presets (assemblies) of AI agent skills in your local environment.

---

## 📂 Directory Layout

`skillsman` operates strictly conforming to the cross-platform **XDG Base Directory Specification**, separating user configuration, local machine state, and active linkages.

### 1. Active Projections (Target System Zone)

* **Path**: `~/.agents/skills/`
* **Purpose**: Symbolic links / Windows Directory Junctions are dynamically projected here. AI coding agents (such as Claude Code) read active skills directly from this folder.

### 2. User Configuration (`XDG_CONFIG_HOME`)

* **Path**: `skillsman/presets/`
  * Linux/macOS: `~/.config/skillsman/presets/`
  * Windows: `C:\Users\<user>\AppData\Roaming\skillsman\presets\`
* **Purpose**: User-authored preset markdown files containing YAML frontmatter that define skill assemblies and recursive preset references.

### 3. Local Machine State (`XDG_STATE_HOME`)

* **Path**: `skillsman/state.json`
  * Linux/macOS: `~/.local/state/skillsman/state.json`
  * Windows: `C:\Users\<user>\AppData\Local\skillsman\state.json`
* **Purpose**: Automatically managed state tracking active, always-loaded, and blacklisted presets.

### 4. User Data (`XDG_DATA_HOME`)

* **Path**: `skillsman/skills/`
  * Linux/macOS: `~/.local/share/skillsman/skills/`
  * Windows: `C:\Users\<user>\AppData\Local\skillsman\skills\`
* **Purpose**: Physical source storage containing all your downloaded and developed skills (contains subfolders with `SKILL.md` files).

---

## 🎮 CLI Command Reference

`skillsman` features a powerful, standard CLI based on the modern `commander` library. It maps the global executables `skillsman` and `skills` to `cli.js`, giving you access to both native preset management and delegated original commands.

### Global Option: `-a / --agent <agent...>`

All native preset commands (`collect`, `status`, `use`, `activate`, `deactivate`) accept a global `-a / --agent` flag that restricts the operation to specific AI agents:

```bash
# Single agent
skillsman use dev -a claude-code

# Multiple agents (space-separated in one flag)
skillsman use dev -a replit aider-desk

# Multiple agents (repeated flags)
skillsman use planning -a replit -a codex -a cursor

# Show status only for specific agents
skillsman status -a claude-code cursor

# Collect only from a specific agent directory
skillsman collect -a aider-desk
```

When `-a` is omitted, commands operate on **all agents** present in `state.json` (or all 50+ supported agents for `collect`).

> [!IMPORTANT]
> Agent names must exactly match the `SUPPORTED_AGENTS` registry keys. Passing a comma-joined string (e.g. `-a replit,aider-desk`) is rejected immediately:
> `Error: Invalid agent: replit,aider-desk`

### Supported Agents

The full registry (50+ agents) includes: `default`, `aider-desk`, `amp`, `antigravity`, `augment`, `bob`, `claude-code`, `cline`, `codex`, `command-code`, `continue`, `cursor`, `devin`, `gemini-cli`, `github-copilot`, `goose`, `junie`, `kilo`, `opencode`, `replit`, `roo`, `trae`, `windsurf`, `zencoder`, and many more.


#### `skillsman presets` (alias: `ps`)

Scans the `presets/` folder and lists all available assemblies with their descriptions and unique resolved skill counts (automatically expanding nested dependencies recursively).

* **Visual Indicators**: Highlight colors are applied for standard configurations: the auto-loaded preset `always` in yellow and the blacklist preset `never` in red.

#### `skillsman status`

Outputs the current status of your presets and symlinks:

* Displays active, always-loaded, and blacklisted presets from `state.json`.
* Lists active symbolic links in `skills/` pointing to their physical paths.
* Triggers warnings if a physical directory is found inside `skills/` instead of a symlink.

#### `skillsman collect`

Scans the active directory `~/.agents/skills/` for physical skill folders, migrates them to the local isolated library, automatically generates a corresponding preset file, and replaces the folder with a symbolic link.

> [!NOTE]
> This is a zero-conflict setup and ingestion command. It automatically extracts `name` and `description` from the skill's `SKILL.md` using the frontmatter parser to populate the generated preset.

#### `skillsman use [presets...]` (Absolute & Sync Mode)

* **Absolute Mode**: Cleans the active folder of previous links and activates only the specified presets (e.g., `skills use dev planning`).
* **State Sync Mode**: Calling `skills use` with **no arguments** forces a complete synchronization of active links to match the exact content of `state.json` and preset files. This is extremely useful if you manually edit preset files or modify `state.json` via a text editor.

#### `skillsman activate <presets...>` (Incremental Add)

Adds skills from the specified presets to your current active assembly without affecting other active links.

* *Alternative syntax*: `skillsman use +dev +marketing`

#### `skillsman deactivate <presets...>` (Incremental Remove)

Removes skills from the specified presets from your active assembly.

* *Alternative syntax*: `skillsman use -marketing`

---

### 2. Delegated Original Commands

The following commands are transparently delegated to the official `skills` package, directing all updates and installations straight to the `skillsman` library:

* `skillsman add <package>` — Add a skill package. Automatically triggers a post-install collection hook to move the new skill to the library and generate its preset.
* `skillsman remove [skills...]` — Remove installed skills. Automatically replaces links with temporary physical folders for the duration of the command, and triggers a post-removal cleanup hook to purge folders and presets.
* `skillsman list [args...]` (alias: `ls`) — List installed skills inside the sandboxed library.
* `skillsman update [skills...]` (alias: `upgrade`) — Update installed skills.
* `skillsman find [query]` — Search for skills interactively.
* `skillsman init [name]` — Initialize a new template skill project.
* `skillsman experimental_install` — Restore skills from `skills-lock.json`.
* `skillsman experimental_sync` — Sync skills from `node_modules` into agent directories.

---

## 💎 Deep-Dive into Core Mechanics

### 🔄 Recursive Preset References (`presets:`)

Presets can reference other presets using the `presets:` array in their YAML Frontmatter:

```yaml
---
name: dev-tests
description: "Integration testing preset"
presets:
  - dev
skills:
  - playwright-best-practices
---
```

When activating `dev-tests`, `skillsman` recursively loads skills defined in both `dev-tests` and `dev`.

* 🛡️ **Cycle-Safe DFS Traversal**: Resolving is performed using Depth-First Search with a `visited` Set. Circular references (e.g., Preset A -> Preset B -> Preset A) are resolved instantly and safely without infinite loops or hangs.

### 🤝 Overlapping Preset Conflict Resolution

`skillsman` manages a state machine under the hood using `state.json`. If multiple active presets contain overlapping skills, deactivating one preset **will not** break the links of the other.

For example:

* Preset `planning` contains: `brainstorming`, `grill-me`.
* Preset `dev` contains: `brainstorming`, `generate-custom-instructions`.
* If both `planning` and `dev` are active, `brainstorming` is linked.
* Running `skillsman deactivate planning` will remove `grill-me`, but **will keep `brainstorming` linked** because `dev` is still active and requires it.

### 🚫 Global Blacklisting (`never.md` priority)

If a preset named `never.md` exists, any skill listed in it is strictly forbidden from being linked.

* ⚡ **Processing Priority**: Blacklisting is applied as a final filtering step *after* the recursive preset expansion of active and always-active presets has been completed.
* 🎯 **Direct Exclusion Only**: Only skills directly and explicitly listed inside the `never` preset are excluded (it is parsed flatly without any recursive traversal of nested presets).
* **CLI Warnings**: The CLI will warn you if a blacklisted skill was requested:
    `⚠ Skipped blacklisted skill: "seo" (defined in neverPresets)`

### 🤖 Multi-Agent `state.json` Structure

`state.json` is keyed by the **canonical agent config key** (not always the agent name you type — aliases are resolved). Each key tracks its own independent preset configuration:

```json
{
  "default": {
    "activePresets": ["dev"],
    "alwaysPresets": ["always"],
    "neverPresets": ["never"]
  },
  "aider-desk": {
    "activePresets": ["planning"],
    "alwaysPresets": ["always"],
    "neverPresets": ["never"]
  },
  "config_agents": {
    "activePresets": ["dev", "planning"],
    "alwaysPresets": ["always"],
    "neverPresets": ["never"]
  }
}
```

> [!NOTE]
> Several agents share the same physical directory and therefore the same config key. For example `replit`, `amp`, `kimi-cli`, and `universal` all map to `config_agents` (`.config/agents/skills/`). Activating a preset on any of them updates the shared key.
