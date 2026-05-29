const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const skillsman = require('../../index');

describe('CLI Skills Delegation Integration Tests', () => {
  const realTestsDir = fs.realpathSync(path.join(__dirname, '..'));
  const sandboxPath = path.join(realTestsDir, 'sandbox-skills-delegation');
  const cliPath = fs.realpathSync(path.resolve(__dirname, '..', '..', 'cli.js'));
  
  // Custom sandboxed locations under .agents to match exactly what is resolved in child processes
  const agentsHome = path.join(sandboxPath, '.agents');
  const activeSkillsDir = path.join(agentsHome, 'skills');
  const xdgStateHome = path.join(agentsHome, 'state');
  const xdgDataHome = path.join(agentsHome, 'data');
  const xdgConfigHome = path.join(agentsHome, 'config');

  let testEnv;

  before(() => {
    // Clean and setup sandbox
    if (fs.existsSync(sandboxPath)) {
      fs.rmSync(sandboxPath, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxPath, { recursive: true });
    fs.mkdirSync(agentsHome, { recursive: true });
    fs.mkdirSync(activeSkillsDir, { recursive: true });
    fs.mkdirSync(xdgStateHome, { recursive: true });
    fs.mkdirSync(xdgDataHome, { recursive: true });
    fs.mkdirSync(xdgConfigHome, { recursive: true });

    // Additional NPM/Windows Sandboxing directories
    const appdataDir = path.join(sandboxPath, 'appdata');
    const localappdataDir = path.join(sandboxPath, 'localappdata');
    const npmPrefixDir = path.join(sandboxPath, 'npm-prefix');
    fs.mkdirSync(appdataDir, { recursive: true });
    fs.mkdirSync(localappdataDir, { recursive: true });
    fs.mkdirSync(npmPrefixDir, { recursive: true });

    // Force skillsman API to use our sandboxed active skills dir matching the agents layout
    skillsman.tests.setTestEnv(agentsHome);

    // Prepare custom sandboxed environment
    testEnv = {
      ...process.env,
      HOME: sandboxPath,
      USERPROFILE: sandboxPath,
      APPDATA: appdataDir,
      LOCALAPPDATA: localappdataDir,
      PREFIX: npmPrefixDir,
      npm_config_prefix: npmPrefixDir,
      XDG_STATE_HOME: xdgStateHome,
      XDG_DATA_HOME: xdgDataHome,
      XDG_CONFIG_HOME: xdgConfigHome,
      SKILLSMAN_SHIM_TEST_DIR: path.join(sandboxPath, 'fake-bin') // Isolate shim links check
    };
  });

  after(() => {
    try {
      fs.rmSync(sandboxPath, { recursive: true, force: true });
    } catch (e) {}
  });

  it('1. should delegate "init" to compile a new local skill project template', () => {
    const tempSkillDir = path.join(sandboxPath, 'my-new-skill-template');
    
    // We execute "cli.js init my-new-skill-template" inside sandboxPath
    execSync(`node "${cliPath}" init my-new-skill-template`, {
      cwd: sandboxPath,
      env: testEnv,
      stdio: 'pipe'
    });

    assert.ok(fs.existsSync(tempSkillDir), 'Failed to delegate init: template folder not created');
    assert.ok(fs.existsSync(path.join(tempSkillDir, 'SKILL.md')), 'Failed to delegate init: SKILL.md template not created');
  });

  it('2. should delegate "add" to install a local skill, redirecting to library and triggering auto-preset hook', () => {
    // Create a local source skill to install offline
    const localSourceDir = path.join(sandboxPath, 'local-source-skill');
    fs.mkdirSync(localSourceDir, { recursive: true });
    
    const skillMdContent = [
      '---',
      'name: sandboxed-local-skill',
      'description: "A custom offline local skill for testing delegation hooks"',
      '---',
      '# sandboxed-local-skill',
      'Instructions for sandboxed test.'
    ].join('\n');
    fs.writeFileSync(path.join(localSourceDir, 'SKILL.md'), skillMdContent, 'utf8');

    // Add robust package.json for offline installation
    const packageJsonContent = JSON.stringify({
      name: 'sandboxed-local-skill',
      version: '1.0.0',
      description: 'A custom offline local skill for testing delegation hooks'
    }, null, 2);
    fs.writeFileSync(path.join(localSourceDir, 'package.json'), packageJsonContent, 'utf8');

    // Run "cli.js add <local-path> -g -y"
    // Since skills is in devDependencies, npx will run the local package instantly and offline!
    console.log(`  [Test] Running: cli.js add ${localSourceDir} -g -y`);
    try {
      const output = execSync(`node "${cliPath}" add "${localSourceDir}" -g -y`, {
        cwd: sandboxPath,
        env: testEnv,
        stdio: 'pipe'
      });
      console.log('--- Subprocess Output (Stdout) ---');
      console.log(output.toString());
      console.log('-----------------------------------');
    } catch (err) {
      console.error('--- Subprocess Error ---');
      console.error(err.stdout?.toString());
      console.error(err.stderr?.toString());
      console.error('------------------------');
      throw err;
    }

    const currentPaths = skillsman.tests.getPaths();

    // Verify it was downloaded into the sandboxed library
    const expectedLibraryDir = path.join(currentPaths.LIBRARY_DIR, 'sandboxed-local-skill');
    assert.ok(fs.existsSync(expectedLibraryDir), 'Skill not downloaded to sandboxed library');
    assert.ok(fs.existsSync(path.join(expectedLibraryDir, 'SKILL.md')), 'SKILL.md missing in sandboxed library');

    // Verify that post-install collection hook ran:
    // 1. Created the preset under PRESETS_DIR/sandboxed-local-skill.md
    const expectedPresetFile = path.join(currentPaths.PRESETS_DIR, 'sandboxed-local-skill.md');
    assert.ok(fs.existsSync(expectedPresetFile), 'Preset file not generated automatically');
    
    const presetContent = fs.readFileSync(expectedPresetFile, 'utf8');
    assert.ok(presetContent.includes('name: sandboxed-local-skill'), 'Generated preset has wrong name metadata');
    assert.ok(presetContent.includes('description: "A custom offline local skill for testing delegation hooks"'), 'Generated preset has wrong description metadata');

    // 2. Replaced the active projection folder with a symlink junction pointing to the library
    const expectedActiveLink = path.join(activeSkillsDir, 'sandboxed-local-skill');
    assert.ok(fs.existsSync(expectedActiveLink), 'Symlink junction not created in active folder');
    
    const stats = fs.lstatSync(expectedActiveLink);
    assert.ok(stats.isSymbolicLink(), 'Active projection is not a symlink/junction');
    
    const target = fs.readlinkSync(expectedActiveLink);
    assert.strictEqual(path.resolve(expectedActiveLink, target), path.resolve(expectedLibraryDir), 'Active projection junction points to wrong folder');
  });

  it('3. should delegate "list" to fetch global skills inside sandboxed library', () => {
    // Run "cli.js list -g --json"
    const listOutput = execSync(`node "${cliPath}" list -g --json`, {
      cwd: sandboxPath,
      env: testEnv,
      encoding: 'utf8'
    });



    assert.ok(
      listOutput.includes('sandboxed-local-skill') || listOutput.includes('Sandboxed Local Skill'),
      'Delegated list command failed to show installed sandboxed skill'
    );
    
    // Parse the JSON output (using robust regex to ignore ANSI color codes and header text)
    const jsonMatch = listOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '[]';
    const skillsList = JSON.parse(jsonStr);
    
    const localSkill = skillsList.find(s => 
      s.name === 'sandboxed-local-skill' || 
      s.name === 'Sandboxed Local Skill' ||
      s.path.includes('sandboxed-local-skill')
    );
    assert.ok(localSkill, 'sandboxed-local-skill not found in JSON output');
    assert.strictEqual(localSkill.scope, 'global');
  });

  it('4. should delegate "remove" to delete local skill and trigger auto-preset clean-up hook', () => {
    // Run "cli.js remove sandboxed-local-skill -y"
    console.log('  [Test] Running: cli.js remove sandboxed-local-skill -y');
    try {
      const output = execSync(`node "${cliPath}" remove sandboxed-local-skill -y`, {
        cwd: sandboxPath,
        env: testEnv,
        stdio: 'pipe'
      });
      console.log('--- Subprocess Output (Remove Stdout) ---');
      console.log(output.toString());
      console.log('------------------------------------------');
    } catch (err) {
      console.error('--- Subprocess Error (Remove) ---');
      console.error(err.stdout?.toString());
      console.error(err.stderr?.toString());
      console.error('---------------------------------');
      throw err;
    }

    const currentPaths = skillsman.tests.getPaths();

    // Helper to wait until a file/folder is fully deleted on Windows due to asynchronous/laggy filesystem handles
    const assertDeletedWithRetry = (filePath, message) => {
      let exists = true;
      for (let i = 0; i < 40; i++) {
        exists = fs.existsSync(filePath);
        if (!exists) break;
        // Yield execution to let OS close file handles
        try { execSync('node -e "setTimeout(() => {}, 50)"'); } catch (e) {}
      }
      assert.ok(!exists, message);
    };

    // Verify that the physical folder inside library was NOT deleted and is kept safe
    const expectedLibraryDir = path.join(currentPaths.LIBRARY_DIR, 'sandboxed-local-skill');
    assert.ok(fs.existsSync(expectedLibraryDir), 'Physical skill folder should not be deleted from sandboxed library');

    // Verify that the preset file was NOT deleted
    const expectedPresetFile = path.join(currentPaths.PRESETS_DIR, 'sandboxed-local-skill.md');
    assert.ok(fs.existsSync(expectedPresetFile), 'Preset file should not be deleted from presets folder');

    // Verify that the active junction link was deleted
    const expectedActiveLink = path.join(activeSkillsDir, 'sandboxed-local-skill');
    assertDeletedWithRetry(expectedActiveLink, 'Junction link not deleted from active projection folder');
  });

  it('5. should support custom version option flag -v or --version', () => {
    const versionOutputShort = execSync(`node "${cliPath}" -v`, { env: testEnv, encoding: 'utf8' }).trim();
    const versionOutputLong = execSync(`node "${cliPath}" --version`, { env: testEnv, encoding: 'utf8' }).trim();
    const pkg = require('../../package.json');
    assert.strictEqual(versionOutputShort, pkg.version);
    assert.strictEqual(versionOutputLong, pkg.version);
  });

  it('6. should reject global flags specified before the subcommand name, matching original skills behavior', () => {
    // 1. "skillsman -g ls" should fail with exit code 1 due to unknown global option
    try {
      execSync(`node "${cliPath}" -g ls`, { cwd: sandboxPath, env: testEnv, stdio: 'pipe' });
      assert.fail('Should have failed when global flag -g was passed before subcommand ls');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      assert.ok(err.stderr.toString().includes("error: unknown option"));
    }

    // 2. "skillsman -p ls" should fail with exit code 1 due to unknown global option
    try {
      execSync(`node "${cliPath}" -p ls`, { cwd: sandboxPath, env: testEnv, stdio: 'pipe' });
      assert.fail('Should have failed when unknown flag -p was passed before subcommand ls');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      assert.ok(err.stderr.toString().includes("error: unknown option"));
    }

    // 3. "skillsman ls -g" should succeed and output global skills
    const listOutput = execSync(`node "${cliPath}" ls -g`, {
      cwd: sandboxPath,
      env: testEnv,
      encoding: 'utf8'
    });
    assert.ok(
      listOutput.includes('Global Skills'),
      'Delegated list command failed to run in global mode when -g was specified after subcommand name'
    );

    // 4. "skillsman ls -g -p" should succeed and output global skills (since -g overrides -p)
    const listOutputGp = execSync(`node "${cliPath}" ls -g -p`, {
      cwd: sandboxPath,
      env: testEnv,
      encoding: 'utf8'
    });
    assert.ok(listOutputGp.includes('Global Skills'));

    // 5. "skillsman ls -p -g" should succeed and output global skills (since -g overrides -p)
    const listOutputPg = execSync(`node "${cliPath}" ls -p -g`, {
      cwd: sandboxPath,
      env: testEnv,
      encoding: 'utf8'
    });
    assert.ok(listOutputPg.includes('Global Skills'));

    // 6. "skillsman ls -p" and "skillsman ls" should work identically in local project mode
    const listOutputP = execSync(`node "${cliPath}" ls -p`, {
      cwd: sandboxPath,
      env: testEnv,
      encoding: 'utf8'
    });
    const listOutputNone = execSync(`node "${cliPath}" ls`, {
      cwd: sandboxPath,
      env: testEnv,
      encoding: 'utf8'
    });
    assert.strictEqual(listOutputP, listOutputNone);
  });
});
