# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.4.1] - 2026-05-27

This patch release updates documentation, backporting comprehensive release note summaries and changelog details for versions 0.1.2 through 0.4.0, and updates the roadmap with smart preset auto-creation and AI agent integration targets.

### Changed

- **Roadmap Update**: Added `Smart Preset Auto-Creation` and `Dedicated skillsman Skill for AI Agents` as active short-term goals.
- **Changelog Enrichment**: Backfilled missing release summaries and detailed change entries for all historical releases to maintain precise documentation history.

## [0.4.0] - 2026-05-27

This release introduces project-level workspace isolation and local preset management, enabling developer environments to define project-specific active, always-loaded, and blacklisted preset states with automatic global XDG fallback and an explicit `-g/--global` override.

### Added

- **Workspace-Level Preset Isolation**: Implemented local `.agents/skillsman-state.json` parsing and loading to track active, always-loaded, and never-loaded presets independently for each project/workspace.
- **Hybrid Global/Local Scope**: Retains user-wide presets in the global XDG configuration directories while targeting and projecting active skills inside the local workspace.
- **Automatic XDG State Fallback**: Configured dynamic fallback behavior where `skillsman` seamlessly reads and modifies global XDG configurations if no local project state is present.
- **On-Demand Local Setup**: Enabled zero-setup workspace initialization where the `.agents/` folder and local state file are created automatically upon executing state changes (e.g. `skillsman use`).
- **Global Override Flag**: Added a native `--global`/`-g` command line option allowing operations to bypass the local workspace environment and directly configure global settings.

## [0.3.0] - 2026-05-26

This release introduces global multi-agent orchestration, transitioning internal state architecture to track and synchronize presets independently across 50+ supported AI agent directories with a native variadic `--agent` option and strict agent key validation.

### Added

- **Global Multi-Agent Support**: Transitioned the layout of `state.json` to an isolated multi-agent format. Commands dynamically target specific agents, managing active presets and symlinks independently per agent.
- **Commander `--agent` option**: Introduced `-a, --agent <agent...>` native Commander variadic option in `cli.js` supporting space-separated lists and repeated flags (`-a replit aider-desk -a universal`), matching the original utility.
- **Dynamic Multi-Agent Actions**: Overhauled `usePresets()`, `syncState()`, `collect()`, and `showStatus()` to run dynamically based on targeted agents or globally across all 50+ configured agent directories.
- **Cleaned Public API**: Completely encapsulated low-level `syncState` and testing helpers into the private `tests` namespace in `index.js`, keeping the main exported API lightweight and focused on standard user commands.
- **Agent Key Validation**: `collect()`, `showStatus()`, and `usePresets()` now validate every supplied `-a` agent key against the `SUPPORTED_AGENTS` registry. An unrecognised key (including comma-joined strings such as `replit,aider-desk`) immediately prints `Error: Invalid agent: <agent>` to stderr and exits with code 1.

## [0.2.0] - 2026-05-26

This release decouples the programmatic API from the command-line interface, introducing a unified `skills` / `skillsman` entry point, self-healing global command shims, and sandbox-redirected package-manager execution under XDG state paths.

### Added

- **Modular API / CLI Separation**: Refactored `index.js` into a lightweight, pure programmatic API. Removed all `commander` imports and CLI logic, making `require('skillsman')` extremely fast and clean of console artifacts.
- **Unified skills / skillsman CLI**: Created `cli.js` as the new unified executable entry point, mapping both global commands (`skills` and `skillsman`) to it, supercharging the standard `skills` tool with native preset management out-of-the-box.
- **Self-Healing Global Shims**: Integrated a lightweight 1.5ms check (`ensureSkillsLink`) run on every CLI execution. Automatically detects if the global `skills` command was overwritten by another installation and restores it programmatically (cross-platform, zero-privilege on Windows).
- **Environment & Path Redirection**: Configured delegated package-manager commands (`add`, `remove`, `update`, `find`, `list`, `init` for templates, etc.) to execute under sandboxed `XDG_STATE_HOME` and `XDG_DATA_HOME` environment variables, redirecting all operations seamlessly straight to `skillsman`'s local library.
- **Automatic Ingestion & Preset Hooks (`skills collect`)**: Replaced `init` (for environment setup) with a unified `collect` command. It scans `~/.agents/skills/` for physical directories, migrates them to the library, generates a corresponding preset on-the-fly (parsing metadata from `SKILL.md` using `gray-matter`), and creates Directory Junctions.
- **Auto-Preset and Clean-up Hooks**: Configured automatic hook post-processing that creates preset markdown files after successful `skills add` installations, and purges orphaned library folders and preset files after `skills remove`.
- **Renamed Overlapping Commands**: Renamed preset listing `list`/`ls` to `presets` (alias `ps`), and environment setup `init` to `collect`, keeping `init` reserved exclusively for initializing new skill project templates.

## [0.1.2] - 2026-05-25

This minor release establishes secure packaging and distribution mechanisms, utilizing OIDC Trusted Publishing and automated provenance attestations to guarantee verified supply chain security on npmjs.com.

### Added

- **Security & Delivery Infrastructure**: Migrated package publishing to passwordless OIDC Trusted Publishing with automated provenance attestations for verified supply chain security on npmjs.com, and unified CI/CD release workflows.

## [0.1.1] - 2026-05-24

This is the initial development preview release of `skillsman` — a modern, zero-dependency Node.js CLI utility designed to structure, manage, and dynamically swap presets of portable AI Agent Skills.

### Added

- **Dynamic Preset State Machine**: Implemented robust state tracking via `state.json` to manage `activePresets`, `alwaysPresets`, and `neverPresets` profiles.
- **Cycle-Safe Preset Resolver**: Designed a Depth-First Search (DFS) preset tree expansion with a `visited` Set to gracefully resolve nested preset connections and prevent infinite loops.
- **Built-In Conflict Overrides**: Engineered overlapping preset conflict resolution to preserve linked skills when multiple active presets share identical skill names.
- **Global Blacklist Priority**: Implemented flat priority blacklisting via the designated `never.md` preset, filtering out forbidden skills at the final stage of projection.
- **Safe Environment Initialization**: Created `skillsman init` to generate standardized directory trees (`~/.agents`) and perform copy-and-verify physical skills migrations.
- **Declarative CLI**: Migrated parameters parsing to the industry-standard `commander` library, providing automated validation, aliases, and clean Spec help output.
- **Modern Test Suite**: Created a fully automated, sandbox-isolated test suite leveraging **Node.js Native Test Runner** (`node:test` + `node:assert`) covering BDD-style unit, integration, and CLI subprocess edge cases.
- **Single Source of Truth Metadata**: Configured the CLI to dynamically bind the program name, version, and description directly to `package.json` configurations.
- **CI/CD Automation**: Integrated a unified, multi-OS GitHub Actions test suite and a reusable publish workflow to automatically test and deploy to the `npm` registry upon release.
- **Auto-Release Pipeline**: Created a tag-triggered GitHub workflow and custom Node.js script to extract release notes and automatically generate a formal GitHub Release on push.
- **Lifecycle Version Hook**: Implemented automated versioning and changelog dating via the native `npm version` hook.
- **NPM Package Polish**: Configured `package.json` with a robust files whitelist and an extensive, alphabetically-sorted set of 55 discoverability keywords covering the entire AI agent IDE ecosystem.
- **Clean Git Integration**: Configured automatic ignoring of temporary test sandboxes in `.gitignore` to prevent workspace clutter during test execution.
- **Modular Documentation**: Refactored the codebase documentation layout into a clean high-level `README.md`, an exhaustive `docs/user_guide.md`, and a targeted `docs/developer_guide.md`.
