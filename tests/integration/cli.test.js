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
      execSync(`node "${cliPath}" status -a replit,aider-desk -g`, { env: sandboxEnv, stdio: 'pipe' });
      assert.fail('Should have exited with code 1 for agent "replit,aider-desk"');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      const stderr = err.stderr.toString();
      assert.ok(stderr.includes('Error: Invalid agent: replit,aider-desk'), `Expected error in stderr, got: ${stderr}`);
    }

    // Case 2: "-a replit   ,   aider-desk" — spaces around comma (Commander passes as one token)
    try {
      execSync(`node "${cliPath}" status -a "replit   ,   aider-desk" -g`, { env: sandboxEnv, stdio: 'pipe' });
      assert.fail('Should have exited with code 1 for agent "replit   ,   aider-desk"');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      const stderr = err.stderr.toString();
      assert.ok(stderr.includes('Error: Invalid agent:'), `Expected error in stderr, got: ${stderr}`);
    }
  });

  it('21. should print error that local skills are not supported when isGlobal is false programmatically', () => {
    let output = '';
    const originalConsoleError = console.error;
    console.error = (msg) => { output += msg; };

    try {
      usePresets(['presetB'], undefined, false);
    } finally {
      console.error = originalConsoleError;
    }

    assert.ok(output.includes('Work with local skills is not supported. Please use the -g/--global flag.'));
  });

  it('22. should print error and exit with 1 when running native CLI command without -g option, or with only -p option', () => {
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

    // 1. Without -g or -p
    try {
      execSync(`node "${cliPath}" use presetB`, { env: sandboxEnv, stdio: 'pipe' });
      assert.fail('Should have exited with code 1 due to missing global flag');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      const stderr = err.stderr.toString();
      assert.ok(stderr.includes('Work with local skills is not supported. Please use the -g/--global flag.'));
    }

    // 2. With only -p
    try {
      execSync(`node "${cliPath}" use presetB -p`, { env: sandboxEnv, stdio: 'pipe' });
      assert.fail('Should have exited with code 1 due to missing global flag');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      const stderr = err.stderr.toString();
      assert.ok(stderr.includes('Work with local skills is not supported. Please use the -g/--global flag.'));
    }

    // 3. With both -g and -p (should succeed)
    execSync(`node "${cliPath}" use presetB -g -p`, { env: sandboxEnv, stdio: 'pipe' });
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

  it('24. should gracefully return and not crash when library or presets directory does not exist', () => {
    // Isolate sandboxed test paths to non-existent ones
    const originalPaths = {
      PRESETS_DIR: skillsman.tests.getPaths().PRESETS_DIR,
      LIBRARY_DIR: skillsman.tests.getPaths().LIBRARY_DIR
    };
    
    // Set sandboxed environment to non-existent paths
    skillsman.tests.setTestEnv(path.join(sandboxPath, 'non-existent-sandbox-dir'));
    
    try {
      // Calling syncState should not throw and not crash
      assert.doesNotThrow(() => {
        skillsman.tests.resolveFinalSkills({ activePresets: ['presetA'], alwaysPresets: ['always'], neverPresets: ['never'] });
        skillsman.tests.cleanRemovedSkillsAndPresets(['test-skill-1'], true);
      });
    } finally {
      // Restore sandbox
      skillsman.tests.setTestEnv(sandboxPath);
    }
  });

  it('25. should clean up dead or mismatched active symlinks even if target is missing in library', () => {
    // Ensure test environment directories exist
    const currentPaths = skillsman.tests.getPaths();
    const testLibraryDir = currentPaths.LIBRARY_DIR;
    const testPresetsDir = currentPaths.PRESETS_DIR;
    
    if (!fs.existsSync(testLibraryDir)) {
      fs.mkdirSync(testLibraryDir, { recursive: true });
    }
    if (!fs.existsSync(testPresetsDir)) {
      fs.mkdirSync(testPresetsDir, { recursive: true });
    }
    
    // Create an active skills directory for default agent
    const defaultAgentSkillsDir = skillsman.tests.getAgentSkillsDir('default', true);
    if (!fs.existsSync(defaultAgentSkillsDir)) {
      fs.mkdirSync(defaultAgentSkillsDir, { recursive: true });
    }
    
    // Create a dead symlink in active skills directory pointing to some non-existent path
    const deadLinkPath = path.join(defaultAgentSkillsDir, 'test-dead-skill');
    if (fs.existsSync(deadLinkPath)) {
      try { fs.unlinkSync(deadLinkPath); } catch (e) {}
    }
    
    const isWindows = process.platform === 'win32';
    // Point dead link to a non-existent path in the library
    fs.symlinkSync(path.join(testLibraryDir, 'test-dead-skill'), deadLinkPath, isWindows ? 'junction' : 'dir');
    
    // Update state to include 'test-dead-skill' as active/always preset
    const state = loadState(true);
    state['default'].activePresets = [];
    state['default'].alwaysPresets = ['always'];
    
    // Create an 'always' preset file that includes 'test-dead-skill'
    const alwaysPresetPath = path.join(testPresetsDir, 'always.md');
    fs.writeFileSync(alwaysPresetPath, '---\nname: always\nskills:\n  - test-dead-skill\n---\n', 'utf8');
    
    saveState(state, true);
    
    // Now running syncState should notice that the link is dead/mismatched and DELETE it
    // even though 'test-dead-skill' is not physically in the library!
    skillsman.tests.resolveFinalSkills(state['default']);
    // Call the internal syncState/usePresets logic
    usePresets([], undefined, true);
    
    // Verify that the dead link was successfully cleaned up and deleted!
    assert.ok(!fs.existsSync(deadLinkPath), 'dead/mismatched link should be cleaned up even if missing from library');
  });

  it('26. should restore a missing skill from store to library and keep/create valid symlink when syncing a dead active symlink', () => {
    const currentPaths = skillsman.tests.getPaths();
    const testLibraryDir = currentPaths.LIBRARY_DIR;
    const testStoreDir = currentPaths.STORE_DIR;
    const testPresetsDir = currentPaths.PRESETS_DIR;
    const defaultAgentSkillsDir = skillsman.tests.getAgentSkillsDir('default', true);

    const skillName = 'restorable-skill';
    const storeSkillPath = path.join(testStoreDir, skillName);
    const librarySkillPath = path.join(testLibraryDir, skillName);
    const activeLinkPath = path.join(defaultAgentSkillsDir, skillName);

    // 1. Ensure clean state
    try { fs.rmSync(storeSkillPath, { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(librarySkillPath, { recursive: true, force: true }); } catch (e) {}
    try { fs.unlinkSync(activeLinkPath); } catch (e) {}

    // 2. Create physical skill folder ONLY in storeDir
    fs.mkdirSync(storeSkillPath, { recursive: true });
    fs.writeFileSync(path.join(storeSkillPath, 'instruction.txt'), 'restored-content', 'utf8');

    // 3. Pre-create a dead symlink in active skills directory pointing to the library path (which doesn't exist yet)
    const isWindows = process.platform === 'win32';
    fs.symlinkSync(librarySkillPath, activeLinkPath, isWindows ? 'junction' : 'dir');

    // 4. Update state to include this skill in activePresets via preset
    fs.writeFileSync(path.join(testPresetsDir, 'restorePreset.md'), `---
name: restorePreset
skills:
  - ${skillName}
---`, 'utf8');

    const state = loadState(true);
    state['default'].activePresets = ['restorePreset'];
    state['default'].alwaysPresets = [];
    saveState(state, true);

    // 5. Run usePresets to trigger sync
    usePresets([], undefined, true);

    // 6. Verify skill is restored in library
    assert.ok(fs.existsSync(librarySkillPath), 'Skill should be restored to library');
    assert.strictEqual(
      fs.readFileSync(path.join(librarySkillPath, 'instruction.txt'), 'utf8'),
      'restored-content'
    );

    // 7. Verify symlink is valid and points to the correct library path
    assert.ok(fs.existsSync(activeLinkPath), 'Active symlink should exist and be valid');
    assert.strictEqual(
      path.resolve(defaultAgentSkillsDir, fs.readlinkSync(activeLinkPath)),
      path.resolve(librarySkillPath)
    );
  });
});

