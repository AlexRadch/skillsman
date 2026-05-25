# 💻 skillsman Developer Guide

Welcome to the **skillsman** Developer Guide. This document is intended for developers who wish to understand the codebase, modify the functionality, or run and write tests for `skillsman`.

---

## 🛠️ Local Development Setup

To configure `skillsman` for local development:

1. **Clone the repository**:

    ```bash
    git clone https://github.com/AlexRadch/skillsman.git
    cd skillsman
    ```

2. **Install dependencies**:
    `skillsman` relies on `gray-matter` for frontmatter parsing, `commander` for command-line parsing, and the official `skills` package as a production dependency for seamless delegated execution:

    ```bash
    npm install
    ```

3. **Global package linking**:
    To test the globally linked CLI command locally:

    ```bash
    npm link
    ```

    This registers the `skillsman`, `skills`, and `add-skill` executable commands in your system shell, pointing directly to your local development codebase.

---

## 🏗️ Codebase Architecture

The core of `skillsman` is structured into two focused files:

### 1. [`cli.js`](../cli.js) (CLI Entry Point)

Handles the command-line setup, Commander command registration, argument passing, and global shim management:

* **Self-Healing Link check (`ensureSkillsLink`)**: A 1.5ms check executed on startup to ensure global shims point to `skillsman`'s entry point.
* **CLI Routing**: Resolves, validates, and forwards arguments cleanly to the programmatic API.

### 2. [`index.js`](../index.js) (Programmatic API)

The core logical module of the manager, containing:

* **XDG Path Resolution**: `getXdgConfigHome()`, `getXdgStateHome()`, `getXdgDataHome()` resolve standard paths on Linux, macOS, and Windows.
* **DFS Resolver**: `resolveFinalSkills(state)` implements recursive Depth-First Search tree traversal to expand nested presets and filter out blacklisted ones.
* **Projection Linker**: `syncState()` synchronizes symbolic links / Windows Directory Junctions inside `~/.agents/skills/` to match `state.json`.
* **Ingestion Engine**: `collect()` scans, migrates physical folders, generates markdown presets on-the-fly, and links folders back.
* **Subprocess Delegation**: `delegateToSkillsCLI(command, args)` resolves the physical file path of the nested `skills` package dependency and directly executes it via Node (`spawnSync`), setting sandboxed environment variables for environment redirection.

---

## 🛡️ Static Type Checking (JSDoc + `// @ts-check`)

`skillsman` achieves **100% type safety and IDE autocomplete** with **zero build-step overhead** by leveraging JSDoc comments and the `// @ts-check` directive.

* **No Compiler Needed**: Pure JavaScript files are verified by the IDE's built-in TypeScript engine.
* **Instant Startups**: Eliminates slower transpile times (e.g. `ts-node`), maintaining a cold start time under **5ms**.
* **JSDoc Specifications**: All functions are annotated with explicit parameter and return types:

  ```javascript
  /**
   * Resolves the final set of skills based on the state.
   * @param {{ activePresets: string[], alwaysPresets: string[], neverPresets: string[] }} state - The state object
   * @returns {{ finalSkills: Set<string>, forbiddenSkills: Set<string> }} Resolved final and forbidden sets
   */
  ```

---

## ⚙️ Coding Conventions

### Subprocess Delegation without `npx`

`skillsman` never invokes `npx skills` at runtime. Instead, the physical path of the bundled `skills` package is resolved via `require.resolve('skills/package.json')` and executed directly by Node:

```javascript
const skillsPkgPath = require.resolve('skills/package.json');
const skillsBinPath = path.join(path.dirname(skillsPkgPath), 'path/to/bin');
spawnSync(process.execPath, [skillsBinPath, ...args], { stdio: 'inherit' });
```

This avoids shell and network overhead entirely. The `skills` package is kept as a **production dependency** in `package.json` to guarantee resolution.

### Safe Error Catching

With `// @ts-check` enabled, `catch (err)` variables are typed as `unknown`. Never access `.message` directly — always guard with an `instanceof` check:

```javascript
try {
  // ...
} catch (err) {
  console.error('Error:', err instanceof Error ? err.message : String(err));
}
```

---

## 🧪 Testing Architecture (`node:test`)

`skillsman` utilizes the modern, built-in **Node.js Native Test Runner** (`node:test` and `node:assert`).

### File Structure

```text
tests/
├── unit/
│   ├── frontmatter.test.js  # Unit tests for the gray-matter parser
│   ├── paths.test.js        # Unit tests for the XDG path resolution helpers
│   └── resolver.test.js     # Unit tests for recursive DFS resolving and cycle safety
└── integration/
    ├── cli.test.js          # Subprocess CLI integration and command routing tests
    └── cli.skills.test.js   # Isolated delegated skills commands integration tests
```

### Sandbox Protection

All tests are completely safe and isolated. They use `setTestEnv` to route all folder structures into local temporary sandbox directories:

* `tests/sandbox-unit/`
* `tests/sandbox-integration/`

These sandboxes are strictly created on startup and destroyed upon completion, leaving **zero impact** on your live profile.

### Running the Test Suite

#### 1. Standard Run

To run all test suites and output standard Spec results:

```bash
npm test
```

#### 2. Interactive Watch Mode

To run the tests in watch mode (natively re-runs tests instantly upon saving any codebase files):

```bash
node --test --watch
```

#### 3. Code Coverage Report

To calculate code coverage using Node's native coverage engine:

```bash
node --test --experimental-test-coverage
```
