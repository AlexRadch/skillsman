# 📋 skillsman TODO / Technical Debt

This document tracks internal technical debt, bug fixes, refactoring tasks, and development debt that do not represent new user features but rather code improvements.

---

## 🐛 High-Priority / Bug Fixes

### 1. 🛡️ Robust YAML Frontmatter Syntax Errors

* **Current Behavior**: Under the hood, `gray-matter` throws errors with detailed location info (line, column, reason) when YAML is malformed. Currently, `skillsman` catches this silently, shows a generic warning `Warning: Failed to parse frontmatter`, and proceeds with an empty preset.
* **Todo**: Stop silencing `gray-matter` parsing errors. Show detailed error output and terminate with `process.exit(1)`.

### 2. 🛡️ Preset Object Structural Validation

* **Current Behavior**: Once parsed, the resulting JavaScript objects are not verified for correct structures. For example, if a preset defines `skills` as a number (`skills: 123`) or a string instead of an array, it causes silent failures.
* **Todo**: Implement strong validation on the parsed JS object schema (ensure `skills` and `presets` fields are arrays of strings). Print useful field errors and terminate with `process.exit(1)`.

---

## 🛠️ Refactoring & Code Quality

### 1. ⚙️ Centralize Error Terminations

* **Todo**: Create a unified CLI error handling utility that wraps standard exits and formats ANSI colored red outputs uniformly.
