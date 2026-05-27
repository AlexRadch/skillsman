const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const skillsman = require('../../index');
const { collect, usePresets } = skillsman;
const { setTestEnv, loadState, saveState, getPaths } = skillsman.tests;

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
    let state = loadState()['default'];
    assert.deepStrictEqual(state.activePresets, ['presetA']);
  });

  it('3. should support incremental activation without linking blacklisted skills', () => {
    usePresets(['+presetB']);
    
    let state = loadState()['default'];
    assert.deepStrictEqual(state.activePresets, ['presetA', 'presetB']);
    assert.ok(!fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-2'))); // Still blacklisted!
  });

  it('4. should support incremental deactivation and keep "always" presets links intact', () => {
    usePresets(['-presetA']);

    let state = loadState()['default'];
    assert.deepStrictEqual(state.activePresets, ['presetB']);
    assert.ok(!fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-1'))); // Removed!
    assert.ok(fs.existsSync(path.join(paths.SKILLS_DIR, 'always-skill'))); // Always stays!
  });

  it('5. should synchronize successfully when blacklist is cleared', () => {
    let state = loadState();
    state['default'].neverPresets = [];
    saveState(state);

    // Call usePresets directly to force a sync with current state
    usePresets();

    // Now test-skill-2 is NOT blacklisted anymore! It should exist!
    assert.ok(fs.existsSync(path.join(paths.SKILLS_DIR, 'test-skill-2')));
  });

  it('6. should sync correctly when state.json is modified manually followed by syncState()', () => {
    let state = loadState();
    state['default'].activePresets = ['presetA', 'presetB'];
    saveState(state);

    // Call usePresets() to trigger sync
    usePresets();

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
    state['default'].activePresets = ['missingPreset'];
    saveState(state);

    let output = '';
    const originalConsoleError = console.error;
    console.error = (msg) => { output += msg; };

    try {
      usePresets();
    } finally {
      console.error = originalConsoleError;
    }

    assert.ok(output.includes('Error: Skill "non-existent-skill" is not found in library directory'));
  });

  it('11. should output a warning if a blacklisted never-preset skill remains physically present as a folder in active zone', () => {
    let state = loadState();
    state['default'].activePresets = ['presetB'];
    state['default'].neverPresets = ['never'];
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
      usePresets();
    } finally {
      console.warn = originalConsoleWarn;
    }

    assert.ok(output.includes('is blacklisted in neverPresets, but a physical folder still exists in active directory'));
  });

  it('12. should NOT output any warning if a physical folder exists in active zone but is unrelated to active or blacklisted presets', () => {
    let state = loadState();
    state['default'].activePresets = ['presetB'];
    state['default'].neverPresets = ['never'];
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
      usePresets();
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
    state['default'].activePresets = ['mismatchPreset'];
    saveState(state);

    usePresets();

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

  it('15. should output correct header log and active presets log when usePresets() is called with empty arguments', () => {
    let output = '';
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      output += args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n';
    };

    try {
      usePresets();
    } finally {
      console.log = originalConsoleLog;
    }

    assert.ok(output.includes('=== Synchronizing Presets (State Sync Mode) ==='));
    assert.ok(output.includes('Active presets in state for'));
  });

  it('16. should support targeting specific agents using the -a/--agent option', () => {
    usePresets(['presetA'], ['replit']);

    const state = loadState();
    assert.ok(state['config_agents']);
    assert.deepStrictEqual(state['config_agents'].activePresets, ['presetA']);

    const configAgentsDir = path.join(sandboxPath, '.config', 'agents', 'skills');
    assert.ok(fs.existsSync(configAgentsDir));
    assert.ok(fs.existsSync(path.join(configAgentsDir, 'test-skill-1')));
    assert.ok(fs.existsSync(path.join(configAgentsDir, 'always-skill')));
  });

  it('17. should support targeting multiple agents via comma-separated list or repeated flags', () => {
    usePresets(['presetB'], ['replit', 'aider-desk']);

    const state = loadState();
    assert.ok(state['config_agents']);
    assert.ok(state['aider-desk']);
    assert.deepStrictEqual(state['config_agents'].activePresets, ['presetB']);
    assert.deepStrictEqual(state['aider-desk'].activePresets, ['presetB']);

    const aiderDeskDir = path.join(sandboxPath, '.aider-desk', 'skills');
    assert.ok(fs.existsSync(aiderDeskDir));
    assert.ok(fs.existsSync(path.join(aiderDeskDir, 'always-skill')));
  });

  it('18. should support showing status for multiple specific agents', () => {
    let output = '';
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      output += args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n';
    };

    try {
      skillsman.showStatus(['replit', 'aider-desk']);
    } finally {
      console.log = originalConsoleLog;
    }

    assert.ok(output.includes('=== Current Preset State for agent "config_agents" ==='));
    assert.ok(output.includes('=== Current Preset State for agent "aider-desk" ==='));
  });

  it('19. should parse space-separated and repeated --agent flags via Commander CLI subprocess', () => {
    const cliPath = path.resolve(__dirname, '..', '..', 'cli.js');

    execSync(`node "${cliPath}" use presetA -a replit aider-desk -a default -g`, {
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(sandboxPath, 'config'),
        XDG_STATE_HOME: path.join(sandboxPath, 'state'),
        XDG_DATA_HOME: path.join(sandboxPath, 'data'),
        APPDATA: path.join(sandboxPath, 'config'),
        LOCALAPPDATA: path.join(sandboxPath, 'state'),
        USERPROFILE: sandboxPath,
        HOME: sandboxPath
      }
    });

    const state = loadState();
    assert.ok(state['config_agents']);
    assert.ok(state['aider-desk']);
    assert.ok(state['default']);
    assert.deepStrictEqual(state['config_agents'].activePresets, ['presetA']);
    assert.deepStrictEqual(state['aider-desk'].activePresets, ['presetA']);
    assert.deepStrictEqual(state['default'].activePresets, ['presetA']);
  });

  it('20. should exit with code 1 and print "Error: Invalid agent" when comma-joined agent names are passed', () => {
    const cliPath = path.resolve(__dirname, '..', '..', 'cli.js');
    const sandboxEnv = {
      ...process.env,
      XDG_CONFIG_HOME: path.join(sandboxPath, 'config'),
      XDG_STATE_HOME: path.join(sandboxPath, 'state'),
      XDG_DATA_HOME: path.join(sandboxPath, 'data'),
      APPDATA: path.join(sandboxPath, 'config'),
      LOCALAPPDATA: path.join(sandboxPath, 'state'),
      USERPROFILE: sandboxPath,
      HOME: sandboxPath
    };

    // Case 1: "-a replit,aider-desk" — no spaces around comma
    try {
      execSync(`node "${cliPath}" status -a replit,aider-desk`, { env: sandboxEnv, stdio: 'pipe' });
      assert.fail('Should have exited with code 1 for agent "replit,aider-desk"');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      const stderr = err.stderr.toString();
      assert.ok(stderr.includes('Error: Invalid agent: replit,aider-desk'), `Expected error in stderr, got: ${stderr}`);
    }

    // Case 2: "-a replit   ,   aider-desk" — spaces around comma (Commander passes as one token)
    try {
      execSync(`node "${cliPath}" status -a "replit   ,   aider-desk"`, { env: sandboxEnv, stdio: 'pipe' });
      assert.fail('Should have exited with code 1 for agent "replit   ,   aider-desk"');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      const stderr = err.stderr.toString();
      assert.ok(stderr.includes('Error: Invalid agent:'), `Expected error in stderr, got: ${stderr}`);
    }
  });

  it('21. should dynamically create .agents and save project-specific state locally without -g', () => {
    // 1. Set working directory to sandbox-integration to simulate running inside a project
    const originalCwd = process.cwd();
    process.chdir(sandboxPath);

    // Ensure .agents/ does not exist first
    const localAgentsDir = path.join(sandboxPath, '.agents');
    if (fs.existsSync(localAgentsDir)) {
      fs.rmSync(localAgentsDir, { recursive: true, force: true });
    }

    try {
      // 2. Call usePresets locally (without -g)
      // Note: we pass isGlobal = false explicitly to override IS_TEST_ENV default
      usePresets(['presetB'], undefined, false);

      // 3. Verify .agents/ and .agents/skillsman-state.json were created successfully
      const localStateFile = path.join(localAgentsDir, 'skillsman-state.json');
      assert.ok(fs.existsSync(localAgentsDir), '.agents directory was not created');
      assert.ok(fs.existsSync(localStateFile), 'skillsman-state.json was not created');

      // 4. Verify local state was saved correctly
      const localState = JSON.parse(fs.readFileSync(localStateFile, 'utf8'));
      assert.deepStrictEqual(localState['default'].activePresets, ['presetB']);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('22. should fall back to loading the global state file when the local state file is missing', () => {
    const originalCwd = process.cwd();
    process.chdir(sandboxPath);

    const localAgentsDir = path.join(sandboxPath, '.agents');
    const localStateFile = path.join(localAgentsDir, 'skillsman-state.json');
    if (fs.existsSync(localStateFile)) {
      fs.unlinkSync(localStateFile);
    }

    try {
      // 1. Save presetA to the global state
      const globalState = loadState(true);
      globalState['default'].activePresets = ['presetA'];
      saveState(globalState, true);

      // 2. Load the state locally (without -g). It should fall back to the global state!
      const resolvedState = loadState(false);
      assert.deepStrictEqual(resolvedState['default'].activePresets, ['presetA']);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('23. should update only the global state file when running with -g / --global option', () => {
    const originalCwd = process.cwd();
    process.chdir(sandboxPath);

    const localAgentsDir = path.join(sandboxPath, '.agents');
    const localStateFile = path.join(localAgentsDir, 'skillsman-state.json');
    if (fs.existsSync(localStateFile)) {
      fs.unlinkSync(localStateFile);
    }

    try {
      // 1. Call usePresets with isGlobal = true
      usePresets(['presetB'], undefined, true);

      // 2. Verify local state was NOT created
      assert.ok(!fs.existsSync(localStateFile), 'local state file should not be created for global use');

      // 3. Verify global state was updated
      const globalState = loadState(true);
      assert.deepStrictEqual(globalState['default'].activePresets, ['presetB']);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
