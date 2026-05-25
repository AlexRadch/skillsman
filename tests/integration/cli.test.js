const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { setTestEnv, collect, usePresets, syncState, loadState, saveState, getPaths } = require('../../index');

describe('CLI Integration Tests', () => {
  const realTestsDir = fs.realpathSync(path.join(__dirname, '..'));
  const sandboxPath = path.join(realTestsDir, 'sandbox-integration');
  let paths;

  before(() => {
    if (!fs.existsSync(sandboxPath)) {
      fs.mkdirSync(sandboxPath, { recursive: true });
    }
    setTestEnv(sandboxPath);
    paths = getPaths();
  });

  after(() => {
    try {
      fs.rmSync(sandboxPath, { recursive: true, force: true });
    } catch (e) {}
  });

  it('1. should initialize the environment folders and state file successfully', () => {
    collect();

    // Verify target structure
    assert.ok(fs.existsSync(paths.LIBRARY_DIR));
    assert.ok(fs.existsSync(paths.PRESETS_DIR));
    assert.ok(fs.existsSync(paths.STATE_FILE));

    // Populate the sandboxed source library directly for subsequent tests
    fs.mkdirSync(path.join(paths.LIBRARY_DIR, 'test-skill-1'), { recursive: true });
    fs.writeFileSync(path.join(paths.LIBRARY_DIR, 'test-skill-1', 'instruction.txt'), 'content', 'utf8');

    fs.mkdirSync(path.join(paths.LIBRARY_DIR, 'test-skill-2'), { recursive: true });
    fs.writeFileSync(path.join(paths.LIBRARY_DIR, 'test-skill-2', 'instruction.txt'), 'content', 'utf8');
  });

  it('2. should apply presets in Absolute Mode, merging "always" and excluding blacklisted skills', () => {
    // Add always-skill to library so it can be linked
    fs.mkdirSync(path.join(paths.LIBRARY_DIR, 'always-skill'), { recursive: true });
    
    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'presetA.md'), `---
name: presetA
skills:
  - test-skill-1
  - test-skill-2
---`, 'utf8');

    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'presetB.md'), `---
name: presetB
skills:
  - test-skill-2
---`, 'utf8');

    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'always.md'), `---
name: always
skills:
  - always-skill
---`, 'utf8');

    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'never.md'), `---
name: never
skills:
  - test-skill-2
---`, 'utf8');

    usePresets(['presetA']);

    // Check links
    assert.ok(fs.existsSync(path.join(paths.SKILLS_DIR, 'always-skill')));
    assert.ok(fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-1')));
    assert.ok(!fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-2'))); // Blacklisted!

    // Verify State.json was updated
    let state = loadState();
    assert.deepStrictEqual(state.activePresets, ['presetA']);
  });

  it('3. should support incremental activation without linking blacklisted skills', () => {
    usePresets(['+presetB']);
    
    let state = loadState();
    assert.deepStrictEqual(state.activePresets, ['presetA', 'presetB']);
    assert.ok(!fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-2'))); // Still blacklisted!
  });

  it('4. should support incremental deactivation and keep "always" presets links intact', () => {
    usePresets(['-presetA']);

    let state = loadState();
    assert.deepStrictEqual(state.activePresets, ['presetB']);
    assert.ok(!fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-1'))); // Removed!
    assert.ok(fs.existsSync(path.join(paths.SKILLS_DIR, 'always-skill'))); // Always stays!
  });

  it('5. should synchronize successfully when blacklist is cleared', () => {
    let state = loadState();
    state.neverPresets = [];
    saveState(state);

    // Call syncState directly to force a sync with current state
    syncState();

    // Now test-skill-2 is NOT blacklisted anymore! It should exist!
    assert.ok(fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-2')));
  });

  it('6. should sync correctly when state.json is modified manually followed by syncState()', () => {
    let state = loadState();
    state.activePresets = ['presetA', 'presetB'];
    saveState(state);

    // Call syncState() to trigger sync
    syncState();

    // Now test-skill-1 should be linked again!
    assert.ok(fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-1')));
  });

  it('7. should output structured commander CLI help text via subprocess --help flag', () => {
    const cliPath = path.join(__dirname, '..', '..', 'cli.js');
    const helpOutput = execSync(`node "${cliPath}" --help`, { encoding: 'utf8' });
    assert.ok(helpOutput.includes('Usage: skillsman'));
    assert.ok(helpOutput.includes('CLI manager for AI agent skills presets'));
    assert.ok(helpOutput.includes('collect'));
    assert.ok(helpOutput.includes('presets'));
    assert.ok(helpOutput.includes('status'));
    assert.ok(helpOutput.includes('use'));
  });

  it('8. should fallback to output help when run with no arguments', () => {
    const cliPath = path.join(__dirname, '..', '..', 'cli.js');
    const noArgsOutput = execSync(`node "${cliPath}"`, { encoding: 'utf8' });
    assert.ok(noArgsOutput.includes('Usage: skillsman'));
  });

  it('9. should exit with exit code 1 for invalid/unknown CLI commands', () => {
    const cliPath = path.join(__dirname, '..', '..', 'cli.js');
    try {
      execSync(`node "${cliPath}" invalidcommand`, { stdio: 'pipe' });
      assert.fail('Should have failed with a non-zero exit status for invalid command');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      const stderr = err.stderr.toString();
      assert.ok(stderr.includes("error: unknown command") || stderr.includes("invalidcommand"));
    }
  });

  it('10. should output an error warning if a preset requires a skill not present in the physical library', () => {
    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'missingPreset.md'), `---
name: missingPreset
skills:
  - non-existent-skill
---`, 'utf8');

    let state = loadState();
    state.activePresets = ['missingPreset'];
    saveState(state);

    let output = '';
    const originalConsoleError = console.error;
    console.error = (msg) => { output += msg; };

    try {
      syncState();
    } finally {
      console.error = originalConsoleError;
    }

    assert.ok(output.includes('Error: Skill "non-existent-skill" is not found in library directory'));
  });

  it('11. should output a warning if a blacklisted never-preset skill remains physically present as a folder in active zone', () => {
    let state = loadState();
    state.activePresets = ['presetB'];
    state.neverPresets = ['never'];
    saveState(state);

    const activeSkill2Path = path.join(paths.SKILLS_DIR, 'test-skill-2');
    if (fs.existsSync(activeSkill2Path)) {
      try {
        fs.unlinkSync(activeSkill2Path);
      } catch (e) {}
    }
    fs.mkdirSync(activeSkill2Path, { recursive: true });

    let output = '';
    const originalConsoleWarn = console.warn;
    console.warn = (msg) => { output += msg; };

    try {
      syncState();
    } finally {
      console.warn = originalConsoleWarn;
    }

    assert.ok(output.includes('is blacklisted in neverPresets, but a physical folder still exists in active directory'));
  });

  it('12. should NOT output any warning if a physical folder exists in active zone but is unrelated to active or blacklisted presets', () => {
    let state = loadState();
    state.activePresets = ['presetB'];
    state.neverPresets = ['never'];
    saveState(state);

    const activeUnrelatedPath = path.join(paths.SKILLS_DIR, 'unrelated-physical-folder');
    if (!fs.existsSync(activeUnrelatedPath)) {
      fs.mkdirSync(activeUnrelatedPath, { recursive: true });
    }

    let output = '';
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    console.warn = (msg) => { output += msg; };
    console.error = (msg) => { output += msg; };

    try {
      syncState();
    } finally {
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      try {
        fs.rmSync(activeUnrelatedPath, { recursive: true, force: true });
      } catch (e) {}
    }

    assert.strictEqual(output.includes('unrelated-physical-folder'), false);
  });

  it('13. should handle and resolve target-mismatched or stale symlinks by recreating them pointing to the correct library path', () => {
    const isWindows = process.platform === 'win32';

    // 1. Write custom preset and populate library skills
    fs.mkdirSync(path.join(paths.LIBRARY_DIR, 'mismatched-skill'), { recursive: true });
    fs.writeFileSync(path.join(paths.LIBRARY_DIR, 'mismatched-skill', 'instruction.txt'), 'correct-content', 'utf8');

    fs.mkdirSync(path.join(paths.LIBRARY_DIR, 'cross-skill-1'), { recursive: true });
    fs.writeFileSync(path.join(paths.LIBRARY_DIR, 'cross-skill-1', 'instruction.txt'), 'content-1', 'utf8');

    fs.mkdirSync(path.join(paths.LIBRARY_DIR, 'cross-skill-2'), { recursive: true });
    fs.writeFileSync(path.join(paths.LIBRARY_DIR, 'cross-skill-2', 'instruction.txt'), 'content-2', 'utf8');

    fs.mkdirSync(path.join(paths.LIBRARY_DIR, 'self-cyclic-skill'), { recursive: true });
    fs.writeFileSync(path.join(paths.LIBRARY_DIR, 'self-cyclic-skill', 'instruction.txt'), 'content-self', 'utf8');

    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'mismatchPreset.md'), `---
name: mismatchPreset
skills:
  - mismatched-skill
  - cross-skill-1
  - cross-skill-2
  - self-cyclic-skill
---`, 'utf8');

    if (!fs.existsSync(paths.SKILLS_DIR)) {
      fs.mkdirSync(paths.SKILLS_DIR, { recursive: true });
    }

    // 2. Pre-create stale symlink 1: points to a wrong destination folder
    const wrongDestPath = path.join(sandboxPath, 'wrong-dest-folder');
    fs.mkdirSync(wrongDestPath, { recursive: true });
    
    const staleLinkPath = path.join(paths.SKILLS_DIR, 'mismatched-skill');
    fs.symlinkSync(wrongDestPath, staleLinkPath, isWindows ? 'junction' : 'dir');

    // 3. Pre-create cross-linked symlinks:
    // cross-skill-1 symlink points to cross-skill-2 in library
    // cross-skill-2 symlink points to cross-skill-1 in library
    const crossLinkPath1 = path.join(paths.SKILLS_DIR, 'cross-skill-1');
    const crossLinkPath2 = path.join(paths.SKILLS_DIR, 'cross-skill-2');
    fs.symlinkSync(path.join(paths.LIBRARY_DIR, 'cross-skill-2'), crossLinkPath1, isWindows ? 'junction' : 'dir');
    fs.symlinkSync(path.join(paths.LIBRARY_DIR, 'cross-skill-1'), crossLinkPath2, isWindows ? 'junction' : 'dir');

    // 4. Pre-create a self-pointing cyclic symlink:
    // self-cyclic-skill symlink points to itself!
    const selfCyclicPath = path.join(paths.SKILLS_DIR, 'self-cyclic-skill');
    fs.symlinkSync(selfCyclicPath, selfCyclicPath, isWindows ? 'junction' : 'dir');

    // Verify initial targets are incorrect
    assert.strictEqual(path.resolve(paths.SKILLS_DIR, fs.readlinkSync(staleLinkPath)), path.resolve(wrongDestPath));
    assert.strictEqual(path.resolve(paths.SKILLS_DIR, fs.readlinkSync(crossLinkPath1)), path.resolve(path.join(paths.LIBRARY_DIR, 'cross-skill-2')));
    assert.strictEqual(path.resolve(paths.SKILLS_DIR, fs.readlinkSync(crossLinkPath2)), path.resolve(path.join(paths.LIBRARY_DIR, 'cross-skill-1')));
    assert.strictEqual(path.resolve(paths.SKILLS_DIR, fs.readlinkSync(selfCyclicPath)), path.resolve(selfCyclicPath));

    // 5. Set the preset as active and sync state
    let state = loadState();
    state.activePresets = ['mismatchPreset'];
    saveState(state);

    syncState();

    // 6. Verify that ALL stale, cross-linked, and cyclic links were safely resolved and updated
    assert.ok(fs.existsSync(staleLinkPath));
    assert.strictEqual(
      path.resolve(paths.SKILLS_DIR, fs.readlinkSync(staleLinkPath)),
      path.resolve(path.join(paths.LIBRARY_DIR, 'mismatched-skill'))
    );

    assert.ok(fs.existsSync(crossLinkPath1));
    assert.strictEqual(
      path.resolve(paths.SKILLS_DIR, fs.readlinkSync(crossLinkPath1)),
      path.resolve(path.join(paths.LIBRARY_DIR, 'cross-skill-1'))
    );

    assert.ok(fs.existsSync(crossLinkPath2));
    assert.strictEqual(
      path.resolve(paths.SKILLS_DIR, fs.readlinkSync(crossLinkPath2)),
      path.resolve(path.join(paths.LIBRARY_DIR, 'cross-skill-2'))
    );

    assert.ok(fs.existsSync(selfCyclicPath));
    assert.strictEqual(
      path.resolve(paths.SKILLS_DIR, fs.readlinkSync(selfCyclicPath)),
      path.resolve(path.join(paths.LIBRARY_DIR, 'self-cyclic-skill'))
    );
  });

  it('14. should automatically self-heal and repair global command shims on execution', () => {
    const isWindows = process.platform === 'win32';
    const fakeNpmBinDir = path.join(sandboxPath, 'fake-npm-bin');
    fs.mkdirSync(fakeNpmBinDir, { recursive: true });

    // 1. Pre-create the fake "source" shims representing the globals NPM creates for skillsman
    if (isWindows) {
      fs.writeFileSync(path.join(fakeNpmBinDir, 'skillsman'), 'node index.js "$@"', 'utf8');
      fs.writeFileSync(path.join(fakeNpmBinDir, 'skillsman.cmd'), 'node.exe index.js %*', 'utf8');
      fs.writeFileSync(path.join(fakeNpmBinDir, 'skillsman.ps1'), 'node.exe index.js $args', 'utf8');

      // Pre-create the "stale" or "collision" shims pointing to the wrong package for both skills and add-skill
      fs.writeFileSync(path.join(fakeNpmBinDir, 'skills'), 'node wrong.js "$@"', 'utf8');
      fs.writeFileSync(path.join(fakeNpmBinDir, 'skills.cmd'), 'node.exe wrong.js %*', 'utf8');
      fs.writeFileSync(path.join(fakeNpmBinDir, 'skills.ps1'), 'node.exe wrong.js $args', 'utf8');

      fs.writeFileSync(path.join(fakeNpmBinDir, 'add-skill'), 'node wrong.js "$@"', 'utf8');
      fs.writeFileSync(path.join(fakeNpmBinDir, 'add-skill.cmd'), 'node.exe wrong.js %*', 'utf8');
      fs.writeFileSync(path.join(fakeNpmBinDir, 'add-skill.ps1'), 'node.exe wrong.js $args', 'utf8');
    } else {
      // Unix: pre-create regular files to simulate collisions (which should be replaced by symlinks)
      fs.writeFileSync(path.join(fakeNpmBinDir, 'skills'), 'legacy file content', 'utf8');
      fs.writeFileSync(path.join(fakeNpmBinDir, 'add-skill'), 'legacy file content', 'utf8');
    }

    const cliPath = path.resolve(__dirname, '..', '..', 'cli.js');

    // 2. Spawn cli.js in a subprocess, setting the sandboxed testing directory
    execSync(`node "${cliPath}" presets`, {
      env: {
        ...process.env,
        SKILLSMAN_SHIM_TEST_DIR: fakeNpmBinDir
      },
      stdio: 'pipe'
    });

    // 3. Verify shims are healed!
    if (isWindows) {
      const cmdContent = fs.readFileSync(path.join(fakeNpmBinDir, 'skills.cmd'), 'utf8');
      const ps1Content = fs.readFileSync(path.join(fakeNpmBinDir, 'skills.ps1'), 'utf8');
      const bashContent = fs.readFileSync(path.join(fakeNpmBinDir, 'skills'), 'utf8');

      assert.ok(cmdContent.includes('cli.js'), 'skills.cmd failed to self-heal');
      assert.ok(ps1Content.includes('cli.js'), 'skills.ps1 failed to self-heal');
      assert.ok(bashContent.includes('cli.js'), 'skills failed to self-heal');

      const addCmdContent = fs.readFileSync(path.join(fakeNpmBinDir, 'add-skill.cmd'), 'utf8');
      const addPs1Content = fs.readFileSync(path.join(fakeNpmBinDir, 'add-skill.ps1'), 'utf8');
      const addBashContent = fs.readFileSync(path.join(fakeNpmBinDir, 'add-skill'), 'utf8');

      assert.ok(addCmdContent.includes('cli.js'), 'add-skill.cmd failed to self-heal');
      assert.ok(addPs1Content.includes('cli.js'), 'add-skill.ps1 failed to self-heal');
      assert.ok(addBashContent.includes('cli.js'), 'add-skill failed to self-heal');
    } else {
      for (const cmdName of ['skills', 'add-skill']) {
        const linkPath = path.join(fakeNpmBinDir, cmdName);
        const stats = fs.lstatSync(linkPath);

        assert.ok(stats.isSymbolicLink(), `${cmdName} was not converted to a symlink`);
        const target = fs.readlinkSync(linkPath);
        assert.strictEqual(path.resolve(target), path.resolve(cliPath), `Unix symlink for ${cmdName} fails to point to cli.js`);
      }
    }
  });
});
