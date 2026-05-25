#!/usr/bin/env node
// @ts-check

/**
 * skillsman - CLI entry point and integration wrapper
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');
const { program } = require('commander');
const matter = require('gray-matter');
const skillsman = require('./index.js');
const pkg = require('./package.json');

// Self-healing link check
ensureSkillsLink();

/**
 * Automatic Self-Healing link check (runs in under 1.5ms)
 * @returns {void}
 */
function ensureSkillsLink() {
  try {
    const globalDir = process.env.SKILLSMAN_SHIM_TEST_DIR || (process.platform === 'win32'
      ? (process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : null)
      : path.dirname(process.execPath));

    if (!globalDir || !fs.existsSync(globalDir)) return;

    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const files = [
        { src: 'skillsman', dest: 'skills' },
        { src: 'skillsman.cmd', dest: 'skills.cmd' },
        { src: 'skillsman.ps1', dest: 'skills.ps1' },
        { src: 'skillsman', dest: 'add-skill' },
        { src: 'skillsman.cmd', dest: 'add-skill.cmd' },
        { src: 'skillsman.ps1', dest: 'add-skill.ps1' }
      ];

      for (const { src, dest } of files) {
        const srcPath = path.join(globalDir, src);
        const destPath = path.join(globalDir, dest);

        if (fs.existsSync(srcPath)) {
          let needsUpdate = true;
          if (fs.existsSync(destPath)) {
            const currentContent = fs.readFileSync(destPath, 'utf8');
            if (currentContent.includes('cli.js')) {
              needsUpdate = false;
            }
          }

          if (needsUpdate) {
            let content = fs.readFileSync(srcPath, 'utf8');
            // Re-route NPM's target file from index.js to cli.js
            content = content.replace('index.js', 'cli.js');
            fs.writeFileSync(destPath, content, 'utf8');
          }
        }
      }
    } else {
      const links = ['skills', 'add-skill'];
      const targetPath = path.resolve(__dirname, 'cli.js');

      for (const link of links) {
        const linkPath = path.join(globalDir, link);
        let needsUpdate = true;
        if (fs.existsSync(linkPath)) {
          try {
            const currentTarget = fs.readlinkSync(linkPath);
            if (path.resolve(currentTarget) === targetPath) {
              needsUpdate = false;
            }
          } catch (e) {}
        }

        if (needsUpdate) {
          try { fs.unlinkSync(linkPath); } catch (e) {}
          fs.symlinkSync(targetPath, linkPath);
        }
      }
    }
  } catch (err) {
    // Fail-silent on restricted permissions
  }
}

/**
 * Delegates the command to the official "skills" CLI via the programmatic skillsman API.
 * @param {string} command - The command name to delegate
 * @param {string[]} [args] - The arguments for the command
 * @returns {void}
 */
function delegateToSkillsCLI(command, args = []) {
  skillsman.delegate(command, args);
}

/**
 * CLI Commands Registration (Commander Setup)
 * @returns {void}
 */
function main() {
  program
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version);

  // === NATIVE SKILLSMAN PRESET COMMANDS ===

  program
    .command('collect')
    .description('Scan ~/.agents/skills/ for physical skills, collect them to library, create symlinks and presets')
    .action(() => {
      skillsman.collect();
    });

  program
    .command('presets')
    .alias('ps')
    .description('List all available presets')
    .action(() => {
      skillsman.listPresets();
    });

  program
    .command('status')
    .description('Show active presets and current projection links')
    .action(() => {
      skillsman.showStatus();
    });

  program
    .command('use')
    .argument('[presets...]')
    .description('Activate presets (e.g. use dev planning). Call without arguments to synchronize current state')
    .action(
      /**
       * @param {string[]} presets
       */
      (presets) => {
        if (!presets || presets.length === 0) {
          skillsman.syncState();
        } else {
          skillsman.usePresets(presets);
        }
      }
    );

  program
    .command('activate <presets...>')
    .description('Incrementally add presets to current active ones')
    .action(
      /**
       * @param {string[]} presets
       */
      (presets) => {
        skillsman.usePresets(presets.map(p => p.startsWith('+') || p.startsWith('-') ? p : '+' + p));
      }
    );

  program
    .command('deactivate <presets...>')
    .description('Incrementally remove presets from current active ones')
    .action(
      /**
       * @param {string[]} presets
       */
      (presets) => {
        skillsman.usePresets(presets.map(p => p.startsWith('+') || p.startsWith('-') ? p : '-' + p));
      }
    );

  // === DELEGATED NPX SKILLS COMMANDS ===

  program
    .command('list [args...]')
    .alias('ls')
    .description('List installed skills (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('list', rawArgs);
    });

  program
    .command('add <package> [args...]')
    .alias('a')
    .description('Add a skill package (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('add', rawArgs);
    });

  program
    .command('remove [args...]')
    .alias('rm')
    .description('Remove installed skills (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('remove', rawArgs);
    });

  program
    .command('update [args...]')
    .alias('upgrade')
    .description('Update skills to latest versions (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('update', rawArgs);
    });

  program
    .command('find [args...]')
    .description('Search for skills interactively (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('find', rawArgs);
    });

  program
    .command('init [args...]')
    .description('Initialize a new template skill project (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('init', rawArgs);
    });

  program
    .command('experimental_install [args...]')
    .description('Restore skills from skills-lock.json (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('experimental_install', rawArgs);
    });

  program
    .command('experimental_sync [args...]')
    .description('Sync skills from node_modules into agent directories (delegated to npx skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('experimental_sync', rawArgs);
    });

  // Default output help if no command passed
  if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
  }

  program.parse(process.argv);
}

main();
