# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.1.2] - 2026-05-25

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
