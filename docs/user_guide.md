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

`skillsman` features a powerful, standard CLI based on the modern `commander` library.

### 1. `skillsman init`

Initializes the respective XDG base directories for config, state, and data (presets, state.json, and source library folders).

### 2. `skillsman list` (alias: `ls`)

Scans the `presets/` folder and lists all available assemblies with their description and unique skill count (which automatically resolves recursive dependencies).

* **Visual Indicators**: Automatically highlights the background auto-loaded preset `always` in yellow and the blacklist preset `never` in red.

### 3. `skillsman status`

Outputs the current status of your presets and symlinks:

* Displays active, always-loaded, and blacklisted presets from `state.json`.
* Lists active symbolic links in `skills/` pointing to their physical paths.
* Triggers warnings if a physical directory is found inside `skills/` instead of a symlink.

### 4. `skillsman use [presets...]` (Absolute & Sync Mode)

* **Absolute Mode**: Cleans the active folder of previous links and activates only the specified presets (e.g., `skillsman use dev planning`).
* **State Sync Mode**: Calling `skillsman use` with **no arguments** forces a complete synchronization of active links to match the exact content of `state.json` and preset files. This is extremely useful if you manually edit preset files or modify `state.json` via a text editor.

### 5. `skillsman activate <presets...>` (Incremental Add)

Adds skills from the specified presets to your current active assembly without affecting other active links.

* *Alternative syntax*: `skillsman use +dev +marketing`

### 6. `skillsman deactivate <presets...>` (Incremental Remove)

Removes skills from the specified presets from your active assembly.

* *Alternative syntax*: `skillsman use -marketing`

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

---

## 📝 Best Practices on Preset Authoring

1. **Semantic Naming**: Name your preset markdown files exactly as the name specified in the frontmatter (e.g., `dev.md` with `name: dev`).
2. **Keep `always.md` Light**: Use `always.md` only for skills that are absolute prerequisites for all your workflows (e.g., terminal utilities, basic agents), as they are loaded in the background for every command.
3. **Modular Presets**: Instead of creating one giant preset, split your skills into small, specialized presets (e.g., `react`, `jest`, `accessibility`) and reference them using `presets:` arrays to build larger assemblies.
