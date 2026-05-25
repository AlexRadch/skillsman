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
let LIBRARY_DIR = path.join(getXdgDataHome(), 'skillsman', 'skills');
let PRESETS_DIR = path.join(getXdgConfigHome(), 'skillsman', 'presets');
let STATE_FILE = path.join(getXdgStateHome(), 'skillsman', 'state.json');

/**
 * Configure test environment paths (used by unit and integration tests)
 * @param {string} sandboxPath - The sandbox root path
 * @returns {void}
 */
function setTestEnv(sandboxPath) {
  AGENTS_DIR = sandboxPath;
  SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
  
  // Set sandboxed XDG folders under sandboxPath
  LIBRARY_DIR = path.join(sandboxPath, 'data', 'skillsman', 'skills');
  PRESETS_DIR = path.join(sandboxPath, 'config', 'skillsman', 'presets');
  STATE_FILE = path.join(sandboxPath, 'state', 'skillsman', 'state.json');
}

/**
 * Returns the default state structure
 * @returns {{ activePresets: string[], alwaysPresets: string[], neverPresets: string[] }}
 */
function getDefaultState() {
  return {
    activePresets: [],
    alwaysPresets: ['always'],
    neverPresets: ['never']
  };
}

/**
 * Loads the state from state.json
 * @returns {{ activePresets: string[], alwaysPresets: string[], neverPresets: string[] }}
 */
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return getDefaultState();
  }
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    const state = JSON.parse(data);
    if (!Array.isArray(state.activePresets)) state.activePresets = [];
    if (!Array.isArray(state.alwaysPresets)) state.alwaysPresets = ['always'];
    if (!Array.isArray(state.neverPresets)) state.neverPresets = ['never'];
    return state;
  } catch (err) {
    return getDefaultState();
  }
}

/**
 * Saves the state to state.json
 * @param {{ activePresets: string[], alwaysPresets: string[], neverPresets: string[] }} state - The state object to save
 * @returns {void}
 */
function saveState(state) {
  try {
    const stateDir = path.dirname(STATE_FILE);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error(`\x1b[31mError saving state to state.json:\x1b[0m`, err instanceof Error ? err.message : String(err));
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
  const presetPath = path.join(PRESETS_DIR, `${presetName}.md`);
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

  const presetPath = path.join(PRESETS_DIR, `${presetName}.md`);
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

    const presetPath = path.join(PRESETS_DIR, `${presetName}.md`);
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
 * existing physical skill directories from ~/.agents/skills/ into the library, replacing them with symlinks
 * and generating corresponding skillsman presets.
 * @returns {void}
 */
function collect() {
  console.log('\x1b[36m%s\x1b[0m', '=== Collecting Skills and Initializing Environment ===');

  // 1. Gracefully generate folders in their respective XDG config, state, and data locations
  if (!fs.existsSync(LIBRARY_DIR)) {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    console.log(`\x1b[32m✔\x1b[0m Created library folder: ${LIBRARY_DIR}`);
  }

  if (!fs.existsSync(PRESETS_DIR)) {
    fs.mkdirSync(PRESETS_DIR, { recursive: true });
    console.log(`\x1b[32m✔\x1b[0m Created presets folder: ${PRESETS_DIR}`);
  }

  const stateFileDir = path.dirname(STATE_FILE);
  if (!fs.existsSync(stateFileDir)) {
    fs.mkdirSync(stateFileDir, { recursive: true });
  }

  if (!fs.existsSync(STATE_FILE)) {
    const defaultState = getDefaultState();
    saveState(defaultState);
    console.log(`\x1b[32m✔\x1b[0m Initialized state file: ${STATE_FILE}`);
  }

  // 2. Scan active projection directory for any physical skill folders to collect/migrate
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  const items = fs.readdirSync(SKILLS_DIR);
  let migratedCount = 0;

  for (const item of items) {
    const itemPath = path.join(SKILLS_DIR, item);
    const stat = fs.lstatSync(itemPath);

    // If it is a physical directory (not a symlink/junction), we migrate it!
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      console.log(`  \x1b[33m⚡ Found physical folder to collect:\x1b[0m ${item}`);

      const targetPath = path.join(LIBRARY_DIR, item);

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
      const presetPath = path.join(PRESETS_DIR, `${item}.md`);
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

      // Create symlink junction back in SKILLS_DIR
      const isWindows = process.platform === 'win32';
      fs.symlinkSync(targetPath, itemPath, isWindows ? 'junction' : 'dir');
      console.log(`  \x1b[32m✔\x1b[0m Replaced with junction: ${item} -> ${targetPath}`);
      
      migratedCount++;
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
  
  if (!fs.existsSync(PRESETS_DIR)) {
    console.log('\x1b[90mPresets directory does not exist. Run "skillsman init" first.\x1b[0m');
    return;
  }

  const files = fs.readdirSync(PRESETS_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  if (mdFiles.length === 0) {
    console.log('\x1b[90mNo presets found in presets folder.\x1b[0m');
    return;
  }

  for (const file of mdFiles) {
    const filePath = path.join(PRESETS_DIR, file);
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
 * @returns {void}
 */
function showStatus() {
  const state = loadState();

  console.log('\x1b[36m%s\x1b[0m', '=== Current Preset State ===');
  console.log(`  \x1b[1mActive Presets:\x1b[0m   ${state.activePresets.join(', ') || '\x1b[90mnone\x1b[0m'}`);
  console.log(`  \x1b[1mAlways Presets:\x1b[0m   ${state.alwaysPresets.join(', ')}`);
  console.log(`  \x1b[1mNever Presets:\x1b[0m    ${state.neverPresets.join(', ')}`);

  console.log('\n\x1b[36m%s\x1b[0m', '=== Current Link Status ===');

  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('\x1b[90mActive skills directory does not exist.\x1b[0m');
    return;
  }

  const items = fs.readdirSync(SKILLS_DIR);
  if (items.length === 0) {
    console.log('\x1b[90mNo active skill links found.\x1b[0m');
    console.log('\x1b[37mUse "skillsman use <preset>" to activate some skills.\x1b[0m');
    return;
  }

  for (const item of items) {
    const itemPath = path.join(SKILLS_DIR, item);
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
}

/**
 * Synchronizes the active symlinks to match the current state.json and presets
 * @returns {void}
 */
function syncState() {
  console.log('\x1b[36m%s\x1b[0m', '=== Synchronizing active skills with state.json ===');

  const state = loadState();

  // Ensure libraries and presets exist
  if (!fs.existsSync(PRESETS_DIR) || !fs.existsSync(LIBRARY_DIR)) {
    console.error('\x1b[31mError: Environment not initialized. Please run "skillsman init" first.\x1b[0m');
    process.exit(1);
  }

  // Make sure active skills directory exists
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  // 1. Resolve final skills list using DFS recursion
  const { finalSkills, forbiddenSkills } = resolveFinalSkills(state);

  // 2. Read currently active symlinks in SKILLS_DIR
  /** @type {Record<string, string|null>} */
  const activeSymlinks = {};
  /** @type {string[]} */
  const physicalFolders = [];
  if (fs.existsSync(SKILLS_DIR)) {
    const items = fs.readdirSync(SKILLS_DIR);
    for (const item of items) {
      const itemPath = path.join(SKILLS_DIR, item);
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
      const linkPath = path.join(SKILLS_DIR, activeName);
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
    const targetPath = path.join(LIBRARY_DIR, skillName);
    const linkPath = path.join(SKILLS_DIR, skillName);

    // Validate physical existence in library
    if (!fs.existsSync(targetPath)) {
      console.error(`\x1b[31mError: Skill "${skillName}" is not found in library directory ${LIBRARY_DIR}.\x1b[0m`);
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
    for (const preset of [...state.activePresets, ...state.alwaysPresets]) {
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
      console.warn(`  \x1b[33m⚠ Warning: Skill "${skill}" is blacklisted in neverPresets, but a physical folder still exists in active directory: ${path.join(SKILLS_DIR, skill)}. Please remove it manually.\x1b[0m`);
    }
  }

  console.log(`\n\x1b[32m✔ Presets synchronized successfully!\x1b[0m`);
  console.log(`  Added: ${addedCount} links | Removed: ${removedCount} links | Unchanged: ${unchangedCount} links`);
}

/**
 * Command: use / activate / deactivate
 * Usage: skillsman use <preset1> [preset2]...
 * @param {string[]} presetArgs - The arguments passed to the preset use command
 * @returns {void}
 */
function usePresets(presetArgs) {
  const isIncremental = presetArgs.some(arg => arg.startsWith('+') || arg.startsWith('-'));

  const state = loadState();

  if (isIncremental) {
    console.log('\x1b[36m%s\x1b[0m', '=== Updating Presets (Incremental Mode) ===');

    for (const arg of presetArgs) {
      let isRemove = arg.startsWith('-');
      let presetName = arg;

      if (arg.startsWith('+') || arg.startsWith('-')) {
        presetName = arg.substring(1);
      }

      // Check if preset file physically exists before doing anything
      const presetPath = path.join(PRESETS_DIR, `${presetName}.md`);
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
    console.log('\x1b[36m%s\x1b[0m', '=== Applying Presets (Absolute Mode) ===');

    /** @type {string[]} */
    const newActive = [];
    for (const presetName of presetArgs) {
      const presetPath = path.join(PRESETS_DIR, `${presetName}.md`);
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

  // Save the updated state
  saveState(state);
  console.log(`\x1b[90mActive presets in state:\x1b[0m ${state.activePresets.join(', ') || 'none'}`);

  // Synchronize
  syncState();
}

/**
 * Cleans up uninstalled skills from the library and presets, then synchronizes active links.
 * @param {string[]} [removedSkills] - List of removed skills
 * @returns {void}
 */
function cleanRemovedSkillsAndPresets(removedSkills = []) {
  for (const skill of removedSkills) {
    // 1. Clean physical library folder
    const skillPath = path.join(LIBRARY_DIR, skill);
    if (fs.existsSync(skillPath)) {
      fs.rmSync(skillPath, { recursive: true, force: true });
      console.log(`  \x1b[31m- Cleaned physical skill from library:\x1b[0m ${skill}`);
    }

    // 2. Clean preset file
    const presetPath = path.join(PRESETS_DIR, `${skill}.md`);
    if (fs.existsSync(presetPath)) {
      fs.unlinkSync(presetPath);
      console.log(`  \x1b[31m- Cleaned obsolete preset:\x1b[0m ${skill}.md`);
    }
  }

  // 3. Sync junctions to match new state
  syncState();
}

/**
 * Spawns the official "skills" CLI via Node.js with sandboxed XDG environment variables.
 * Automatically triggers post-execution hooks on successful additions/removals.
 * @param {string} command - The command name to execute (e.g. 'add', 'remove')
 * @param {string[]} [args] - The arguments passed to the command
 * @returns {void}
 */
function delegateToSkillsCLI(command, args = []) {
  const { spawnSync } = require('child_process');
  
  const xdgStateHome = path.dirname(STATE_FILE);
  const xdgDataHome = path.dirname(LIBRARY_DIR);

  const sandboxedEnv = {
    ...process.env,
    XDG_STATE_HOME: xdgStateHome,
    XDG_DATA_HOME: xdgDataHome,
    // Align Windows-specific standard paths so the official CLI reads/writes from the same sandboxed layout
    LOCALAPPDATA: xdgStateHome,
    APPDATA: xdgStateHome
  };

  // Pre-execution hook for remove:
  // The official skills CLI only scans real directories (ignores junctions/symlinks).
  // If the user is removing a skill that skillsman has junctioned, we temporarily
  // replace the junction with a real empty directory so the official CLI can find and remove it.
  if (command === 'remove') {
    const skillNames = args.filter(arg => !arg.startsWith('-'));
    for (const skillName of skillNames) {
      const targetPath = path.join(SKILLS_DIR, skillName);
      try {
        if (fs.existsSync(targetPath)) {
          const stat = fs.lstatSync(targetPath);
          if (stat.isSymbolicLink() || stat.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
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
    collect();
  } else if (command === 'remove') {
    console.log(`\n\x1b[36m[skillsman] Running post-removal cleanup hook...\x1b[0m`);
    const skillNames = args.filter(arg => !arg.startsWith('-'));
    cleanRemovedSkillsAndPresets(skillNames);
  }
}

module.exports = {
  setTestEnv,
  collect,
  usePresets,
  syncState,
  listPresets,
  showStatus,
  parseFrontmatter,
  resolveFinalSkills,
  loadState,
  saveState,
  loadSkillsFromPresetDirect,
  loadSkillsFromPreset,
  getXdgConfigHome,
  getXdgStateHome,
  getXdgDataHome,
  delegate: delegateToSkillsCLI,
  cleanRemovedSkillsAndPresets,
  getPaths: () => ({ AGENTS_DIR, SKILLS_DIR, LIBRARY_DIR, PRESETS_DIR, STATE_FILE })
};
