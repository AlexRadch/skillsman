const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { getXdgConfigHome, getXdgStateHome, getXdgDataHome } = require('../../index');

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
});
