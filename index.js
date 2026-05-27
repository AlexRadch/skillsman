#!/usr/bin/env node
// @ts-check

/**
 * skillsman - CLI manager for AI agent skills presets
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');

// Helper to expand user directory (can be overridden for tests)
let USER_HOME = os.homedir();
let IS_TEST_ENV = false;

/**
 * Safely resolves physical path (handles drive/symlink redirects)
 * @param {string} p - The path to resolve
 * @returns {string} The resolved physical path
 */
function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch (e) {
    return path.resolve(p);
  }
}

/**
 * Resolves standard XDG CONFIG HOME directory
 * @param {string} [platform] - The platform name
 * @param {NodeJS.ProcessEnv} [env] - Environment variables
 * @param {string} [home] - User home directory
 * @returns {string} The XDG CONFIG HOME path
 */
function getXdgConfigHome(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.XDG_CONFIG_HOME) return env.XDG_CONFIG_HOME;
  if (platform === 'win32') {
    return env.APPDATA || path.join(home, 'AppData', 'Roaming');
  }
  return path.join(home, '.config');
}

/**
 * Resolves standard XDG STATE HOME directory
 * @param {string} [platform] - The platform name
 * @param {NodeJS.ProcessEnv} [env] - Environment variables
 * @param {string} [home] - User home directory
 * @returns {string} The XDG STATE HOME path
 */
function getXdgStateHome(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.XDG_STATE_HOME) return env.XDG_STATE_HOME;
  if (platform === 'win32') {
    return env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  }
  return path.join(home, '.local', 'state');
}

/**
 * Resolves standard XDG DATA HOME directory
 * @param {string} [platform] - The platform name
 * @param {NodeJS.ProcessEnv} [env] - Environment variables
 * @param {string} [home] - User home directory
 * @returns {string} The XDG DATA HOME path
 */
function getXdgDataHome(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.XDG_DATA_HOME) return env.XDG_DATA_HOME;
  if (platform === 'win32') {
    return env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  }
  return path.join(home, '.local', 'share');
}

let AGENTS_DIR = path.join(USER_HOME, '.agents');
let SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
let LIBRARY_DIR = path.join(getXdgDataHome(), 'skillsman', '.agents', 'skills');
let PRESETS_DIR = path.join(getXdgConfigHome(), 'skillsman', 'presets');
let STATE_FILE = path.join(getXdgStateHome(), 'skillsman', 'state.json');

/**
 * Resolves the state file path.
 * @param {boolean} [isGlobal] - Whether to use the global state
 * @returns {string} The absolute path to state.json
 */
function getStateFile(isGlobal = IS_TEST_ENV) {
  if (isGlobal) {
    return STATE_FILE;
  }
  return path.join(process.cwd(), '.agents', 'skillsman-state.json');
}

/**
 * Resolves the presets directory path.
 * @returns {string} The absolute path to presets directory
 */
function getPresetsDir() {
  return PRESETS_DIR;
}

/**
 * Resolves the library directory path.
 * @returns {string} The absolute path to library directory
 */
function getLibraryDir() {
  return LIBRARY_DIR;
}

/** @type {Record<string, { path: string, key: string }>} */
const SUPPORTED_AGENTS = {
  'default': { path: '.agents/skills', key: 'default' },
  'config_agents': { path: '.config/agents/skills', key: 'config_agents' },
  'aider-desk': { path: '.aider-desk/skills', key: 'aider-desk' },
  'amp': { path: '.config/agents/skills', key: 'config_agents' },
  'kimi-cli': { path: '.config/agents/skills', key: 'config_agents' },
  'replit': { path: '.config/agents/skills', key: 'config_agents' },
  'universal': { path: '.config/agents/skills', key: 'config_agents' },
  'antigravity': { path: '.gemini/antigravity/skills', key: 'antigravity' },
  'augment': { path: '.augment/skills', key: 'augment' },
  'bob': { path: '.bob/skills', key: 'bob' },
  'claude-code': { path: '.claude/skills', key: 'claude-code' },
  'openclaw': { path: '.openclaw/skills', key: 'openclaw' },
  'cline': { path: '.agents/skills', key: 'default' },
  'dexto': { path: '.agents/skills', key: 'default' },
  'warp': { path: '.agents/skills', key: 'default' },
  'codearts-agent': { path: '.codeartsdoer/skills', key: 'codearts-agent' },
  'codebuddy': { path: '.codebuddy/skills', key: 'codebuddy' },
  'codemaker': { path: '.codemaker/skills', key: 'codemaker' },
  'codestudio': { path: '.codestudio/skills', key: 'codestudio' },
  'codex': { path: '.codex/skills', key: 'codex' },
  'command-code': { path: '.commandcode/skills', key: 'command-code' },
  'continue': { path: '.continue/skills', key: 'continue' },
  'cortex': { path: '.snowflake/cortex/skills', key: 'cortex' },
  'crush': { path: '.config/crush/skills', key: 'crush' },
  'cursor': { path: '.cursor/skills', key: 'cursor' },
  'deepagents': { path: '.deepagents/agent/skills', key: 'deepagents' },
  'devin': { path: '.config/devin/skills', key: 'devin' },
  'droid': { path: '.factory/skills', key: 'droid' },
  'firebender': { path: '.firebender/skills', key: 'firebender' },
  'forgecode': { path: '.forge/skills', key: 'forgecode' },
  'gemini-cli': { path: '.gemini/skills', key: 'gemini-cli' },
  'github-copilot': { path: '.copilot/skills', key: 'github-copilot' },
  'goose': { path: '.config/goose/skills', key: 'goose' },
  'hermes-agent': { path: '.hermes/skills', key: 'hermes-agent' },
  'junie': { path: '.junie/skills', key: 'junie' },
  'iflow-cli': { path: '.iflow/skills', key: 'iflow-cli' },
  'kilo': { path: '.kilocode/skills', key: 'kilo' },
  'kiro-cli': { path: '.kiro/skills', key: 'kiro-cli' },
  'kode': { path: '.kode/skills', key: 'kode' },
  'mcpjam': { path: '.mcpjam/skills', key: 'mcpjam' },
  'mistral-vibe': { path: '.vibe/skills', key: 'mistral-vibe' },
  'mux': { path: '.mux/skills', key: 'mux' },
  'opencode': { path: '.config/opencode/skills', key: 'opencode' },
  'openhands': { path: '.openhands/skills', key: 'openhands' },
  'pi': { path: '.pi/agent/skills', key: 'pi' },
  'qoder': { path: '.qoder/skills', key: 'qoder' },
  'qwen-code': { path: '.qwen/skills', key: 'qwen-code' },
  'rovodev': { path: '.rovodev/skills', key: 'rovodev' },
  'roo': { path: '.roo/skills', key: 'roo' },
  'tabnine-cli': { path: '.tabnine/agent/skills', key: 'tabnine-cli' },
  'trae': { path: '.trae/skills', key: 'trae' },
  'trae-cn': { path: '.trae-cn/skills', key: 'trae-cn' },
  'windsurf': { path: '.codeium/windsurf/skills', key: 'windsurf' },
  'zencoder': { path: '.zencoder/skills', key: 'zencoder' },
  'neovate': { path: '.neovate/skills', key: 'neovate' },
  'pochi': { path: '.pochi/skills', key: 'pochi' },
  'adal': { path: '.adal/skills', key: 'adal' }
};

/**
 * Validates agent keys against SUPPORTED_AGENTS.
 * Exits with status code 1 if any key is invalid.
 * @param {string[]} [agentKeys] - The agent keys to validate
 * @returns {void}
 */
function validateAgentKeys(agentKeys) {
  if (!agentKeys || agentKeys.length === 0) return;
  for (const agent of agentKeys) {
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_AGENTS, agent)) {
      console.error(`Error: Invalid agent: ${agent}`);
      process.exit(1);
    }
  }
}

/**
 * Resolves the canonical state.json configuration key for a given agent option key.
 * Ensures agents sharing identical paths share the same configuration key.
 * @param {string} agentKey - The agent key (e.g. 'replit', 'cline', 'aider-desk')
 * @returns {string} The canonical state key (e.g. 'default', 'config_agents', 'aider-desk')
 */
function getAgentConfigKey(agentKey) {
  return SUPPORTED_AGENTS[agentKey]?.key || 'default';
}

/**
 * Resolves the absolute directory path for a given agent key.
 * Maps alias keys ('cline', 'dexto', 'warp') to the common 'default' path.
 * @param {string} agentKey - The agent key (e.g. 'default', 'aider-desk')
 * @param {boolean|string} [isGlobalOrHome] - Scope flag or explicit home path
 * @returns {string} The resolved absolute skills directory path
 */
function getAgentSkillsDir(agentKey, isGlobalOrHome = IS_TEST_ENV) {
  const configKey = getAgentConfigKey(agentKey);
  let home;
  if (typeof isGlobalOrHome === 'string') {
    home = isGlobalOrHome;
  } else {
    home = isGlobalOrHome ? USER_HOME : process.cwd();
  }
  
  if (configKey === 'default' && home === USER_HOME) {
    return SKILLS_DIR;
  }
  if (configKey === 'default') {
    return path.join(home, '.agents', 'skills');
  }
  const relPath = SUPPORTED_AGENTS[configKey]?.path;
  if (!relPath) {
    return path.join(home, '.agents', 'skills');
  }
  return path.join(home, ...relPath.split('/'));
}

/**
 * Configure test environment paths (used by unit and integration tests)
 * @param {string} sandboxPath - The sandbox root path
 * @returns {void}
 */
function setTestEnv(sandboxPath) {
  IS_TEST_ENV = true;
  USER_HOME = sandboxPath;
  AGENTS_DIR = sandboxPath;
  SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
  
  // Set sandboxed XDG folders under sandboxPath
  LIBRARY_DIR = path.join(sandboxPath, 'data', 'skillsman', '.agents', 'skills');
  PRESETS_DIR = path.join(sandboxPath, 'config', 'skillsman', 'presets');
  STATE_FILE = path.join(sandboxPath, 'state', 'skillsman', 'state.json');
}

/**
 * Returns the default state structure for a single agent
 * @returns {{ activePresets: string[], alwaysPresets: string[], neverPresets: string[] }}
 */
function getDefaultAgentState() {
  return {
    activePresets: [],
    alwaysPresets: ['always'],
    neverPresets: ['never']
  };
}

/**
 * Returns the default state structure
 * @returns {Record<string, { activePresets: string[], alwaysPresets: string[], neverPresets: string[] }>}
 */
function getDefaultState() {
  return {
    'default': getDefaultAgentState()
  };
}

/**
 * Loads the state from state.json
 * @param {boolean} [isGlobal] - Whether to load the global state (defaults to false)
 * @returns {Record<string, { activePresets: string[], alwaysPresets: string[], neverPresets: string[] }>}
 */
function loadState(isGlobal = IS_TEST_ENV) {
  const file = getStateFile(isGlobal);
  
  // Dynamic fallback: if local state file does not exist, fall back to global state file
  if (!isGlobal && !fs.existsSync(file)) {
    const globalFile = getStateFile(true);
    if (fs.existsSync(globalFile)) {
      try {
        const data = fs.readFileSync(globalFile, 'utf8');
        return parseStateJSON(data);
      } catch (err) {}
    }
    return getDefaultState();
  }

  if (!fs.existsSync(file)) {
    return getDefaultState();
  }
  try {
    const data = fs.readFileSync(file, 'utf8');
    return parseStateJSON(data);
  } catch (err) {
    return getDefaultState();
  }
}

/**
 * Helper to parse state JSON safely
 * @param {string} data - JSON string
 * @returns {Record<string, any>}
 */
function parseStateJSON(data) {
  const state = JSON.parse(data);
  if (!state || typeof state !== 'object') {
    return getDefaultState();
  }
  for (const key of Object.keys(state)) {
    const agentState = state[key];
    if (agentState && typeof agentState === 'object') {
      if (!Array.isArray(agentState.activePresets)) agentState.activePresets = [];
      if (!Array.isArray(agentState.alwaysPresets)) agentState.alwaysPresets = ['always'];
      if (!Array.isArray(agentState.neverPresets)) agentState.neverPresets = ['never'];
    } else {
      state[key] = getDefaultAgentState();
    }
  }
  if (!state['default']) {
    state['default'] = getDefaultAgentState();
  }
  return state;
}

/**
 * Saves the state to state.json
 * @param {Record<string, { activePresets: string[], alwaysPresets: string[], neverPresets: string[] }>} state - The state object to save
 * @param {boolean} [isGlobal] - Whether to save to global state (defaults to false)
 * @returns {void}
 */
function saveState(state, isGlobal = IS_TEST_ENV) {
  const file = getStateFile(isGlobal);
  try {
    const stateDir = path.dirname(file);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error(`\x1b[31mError saving state:\x1b[0m`, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Robust, package-based YAML Frontmatter Parser using gray-matter
 * @param {string} content - Markdown file content
 * @returns {{ data: Record<string, any>, content: string }} Parse results
 */
function parseFrontmatter(content) {
  try {
    const { data, content: body } = matter(content);
    return { data: data || {}, content: body || '' };
  } catch (err) {
    console.warn(`\x1b[33mWarning: Failed to parse frontmatter:\x1b[0m`, err instanceof Error ? err.message : String(err));
    return { data: {}, content };
  }
}

/**
 * Loads skills list directly from a preset file (non-recursive).
 * @param {string} presetName - The name of the preset
 * @returns {string[]} List of skill names
 */
function loadSkillsFromPresetDirect(presetName) {
  const presetsDir = getPresetsDir();
  const presetPath = path.join(presetsDir, `${presetName}.md`);
  if (!fs.existsSync(presetPath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(presetPath, 'utf8');
    const { data } = parseFrontmatter(content);
    return Array.isArray(data.skills) ? data.skills : [];
  } catch (err) {
    return [];
  }
}

/**
 * Loads skills list from a preset file by name, resolving nested presets recursively (DFS).
 * Handles cycles safely using a visited set.
 * @param {string} presetName - The name of the preset
 * @param {Set<string>} [visited] - Set of visited presets to break cycles
 * @returns {string[]} Resolved skill list
 */
function loadSkillsFromPreset(presetName, visited = new Set()) {
  if (visited.has(presetName)) {
    return []; // Cycle break
  }
  visited.add(presetName);

  const presetsDir = getPresetsDir();
  const presetPath = path.join(presetsDir, `${presetName}.md`);
  if (!fs.existsSync(presetPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(presetPath, 'utf8');
    const { data } = parseFrontmatter(content);
    
    const skills = new Set();

    // 1. Add direct skills
    if (Array.isArray(data.skills)) {
      for (const skill of data.skills) {
        skills.add(skill);
      }
    }

    // 2. Add referenced preset skills recursively
    if (Array.isArray(data.presets)) {
      for (const refPreset of data.presets) {
        const refSkills = loadSkillsFromPreset(refPreset, visited);
        for (const skill of refSkills) {
          skills.add(skill);
        }
      }
    }

    return Array.from(skills);
  } catch (err) {
    return [];
  }
}

/**
 * Resolves the final set of skills based on the state.
 * Performs a DFS recursive preset expansion for candidate active skills.
 * Performs a direct non-recursive lookup for forbidden/never skills.
 * @param {{ activePresets: string[], alwaysPresets: string[], neverPresets: string[] }} state - The state object
 * @returns {{ finalSkills: Set<string>, forbiddenSkills: Set<string> }} Resolved final and forbidden sets
 */
function resolveFinalSkills(state) {
  const resolvedActive = new Set();

  /**
   * Helper to expand presets recursively
   * @param {string} presetName - The name of the preset
   * @param {Set<string>} [visited] - Visited set
   */
  function expandPresets(presetName, visited = new Set()) {
    if (visited.has(presetName)) {
      return; // Cycle break
    }
    visited.add(presetName);
    resolvedActive.add(presetName);

    const presetsDir = getPresetsDir();
    const presetPath = path.join(presetsDir, `${presetName}.md`);
    if (!fs.existsSync(presetPath)) return;

    try {
      const content = fs.readFileSync(presetPath, 'utf8');
      const { data } = parseFrontmatter(content);
      if (Array.isArray(data.presets)) {
        for (const ref of data.presets) {
          expandPresets(ref, visited);
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  // 1. DFS-expand activePresets and alwaysPresets
  for (const preset of [...state.activePresets, ...state.alwaysPresets]) {
    expandPresets(preset);
  }

  // 2. Gather skills from resolvedActive
  const candidateSkills = new Set();
  for (const preset of resolvedActive) {
    const skills = loadSkillsFromPresetDirect(preset);
    for (const skill of skills) {
      candidateSkills.add(skill);
    }
  }

  // 3. Gather forbidden skills directly from neverPresets (non-recursive)
  const forbiddenSkills = new Set();
  for (const preset of state.neverPresets) {
    const skills = loadSkillsFromPresetDirect(preset);
    for (const skill of skills) {
      forbiddenSkills.add(skill);
    }
  }

  // 4. Compute final skills
  const finalSkills = new Set();
  for (const skill of candidateSkills) {
    if (forbiddenSkills.has(skill)) {
      continue;
    }
    finalSkills.add(skill);
  }

  return { finalSkills, forbiddenSkills };
}

/**
 * Core Logic: collect
 * Description: Initializes directory structure, state.json, and automatically collects/migrates
 * existing physical skill directories from active directories into the library, replacing them with symlinks
 * and generating corresponding skillsman presets.
 * @param {string[]} [agentKeys] - The agents to scan (scans all supported agents if undefined/empty)
 * @param {boolean} [isGlobal] - Scope flag
 * @returns {void}
 */
function collect(agentKeys, isGlobal = IS_TEST_ENV) {
  validateAgentKeys(agentKeys);
  console.log('\x1b[36m%s\x1b[0m', '=== Collecting Skills and Initializing Environment ===');

  const libraryDir = getLibraryDir();
  const presetsDir = getPresetsDir();
  const stateFile = getStateFile(isGlobal);

  // 1. Gracefully generate folders in their respective XDG config, state, and data locations
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
    console.log(`\x1b[32m✔\x1b[0m Created library folder: ${libraryDir}`);
  }

  if (!fs.existsSync(presetsDir)) {
    fs.mkdirSync(presetsDir, { recursive: true });
    console.log(`\x1b[32m✔\x1b[0m Created presets folder: ${presetsDir}`);
  }

  // 1b. Automatically generate presets for any skills already residing in the library
  if (fs.existsSync(libraryDir)) {
    const libraryItems = fs.readdirSync(libraryDir);
    for (const item of libraryItems) {
      const itemPath = path.join(libraryDir, item);
      try {
        const stat = fs.lstatSync(itemPath);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          const presetPath = path.join(presetsDir, `${item}.md`);
          if (!fs.existsSync(presetPath)) {
            let title = item;
            let description = `Automatically collected preset for ${item} skill`;

            // Attempt to parse SKILL.md to extract metadata
            const skillMdPath = path.join(itemPath, 'SKILL.md');
            if (fs.existsSync(skillMdPath)) {
              try {
                const skillContent = fs.readFileSync(skillMdPath, 'utf8');
                const { data } = parseFrontmatter(skillContent);
                if (data.name) title = data.name;
                if (data.description) description = data.description;
              } catch (e) {
                // Ignored
              }
            }

            const presetContent = [
              '---',
              `name: ${title}`,
              `description: "${description.replace(/"/g, '\\"')}"`,
              'skills:',
              `  - ${item}`,
              '---',
              `# ${title}`,
              '',
              description,
              ''
            ].join('\n');

            fs.writeFileSync(presetPath, presetContent, 'utf8');
            console.log(`  \x1b[32m✔\x1b[0m Generated preset for library skill: ${item}.md`);
          }
        }
      } catch (err) {
        // Ignored
      }
    }
  }

  const stateFileDir = path.dirname(stateFile);
  if (!fs.existsSync(stateFileDir)) {
    fs.mkdirSync(stateFileDir, { recursive: true });
  }

  if (!fs.existsSync(stateFile)) {
    const defaultState = getDefaultState();
    saveState(defaultState, isGlobal);
    console.log(`\x1b[32m✔\x1b[0m Initialized state file: ${stateFile}`);
  }

  // Determine directories to scan
  /** @type {string[]} */
  let targetDirs;
  if (agentKeys && agentKeys.length > 0) {
    targetDirs = Array.from(new Set(agentKeys.map(k => getAgentSkillsDir(k, isGlobal))));
  } else {
    targetDirs = Array.from(new Set(Object.keys(SUPPORTED_AGENTS).map(k => getAgentSkillsDir(k, isGlobal))));
  }

  let migratedCount = 0;

  for (const skillsDir of targetDirs) {
    if (!fs.existsSync(skillsDir)) {
      continue;
    }

    const items = fs.readdirSync(skillsDir);

    for (const item of items) {
      const itemPath = path.join(skillsDir, item);
      const stat = fs.lstatSync(itemPath);

      // If it is a physical directory (not a symlink/junction), we migrate it!
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        console.log(`  \x1b[33m⚡ Found physical folder to collect in [${skillsDir}]:\x1b[0m ${item}`);

        const targetPath = path.join(libraryDir, item);

        // If already exists in library, remove the one in active directory and replace it with a symlink
        if (fs.existsSync(targetPath)) {
          console.warn(`  \x1b[33m⚠ Already exists in library:\x1b[0m ${item}. Overwriting library folder.`);
          fs.rmSync(targetPath, { recursive: true, force: true });
        }

        // Move directory to library
        try {
          fs.renameSync(itemPath, targetPath);
        } catch (err) {
          // Fallback if cross-device link error
          fs.cpSync(itemPath, targetPath, { recursive: true });
          fs.rmSync(itemPath, { recursive: true, force: true });
        }

        console.log(`  \x1b[32m✔\x1b[0m Moved to library: ${item}`);

        // Auto-generate preset file for this skill if it doesn't exist
        const presetPath = path.join(presetsDir, `${item}.md`);
        if (!fs.existsSync(presetPath)) {
          let title = item;
          let description = `Automatically collected preset for ${item} skill`;

          // Attempt to parse SKILL.md to extract metadata
          const skillMdPath = path.join(targetPath, 'SKILL.md');
          if (fs.existsSync(skillMdPath)) {
            try {
              const skillContent = fs.readFileSync(skillMdPath, 'utf8');
              const { data } = parseFrontmatter(skillContent);
              if (data.name) title = data.name;
              if (data.description) description = data.description;
            } catch (e) {
              // Ignored
            }
          }

          const presetContent = [
            '---',
            `name: ${title}`,
            `description: "${description.replace(/"/g, '\\"')}"`,
            'skills:',
            `  - ${item}`,
            '---',
            `# ${title}`,
            '',
            description,
            ''
          ].join('\n');

          fs.writeFileSync(presetPath, presetContent, 'utf8');
          console.log(`  \x1b[32m✔\x1b[0m Generated preset: ${item}.md`);
        }

        // Create symlink junction back in active skillsDir
        const isWindows = process.platform === 'win32';
        fs.symlinkSync(targetPath, itemPath, isWindows ? 'junction' : 'dir');
        console.log(`  \x1b[32m✔\x1b[0m Replaced with junction: ${item} -> ${targetPath}`);
        
        migratedCount++;
      }
    }
  }

  console.log(`\n\x1b[32m✔ Collection and initialization completed successfully.\x1b[0m`);
  if (migratedCount > 0) {
    console.log(`  Collected and linked: ${migratedCount} physical skill folders.`);
  } else {
    console.log('  No physical skills needed collection.');
  }
}

/**
 * Command: list/ls
 * Usage: skillsman list
 * @returns {void}
 */
function listPresets() {
  console.log('\x1b[36m%s\x1b[0m', '=== Available Presets ===');
  
  const presetsDir = getPresetsDir();
  if (!fs.existsSync(presetsDir)) {
    console.log('\x1b[90mPresets directory does not exist. Run "skillsman init" first.\x1b[0m');
    return;
  }

  const files = fs.readdirSync(presetsDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  if (mdFiles.length === 0) {
    console.log('\x1b[90mNo presets found in presets folder.\x1b[0m');
    return;
  }

  for (const file of mdFiles) {
    const filePath = path.join(presetsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = parseFrontmatter(content);
      
      const presetName = data.name || path.basename(file, '.md');
      const desc = data.description || 'No description provided';
      const resolvedSkills = loadSkillsFromPreset(presetName);
      const skillsCount = resolvedSkills.length;

      // Special highlight for 'always' and 'never' presets
      if (presetName === 'always') {
        console.log(`\x1b[33m${presetName.padEnd(14)}\x1b[0m ${desc} \x1b[90m(${skillsCount} skills - auto-loaded)\x1b[0m`);
      } else if (presetName === 'never') {
        console.log(`\x1b[31m${presetName.padEnd(14)}\x1b[0m ${desc} \x1b[90m(${skillsCount} skills - blacklisted)\x1b[0m`);
      } else {
        console.log(`\x1b[32m${presetName.padEnd(14)}\x1b[0m ${desc} \x1b[90m(${skillsCount} skills)\x1b[0m`);
      }
    } catch (err) {
      console.error(`\x1b[31mError parsing preset ${file}:\x1b[0m`, err instanceof Error ? err.message : String(err));
    }
  }
}

/**
 * Command: status
 * Usage: skillsman status
 * @param {string[]} [agentKeys] - Specific agents to show status for (defaults to all active/defined keys in state.json)
 * @param {boolean} [isGlobal] - Scope flag
 * @returns {void}
 */
function showStatus(agentKeys, isGlobal = IS_TEST_ENV) {
  validateAgentKeys(agentKeys);
  const multiState = loadState(isGlobal);

  // Determine which agent keys to display
  /** @type {string[]} */
  let targetKeys;
  if (agentKeys && agentKeys.length > 0) {
    targetKeys = Array.from(new Set(agentKeys.map(k => getAgentConfigKey(k))));
  } else {
    // Show all keys present in state
    targetKeys = Object.keys(multiState);
  }

  for (const key of targetKeys) {
    const agentState = multiState[key] || getDefaultAgentState();
    const skillsDir = getAgentSkillsDir(key, isGlobal);

    console.log('\x1b[36m%s\x1b[0m', `=== Current Preset State for agent "${key}" ===`);
    console.log(`  \x1b[1mActive Presets:\x1b[0m   ${agentState.activePresets.join(', ') || '\x1b[90mnone\x1b[0m'}`);
    console.log(`  \x1b[1mAlways Presets:\x1b[0m   ${agentState.alwaysPresets.join(', ')}`);
    console.log(`  \x1b[1mNever Presets:\x1b[0m    ${agentState.neverPresets.join(', ')}`);

    console.log('\n\x1b[36m%s\x1b[0m', `=== Current Link Status for agent "${key}" [${skillsDir}] ===`);

    if (!fs.existsSync(skillsDir)) {
      console.log('\x1b[90mActive skills directory does not exist.\x1b[0m\n');
      continue;
    }

    const items = fs.readdirSync(skillsDir);
    if (items.length === 0) {
      console.log('\x1b[90mNo active skill links found.\x1b[0m');
      console.log('\x1b[37mUse "skillsman use <preset>" to activate some skills.\x1b[0m\n');
      continue;
    }

    for (const item of items) {
      const itemPath = path.join(skillsDir, item);
      try {
        const stat = fs.lstatSync(itemPath);
        if (stat.isSymbolicLink()) {
          const target = fs.readlinkSync(itemPath);
          const resolvedTarget = path.resolve(path.dirname(itemPath), target);
          console.log(`  \x1b[32m✔\x1b[0m \x1b[1m${item}\x1b[0m \x1b[90m->\x1b[0m \x1b[32m${resolvedTarget}\x1b[0m`);
        } else if (stat.isDirectory()) {
          console.log(`  \x1b[33m⚠ [Physical Directory]\x1b[0m \x1b[1m${item}\x1b[0m \x1b[90m(Not a symbolic link!)\x1b[0m`);
        } else {
          console.log(`  \x1b[90m? [Unknown FileType]\x1b[0m \x1b[1m${item}\x1b[0m`);
        }
      } catch (err) {
        console.error(`  \x1b[31m✖ Error reading status for "${item}":\x1b[0m`, err instanceof Error ? err.message : String(err));
      }
    }
    console.log();
  }
}

/**
 * Synchronizes the active symlinks to match the current state.json and presets
 * @param {boolean} [isGlobal] - Scope flag
 * @returns {void}
 */
function syncState(isGlobal = IS_TEST_ENV) {
  const multiState = loadState(isGlobal);
  const presetsDir = getPresetsDir();
  const libraryDir = getLibraryDir();

  // Ensure libraries and presets exist
  if (!fs.existsSync(presetsDir) || !fs.existsSync(libraryDir)) {
    console.error('\x1b[31mError: Environment not initialized. Please run "skillsman init" first.\x1b[0m');
    process.exit(1);
  }

  for (const key of Object.keys(multiState)) {
    const agentState = multiState[key];
    const skillsDir = getAgentSkillsDir(key, isGlobal);

    console.log('\x1b[36m%s\x1b[0m', `=== Synchronizing active skills for agent "${key}" [${skillsDir}] ===`);

    // Make sure active skills directory exists
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }

    // 1. Resolve final skills list using DFS recursion
    const { finalSkills, forbiddenSkills } = resolveFinalSkills(agentState);

    // 2. Read currently active symlinks in skillsDir
    /** @type {Record<string, string|null>} */
    const activeSymlinks = {};
    /** @type {string[]} */
    const physicalFolders = [];
    if (fs.existsSync(skillsDir)) {
      const items = fs.readdirSync(skillsDir);
      for (const item of items) {
        const itemPath = path.join(skillsDir, item);
        const stat = fs.lstatSync(itemPath);
        if (stat.isSymbolicLink()) {
          try {
            const target = fs.readlinkSync(itemPath);
            const resolvedTarget = path.resolve(path.dirname(itemPath), target);
            activeSymlinks[item] = safeRealpath(resolvedTarget);
          } catch (e) {
            activeSymlinks[item] = null;
          }
        } else {
          physicalFolders.push(item);
        }
      }
    }

    // 3. Sync symlinks based on calculated finalSkills
    let removedCount = 0;
    let addedCount = 0;
    let unchangedCount = 0;

    // Remove obsolete active links (not in finalSkills)
    for (const activeName of Object.keys(activeSymlinks)) {
      if (!finalSkills.has(activeName)) {
        const linkPath = path.join(skillsDir, activeName);
        try {
          fs.unlinkSync(linkPath);
          console.log(`  \x1b[31m- Removed link:\x1b[0m ${activeName}`);
          removedCount++;
        } catch (err) {
          console.error(`\x1b[31mError removing link "${activeName}":\x1b[0m`, err instanceof Error ? err.message : String(err));
        }
      }
    }

    // Create missing links (in finalSkills but not active)
    for (const skillName of finalSkills) {
      const targetPath = path.join(libraryDir, skillName);
      const linkPath = path.join(skillsDir, skillName);

      // Validate physical existence in library
      if (!fs.existsSync(targetPath)) {
        console.error(`\x1b[31mError: Skill "${skillName}" is not found in library directory ${libraryDir}.\x1b[0m`);
        continue;
      }

      const currentLinkTarget = activeSymlinks[skillName];
      if (currentLinkTarget) {
        // Already linked. Verify target matches (robustly check physical paths to handle symlinks/junctions/drives redirects)
        if (safeRealpath(currentLinkTarget) === safeRealpath(targetPath)) {
          unchangedCount++;
          continue;
        }
        // target mismatch: remove and recreate
        try {
          fs.unlinkSync(linkPath);
        } catch (e) {}
      } else if (physicalFolders.includes(skillName)) {
        console.warn(`\x1b[33mWarning: Skipped creating link for "${skillName}" because a physical folder already exists in active folder.\x1b[0m`);
        continue;
      }

      // Create link
      try {
        const isWindows = process.platform === 'win32';
        fs.symlinkSync(targetPath, linkPath, isWindows ? 'junction' : 'dir');
        console.log(`  \x1b[32m+ Created link:\x1b[0m ${skillName}`);
        addedCount++;
      } catch (err) {
        console.error(`\x1b[31mError creating link for "${skillName}":\x1b[0m`, err instanceof Error ? err.message : String(err));
      }
    }

    // Warn if any active/always presets contains a blacklisted skill
    for (const skill of forbiddenSkills) {
      let wasRequested = false;
      for (const preset of [...agentState.activePresets, ...agentState.alwaysPresets]) {
        if (loadSkillsFromPreset(preset).includes(skill)) {
          wasRequested = true;
          break;
        }
      }
      if (wasRequested) {
        console.log(`  \x1b[33m⚠ Skipped blacklisted skill: "${skill}" (defined in neverPresets)\x1b[0m`);
      }

      // Warning if the blacklisted skill still exists as a physical directory
      if (physicalFolders.includes(skill)) {
        console.warn(`  \x1b[33m⚠ Warning: Skill "${skill}" is blacklisted in neverPresets, but a physical folder still exists in active directory: ${path.join(skillsDir, skill)}. Please remove it manually.\x1b[0m`);
      }
    }

    console.log(`\n\x1b[32m✔ Presets synchronized successfully for agent "${key}"!\x1b[0m`);
    console.log(`  Added: ${addedCount} links | Removed: ${removedCount} links | Unchanged: ${unchangedCount} links\n`);
  }
}

/**
 * Command: use / activate / deactivate
 * Usage: skillsman use <preset1> [preset2]...
 * @param {string[]} presetArgs - The arguments passed to the preset use command
 * @param {string[]} [agentKeys] - The specific agents to target (defaults to ['default'])
 * @param {boolean} [isGlobal] - Scope flag
 * @returns {void}
 */
function usePresets(presetArgs, agentKeys = ['default'], isGlobal = IS_TEST_ENV) {
  validateAgentKeys(agentKeys);
  const targetAgents = (!agentKeys || agentKeys.length === 0) ? ['default'] : agentKeys;

  const presetsDir = getPresetsDir();

  if (!presetArgs || presetArgs.length === 0) {
    console.log('\x1b[36m%s\x1b[0m', '=== Synchronizing Presets (State Sync Mode) ===');
    const multiState = loadState(isGlobal);

    for (const rawKey of targetAgents) {
      const canonicalKey = getAgentConfigKey(rawKey);
      if (!multiState[canonicalKey]) {
        multiState[canonicalKey] = getDefaultAgentState();
      }
    }
    saveState(multiState, isGlobal);

    for (const rawKey of targetAgents) {
      const canonicalKey = getAgentConfigKey(rawKey);
      const state = multiState[canonicalKey];
      console.log(`\x1b[90mActive presets in state for "${canonicalKey}":\x1b[0m ${state.activePresets.join(', ') || 'none'}`);
    }

    syncState(isGlobal);
    return;
  }

  const isIncremental = presetArgs.some(arg => arg.startsWith('+') || arg.startsWith('-'));
  const multiState = loadState(isGlobal);

  for (const rawKey of targetAgents) {
    const canonicalKey = getAgentConfigKey(rawKey);
    if (!multiState[canonicalKey]) {
      multiState[canonicalKey] = getDefaultAgentState();
    }
    const state = multiState[canonicalKey];

    if (isIncremental) {
      if (rawKey === targetAgents[0]) {
        console.log('\x1b[36m%s\x1b[0m', '=== Updating Presets (Incremental Mode) ===');
      }

      for (const arg of presetArgs) {
        let isRemove = arg.startsWith('-');
        let presetName = arg;

        if (arg.startsWith('+') || arg.startsWith('-')) {
          presetName = arg.substring(1);
        }

        // Check if preset file physically exists before doing anything
        const presetPath = path.join(presetsDir, `${presetName}.md`);
        if (!fs.existsSync(presetPath)) {
          console.error(`\x1b[31mError: Preset file not found for "${presetName}" at ${presetPath}\x1b[0m`);
          process.exit(1);
        }

        if (isRemove) {
          state.activePresets = state.activePresets.filter(p => p !== presetName);
        } else {
          if (!state.activePresets.includes(presetName)) {
            state.activePresets.push(presetName);
          }
        }
      }
    } else {
      if (rawKey === targetAgents[0]) {
        console.log('\x1b[36m%s\x1b[0m', '=== Applying Presets (Absolute Mode) ===');
      }

      /** @type {string[]} */
      const newActive = [];
      for (const presetName of presetArgs) {
        const presetPath = path.join(presetsDir, `${presetName}.md`);
        if (!fs.existsSync(presetPath)) {
          console.error(`\x1b[31mError: Preset file not found for "${presetName}" at ${presetPath}\x1b[0m`);
          process.exit(1);
        }
        if (!newActive.includes(presetName)) {
          newActive.push(presetName);
        }
      }
      state.activePresets = newActive;
    }
  }

  // Save the updated state
  saveState(multiState, isGlobal);

  for (const rawKey of targetAgents) {
    const canonicalKey = getAgentConfigKey(rawKey);
    const state = multiState[canonicalKey];
    console.log(`\x1b[90mActive presets in state for "${canonicalKey}":\x1b[0m ${state.activePresets.join(', ') || 'none'}`);
  }

  // Synchronize
  syncState(isGlobal);
}

/**
 * Cleans up uninstalled skills from the library and presets, then synchronizes active links.
 * @param {string[]} [removedSkills] - List of removed skills
 * @param {boolean} [isGlobal] - Scope flag
 * @returns {void}
 */
function cleanRemovedSkillsAndPresets(removedSkills = [], isGlobal = IS_TEST_ENV) {
  const libraryDir = getLibraryDir();
  const presetsDir = getPresetsDir();

  if (isGlobal) {
    // In global mode, completely uninstall the physical packages and presets from the system
    for (const skill of removedSkills) {
      // 1. Clean physical library folder
      const skillPath = path.join(libraryDir, skill);
      if (fs.existsSync(skillPath)) {
        fs.rmSync(skillPath, { recursive: true, force: true });
        console.log(`  \x1b[31m- Cleaned physical skill from library:\x1b[0m ${skill}`);
      }

      // 2. Clean preset file
      const presetPath = path.join(presetsDir, `${skill}.md`);
      if (fs.existsSync(presetPath)) {
        fs.unlinkSync(presetPath);
        console.log(`  \x1b[31m- Cleaned obsolete preset:\x1b[0m ${skill}.md`);
      }
    }
  }

  // Deactivate the removed skills from the activePresets of the default agent in the current state
  try {
    const state = loadState(isGlobal);
    const agentState = state['default'] || getDefaultAgentState();
    let stateChanged = false;
    for (const skill of removedSkills) {
      if (agentState.activePresets.includes(skill)) {
        agentState.activePresets = agentState.activePresets.filter(p => p !== skill);
        stateChanged = true;
      }
    }
    if (stateChanged) {
      saveState(state, isGlobal);
    }
  } catch (err) {}

  // 3. Sync junctions to match new state
  syncState(isGlobal);
}

/**
 * Spawns the official "skills" CLI via Node.js with sandboxed XDG environment variables.
 * Automatically triggers post-execution hooks on successful additions/removals.
 * @param {string} command - The command name to execute (e.g. 'add', 'remove')
 * @param {string[]} [args] - The arguments passed to the command
 * @param {boolean} [isGlobal] - Scope flag
 * @returns {void}
 */
function delegateToSkillsCLI(command, args = [], isGlobal = IS_TEST_ENV) {
  const { spawnSync } = require('child_process');
  
  const stateFile = getStateFile(isGlobal);
  const libraryDir = getLibraryDir();
  const xdgStateHome = path.dirname(stateFile);
  const xdgDataHome = path.dirname(libraryDir);

  const skillsHome = path.dirname(xdgDataHome);

  const sandboxedEnv = {
    ...process.env,
    XDG_STATE_HOME: xdgStateHome,
    XDG_DATA_HOME: xdgDataHome,
    HOME: skillsHome,
    USERPROFILE: skillsHome,
    // Align Windows-specific standard paths so the official CLI reads/writes from the same sandboxed layout
    LOCALAPPDATA: xdgStateHome,
    APPDATA: xdgStateHome
  };

  // Pre-execution hook for remove:
  // The official skills CLI only scans real directories (ignores junctions/symlinks).
  // If the user is removing a skill that skillsman has junctioned, we temporarily
  // replace the junction with a real empty directory so the official CLI can find and remove it.
  // This is only required for local mode where skills CLI looks for the active directory.
  if (command === 'remove' && !isGlobal) {
    const skillNames = args.filter(arg => !arg.startsWith('-'));
    for (const skillName of skillNames) {
      const skillsDir = getAgentSkillsDir('default', isGlobal);
      const targetPath = path.join(skillsDir, skillName);
      try {
        if (fs.existsSync(targetPath)) {
          const stat = fs.lstatSync(targetPath);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(targetPath);
            fs.mkdirSync(targetPath, { recursive: true });
            console.log(`[skillsman] Temporarily restored junction as physical folder for removal: ${skillName}`);
          }
        }
      } catch (err) {
        // Ignore and let the delegation handle it
      }
    }
  }

  // Resolve the absolute physical path to the official "skills" CLI package entry point.
  // This completely bypasses npx/network, avoids drive/symlink resolution failures, and is 10x faster.
  let skillsBinPath;
  try {
    const skillsPkgJsonPath = require.resolve('skills/package.json');
    const skillsPkgJson = require(skillsPkgJsonPath);
    const binRelPath = typeof skillsPkgJson.bin === 'string'
      ? skillsPkgJson.bin
      : (skillsPkgJson.bin.skills || skillsPkgJson.bin['skills-cli']);
    skillsBinPath = path.resolve(path.dirname(skillsPkgJsonPath), binRelPath);
  } catch (err) {
    console.error(`\n\x1b[31m✖ Error: Could not resolve official 'skills' package CLI.\x1b[0m`, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const spawnArgs = [skillsBinPath, command, ...args];

  console.log(`\x1b[36m[skillsman] Delegating to official skills package manager...\x1b[0m\n`);

  const result = spawnSync(process.execPath, spawnArgs, {
    env: sandboxedEnv,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    console.error(`\n\x1b[31m✖ Error: skills CLI exited with code ${result.status || 1}\x1b[0m`);
    process.exit(result.status || 1);
  }

  // Post-execution hooks
  if (command === 'add') {
    console.log(`\n\x1b[36m[skillsman] Running post-install collection hook...\x1b[0m`);
    collect(undefined, isGlobal);

    // Automatically activate newly added skill presets
    const skillNames = args.filter(arg => !arg.startsWith('-'));
    if (skillNames.length > 0) {
      const currentLibraryDir = getLibraryDir();
      const libraryItems = fs.existsSync(currentLibraryDir) ? fs.readdirSync(currentLibraryDir) : [];
      const newlyInstalled = [];

      // Check recently modified folders in library
      const now = Date.now();
      for (const item of libraryItems) {
        const itemPath = path.join(currentLibraryDir, item);
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory() && now - stat.mtimeMs < 15000) {
            newlyInstalled.push(item);
          }
        } catch (e) {}
      }

      // Fallback: match by basename
      if (newlyInstalled.length === 0) {
        for (const arg of skillNames) {
          const baseName = path.basename(arg);
          if (libraryItems.includes(baseName)) {
            newlyInstalled.push(baseName);
          } else {
            const match = libraryItems.find(item => item.toLowerCase() === baseName.toLowerCase());
            if (match) newlyInstalled.push(match);
          }
        }
      }

      if (newlyInstalled.length > 0) {
        console.log(`\n\x1b[36m[skillsman] Automatically activating newly installed skill presets: ${newlyInstalled.join(', ')}\x1b[0m`);
        const state = loadState(isGlobal);
        const agentState = state['default'] || getDefaultAgentState();
        for (const name of newlyInstalled) {
          if (!agentState.activePresets.includes(name)) {
            agentState.activePresets.push(name);
          }
        }
        saveState(state, isGlobal);
        syncState(isGlobal);
      }
    }
  } else if (command === 'remove') {
    console.log(`\n\x1b[36m[skillsman] Running post-removal cleanup hook...\x1b[0m`);
    const skillNames = args.filter(arg => !arg.startsWith('-'));
    cleanRemovedSkillsAndPresets(skillNames, isGlobal);
  }
}

module.exports = {
  // Public API
  collect,
  usePresets,
  listPresets,
  showStatus,
  delegateToSkills: delegateToSkillsCLI,

  // Namespace for tests and debugging
  tests: {
    setTestEnv,
    parseFrontmatter,
    resolveFinalSkills,
    loadState,
    saveState,
    loadSkillsFromPresetDirect,
    loadSkillsFromPreset,
    getXdgConfigHome,
    getXdgStateHome,
    getXdgDataHome,
    SUPPORTED_AGENTS,
    getAgentSkillsDir,
    getAgentConfigKey,
    cleanRemovedSkillsAndPresets,
    getPaths: () => ({ 
      AGENTS_DIR, 
      SKILLS_DIR, 
      LIBRARY_DIR: getLibraryDir(), 
      PRESETS_DIR: getPresetsDir(), 
      STATE_FILE: getStateFile(true) 
    })
  }
};
