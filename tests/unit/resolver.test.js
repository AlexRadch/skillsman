const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { setTestEnv, resolveFinalSkills, loadSkillsFromPreset, getPaths, loadState, saveState } = require('../../index').tests;

describe('DFS Preset Resolver Unit Tests', () => {
  const sandboxPath = path.join(__dirname, '..', 'sandbox-unit');
  let paths;

  before(() => {
    if (!fs.existsSync(sandboxPath)) {
      fs.mkdirSync(sandboxPath, { recursive: true });
    }
    setTestEnv(sandboxPath);
    
    paths = getPaths();
    if (!fs.existsSync(paths.PRESETS_DIR)) {
      fs.mkdirSync(paths.PRESETS_DIR, { recursive: true });
    }

    // Populate mock presets
    // Circle A -> B -> A
    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'circleA.md'), `---
name: circleA
presets:
  - circleB
skills:
  - skillA
---`, 'utf8');

    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'circleB.md'), `---
name: circleB
presets:
  - circleA
skills:
  - skillB
---`, 'utf8');

    // Nested presets chain: parent -> child -> grandchild
    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'parent.md'), `---
name: parent
presets:
  - child
skills:
  - skillParent
---`, 'utf8');

    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'child.md'), `---
name: child
presets:
  - grandchild
skills:
  - skillChild
---`, 'utf8');

    fs.writeFileSync(path.join(paths.PRESETS_DIR, 'grandchild.md'), `---
name: grandchild
skills:
  - skillGrandchild
---`, 'utf8');
  });

  after(() => {
    try {
      fs.rmSync(sandboxPath, { recursive: true, force: true });
    } catch (e) {}
  });

  it('should resolve nested presets chain recursively (parent -> child -> grandchild)', () => {
    const resolvedParent = loadSkillsFromPreset('parent');
    assert.ok(resolvedParent.includes('skillParent'));
    assert.ok(resolvedParent.includes('skillChild'));
    assert.ok(resolvedParent.includes('skillGrandchild'));
    assert.strictEqual(resolvedParent.length, 3);
  });

  it('should parse cyclic references safely and resolve unique skills without infinite loops', () => {
    const resolvedCircleA = loadSkillsFromPreset('circleA');
    assert.ok(resolvedCircleA.includes('skillA'));
    assert.ok(resolvedCircleA.includes('skillB'));
    assert.strictEqual(resolvedCircleA.length, 2);
  });

  it('should compute resolveFinalSkills correctly with active presets', () => {
    const state = {
      activePresets: ['parent'],
      alwaysPresets: [],
      neverPresets: []
    };
    const res = resolveFinalSkills(state);
    assert.deepStrictEqual(
      Array.from(res.finalSkills).sort(),
      ['skillChild', 'skillGrandchild', 'skillParent'].sort()
    );
  });

  it('should return a valid multi-agent state structure with default initialized', () => {
    const state = loadState();
    assert.ok(state && typeof state === 'object');
    assert.ok(state['default']);
    assert.deepStrictEqual(state['default'].activePresets, []);
  });

  it('should successfully save and load custom multi-agent structures', () => {
    const state = loadState();
    state['config_agents'] = {
      activePresets: ['custom-preset'],
      alwaysPresets: ['always'],
      neverPresets: ['never']
    };
    saveState(state);

    const reloaded = loadState();
    assert.ok(reloaded['config_agents']);
    assert.deepStrictEqual(reloaded['config_agents'].activePresets, ['custom-preset']);
  });

  it('should fall back to default agent states if state.json is corrupted or invalid', () => {
    fs.writeFileSync(paths.STATE_FILE, '{ corrupted json : ', 'utf8');
    const state = loadState();
    assert.ok(state['default']);
    assert.deepStrictEqual(state['default'].activePresets, []);
  });

  it('should fallback to global state and convert config_agents to default when isGlobal is false', () => {
    const globalState = loadState(true);
    globalState['config_agents'] = {
      activePresets: ['preset1'],
      alwaysPresets: ['always'],
      neverPresets: ['never']
    };
    globalState['default'] = {
      activePresets: ['preset2'],
      alwaysPresets: ['always'],
      neverPresets: ['never']
    };
    globalState['aider-desk'] = {
      activePresets: ['preset3'],
      alwaysPresets: ['always'],
      neverPresets: ['never']
    };
    saveState(globalState, true);

    const localStateFile = path.join(sandboxPath, '.agents', 'skillsman-state.json');
    if (fs.existsSync(localStateFile)) {
      try { fs.unlinkSync(localStateFile); } catch (e) {}
    }

    const localState = loadState(false);
    
    assert.ok(!localState['config_agents']);
    assert.ok(localState['default']);
    assert.ok(localState['default'].activePresets.includes('preset1'));
    assert.ok(localState['default'].activePresets.includes('preset2'));
    
    assert.ok(localState['aider-desk']);
    assert.deepStrictEqual(localState['aider-desk'].activePresets, ['preset3']);
  });
});
