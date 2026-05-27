const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { getXdgConfigHome, getXdgStateHome, getXdgDataHome, getAgentSkillsDir, getAgentConfigKey } = require('../../index').tests;

describe('XDG Path Resolution Unit Tests', () => {
  const dummyHome = '/user/alex';

  describe('getXdgConfigHome', () => {
    it('should respect XDG_CONFIG_HOME env variable if set', () => {
      const env = { XDG_CONFIG_HOME: '/custom/config' };
      const resolved = getXdgConfigHome('linux', env, dummyHome);
      assert.strictEqual(resolved, '/custom/config');
    });

    it('should fallback to APPDATA on Windows if XDG_CONFIG_HOME is not set', () => {
      const env = { APPDATA: 'C:\\Users\\alex\\AppData\\Roaming' };
      const resolved = getXdgConfigHome('win32', env, dummyHome);
      assert.strictEqual(resolved, 'C:\\Users\\alex\\AppData\\Roaming');
    });

    it('should fallback to AppData/Roaming on Windows if APPDATA is missing', () => {
      const env = {};
      const resolved = getXdgConfigHome('win32', env, dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, 'AppData', 'Roaming'));
    });

    it('should fallback to ~/.config on Linux/macOS if XDG_CONFIG_HOME is not set', () => {
      const env = {};
      const resolved = getXdgConfigHome('linux', env, dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, '.config'));
    });
  });

  describe('getXdgStateHome', () => {
    it('should respect XDG_STATE_HOME env variable if set', () => {
      const env = { XDG_STATE_HOME: '/custom/state' };
      const resolved = getXdgStateHome('linux', env, dummyHome);
      assert.strictEqual(resolved, '/custom/state');
    });

    it('should fallback to LOCALAPPDATA on Windows if XDG_STATE_HOME is not set', () => {
      const env = { LOCALAPPDATA: 'C:\\Users\\alex\\AppData\\Local' };
      const resolved = getXdgStateHome('win32', env, dummyHome);
      assert.strictEqual(resolved, 'C:\\Users\\alex\\AppData\\Local');
    });

    it('should fallback to AppData/Local on Windows if LOCALAPPDATA is missing', () => {
      const env = {};
      const resolved = getXdgStateHome('win32', env, dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, 'AppData', 'Local'));
    });

    it('should fallback to ~/.local/state on Linux/macOS if XDG_STATE_HOME is not set', () => {
      const env = {};
      const resolved = getXdgStateHome('linux', env, dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, '.local', 'state'));
    });
  });

  describe('getXdgDataHome', () => {
    it('should respect XDG_DATA_HOME env variable if set', () => {
      const env = { XDG_DATA_HOME: '/custom/data' };
      const resolved = getXdgDataHome('linux', env, dummyHome);
      assert.strictEqual(resolved, '/custom/data');
    });

    it('should fallback to LOCALAPPDATA on Windows if XDG_DATA_HOME is not set', () => {
      const env = { LOCALAPPDATA: 'C:\\Users\\alex\\AppData\\Local' };
      const resolved = getXdgDataHome('win32', env, dummyHome);
      assert.strictEqual(resolved, 'C:\\Users\\alex\\AppData\\Local');
    });

    it('should fallback to AppData/Local on Windows if LOCALAPPDATA is missing', () => {
      const env = {};
      const resolved = getXdgDataHome('win32', env, dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, 'AppData', 'Local'));
    });

    it('should fallback to ~/.local/share on Linux/macOS if XDG_DATA_HOME is not set', () => {
      const env = {};
      const resolved = getXdgDataHome('linux', env, dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, '.local', 'share'));
    });
  });

  describe('getAgentSkillsDir', () => {
    it('should resolve the default path for default key', () => {
      const resolved = getAgentSkillsDir('default', dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, '.agents', 'skills'));
    });

    it('should map cline, dexto, warp to default path', () => {
      assert.strictEqual(getAgentSkillsDir('cline', dummyHome), path.join(dummyHome, '.agents', 'skills'));
      assert.strictEqual(getAgentSkillsDir('dexto', dummyHome), path.join(dummyHome, '.agents', 'skills'));
      assert.strictEqual(getAgentSkillsDir('warp', dummyHome), path.join(dummyHome, '.agents', 'skills'));
    });

    it('should resolve correct path for aider-desk', () => {
      const resolved = getAgentSkillsDir('aider-desk', dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, '.aider-desk', 'skills'));
    });

    it('should resolve correct path for claude-code', () => {
      const resolved = getAgentSkillsDir('claude-code', dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, '.claude', 'skills'));
    });

    it('should fallback to default path for unknown agent keys', () => {
      const resolved = getAgentSkillsDir('non-existent-agent-xyz', dummyHome);
      assert.strictEqual(resolved, path.join(dummyHome, '.agents', 'skills'));
    });
  });

  describe('getAgentConfigKey', () => {
    it('should map default, cline, dexto, warp to default config key', () => {
      assert.strictEqual(getAgentConfigKey('default'), 'default');
      assert.strictEqual(getAgentConfigKey('cline'), 'default');
      assert.strictEqual(getAgentConfigKey('dexto'), 'default');
      assert.strictEqual(getAgentConfigKey('warp'), 'default');
    });

    it('should map amp, kimi-cli, replit, universal to config_agents config key', () => {
      assert.strictEqual(getAgentConfigKey('config_agents', true), 'config_agents');
      assert.strictEqual(getAgentConfigKey('amp', true), 'config_agents');
      assert.strictEqual(getAgentConfigKey('kimi-cli', true), 'config_agents');
      assert.strictEqual(getAgentConfigKey('replit', true), 'config_agents');
      assert.strictEqual(getAgentConfigKey('universal', true), 'config_agents');
    });

    it('should preserve distinct agent keys like aider-desk', () => {
      assert.strictEqual(getAgentConfigKey('aider-desk', true), 'aider-desk');
      assert.strictEqual(getAgentConfigKey('claude-code', true), 'claude-code');
    });

    it('should map replit, cursor, antigravity to default config key when isGlobal is false', () => {
      assert.strictEqual(getAgentConfigKey('replit', false), 'default');
      assert.strictEqual(getAgentConfigKey('cursor', false), 'default');
      assert.strictEqual(getAgentConfigKey('antigravity', false), 'default');
      assert.strictEqual(getAgentConfigKey('config_agents', false), 'default');
    });
  });

  describe('shared config_agents paths', () => {
    it('should map amp, kimi-cli, replit, universal to the same physical directory path', () => {
      const expectedPath = path.join(dummyHome, '.config', 'agents', 'skills');
      assert.strictEqual(getAgentSkillsDir('amp', dummyHome), expectedPath);
      assert.strictEqual(getAgentSkillsDir('kimi-cli', dummyHome), expectedPath);
      assert.strictEqual(getAgentSkillsDir('replit', dummyHome), expectedPath);
      assert.strictEqual(getAgentSkillsDir('universal', dummyHome), expectedPath);
      assert.strictEqual(getAgentSkillsDir('config_agents', dummyHome), expectedPath);
    });
  });

  describe('local project path resolution', () => {
    it('should resolve default skills path relative to process.cwd() when isGlobal is false', () => {
      const resolved = getAgentSkillsDir('default', false);
      assert.strictEqual(resolved, path.join(process.cwd(), '.agents', 'skills'));
    });

    it('should resolve aider-desk skills path relative to process.cwd() when isGlobal is false', () => {
      const resolved = getAgentSkillsDir('aider-desk', false);
      assert.strictEqual(resolved, path.join(process.cwd(), '.aider-desk', 'skills'));
    });

    it('should resolve config_agents skills path relative to process.cwd() when isGlobal is false', () => {
      const resolved = getAgentSkillsDir('replit', false);
      assert.strictEqual(resolved, path.join(process.cwd(), '.agents', 'skills'));
    });
  });
});
