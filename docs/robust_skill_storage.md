# 📦 Robust Skill Storage

This document outlines the architectural design, requirements, and edge-case resolution patterns for standardizing physical skill storage and environment isolation when delegating commands to the official `skills` CLI.

## 🎯 1. Core Objectives

## 🏗️ 2. Architectural

## 🤝 3. Junctions vs Symbolic Links (Windows)

On Windows, standard symbolic links (`symlink`) require the `SeCreateSymbolicLinkPrivilege` privilege (typically limited to Administrator accounts). To achieve zero-setup execution:

1. **Junctions Only**: Always use `junction` as the third parameter to `fs.symlinkSync(target, path, 'junction')`.
2. **Absolute Resolution**: Windows Directory Junctions *must* point to absolute, resolved target paths. Relative paths will result in broken links.
3. **Real Path Handling**: Always resolve targets using a custom `safeRealpath()` parser to prevent double-resolution issues across drives mapped via `subst` or network shares.

## 🔄 4. Detailed Command Execution & Hook Scenarios

### Scenario A: Adding a Skill (`skillsman add <pkg>`)

### Scenario B: Removing a Skill (`skillsman remove <skill>`)

## 🧪 5. Testing & Validation Scenarios

To verify that the storage rules remain resilient, the following integration tests are executed natively via `node:test`:

1. **Sandbox Path Isolation Test**:
   * Mock `process.env` properties.
   * Assert that delegating to `skills` writes files *only* within the temporary sandbox path and never touches the user's active home profile (`~/.agents`).
2. **Windows Path-Junction Verification**:
   * Assert that creating a junction to a mock skill on Windows does not trigger `EPERM` (Permission Denied).
   * Validate that `fs.lstatSync().isSymbolicLink()` returns `true` and the junction destination points correctly to the resolved library path.
3. **Stale Preset Purge Test**:
   * Trigger `delegateToSkills('remove', ['mock-skill'])`.
   * Assert that `mock-skill.md` no longer exists in `presets/` and the junction is completely removed.
