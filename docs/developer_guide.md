# 💻 skillsman Developer Guide

Welcome to the **skillsman** Developer Guide. This document is intended for developers who wish to understand the codebase, modify the functionality, or run and write tests for `skillsman`.

---

## 🛠️ Local Development Setup

To configure `skillsman` for local development:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/youruser/skillsman.git
    cd skillsman
    ```
2.  **Install dependencies**:
    `skillsman` relies on the robust `gray-matter` package for frontmatter parsing and `commander` for command-line options parsing:
    ```bash
    npm install
    ```
3.  **Global package linking**:
    To test the globally linked CLI command locally:
    ```bash
    npm link
    ```
    This registers the `skillsman` executable command in your system shell pointing directly to your local development codebase folder.

---

## 🏗️ Codebase Architecture

The core of `skillsman` is contained within a single main file: [**`index.js`**](file:///c:/AProj/skillsman/index.js).

### Key Functions
*   `resolveFinalSkills(state)`: Implements the DFS (Depth-First Search) preset tree traversal, processes the `always` and `active` candidates, and filters out the non-recursive `never` blacklisted skills.
*   `syncState()`: Core synchronization routine. Scans the current symbolic links in `~/.agents/skills/`, unlinks obsolete ones, and creates missing symbolic links (using standard Unix symlinks or Windows Directory Junctions) to point to the source library.
*   `init()`: Recreates folder structures and migrates folders safely using verification steps (`fs.cpSync` + size check + `fs.rmSync`).
*   `parseFrontmatter(content)`: Integrates `gray-matter` to parse markdown frontmatter safely.
*   `setTestEnv(sandboxPath)`: Overrides standard home directory directories (e.g. `~/.agents`) to point to a sandbox directory during testing.

### Programmatic Exports
When imported as a module (e.g., `const skillsman = require('./index')`), the script exports all utility functions and a `getPaths()` method. This enables complete programmatic testing of the core state, parsers, and resolvers without starting shell commands.

---

## 🧪 Testing Architecture (`node:test`)

`skillsman` utilizes the modern, built-in **Node.js Native Test Runner** (`node:test` and `node:assert`). 

### File Structure
```text
tests/
├── unit/
│   ├── frontmatter.test.js  # Unit tests for the gray-matter parser
│   └── resolver.test.js     # Unit tests for recursive DFS resolving and cycle safety
└── integration/
    └── cli.test.js          # Subprocess CLI integration and command routing tests
```

### Sandbox Protection
All tests are completely safe and isolated. They use `setTestEnv` to route all folder structures into local temporary sandbox directories:
*   `tests/sandbox-unit/`
*   `tests/sandbox-integration/`

These sandboxes are created on startup (using `before()` hooks) and strictly destroyed upon completion (using `after()` hooks), leaving **zero impact** on your live `~/.agents` workspace folder!

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
