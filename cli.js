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


/**
 * Delegates the command to the official "skills" CLI via the programmatic skillsman API.
 * @param {string} command - The command name to delegate
 * @param {string[]} [args] - The arguments for the command
 * @returns {void}
 */
function delegateToSkillsCLI(command, args = []) {
  const opts = program.opts();
  skillsman.delegateToSkills(command, args, opts.global);
}

/**
 * CLI Commands Registration (Commander Setup)
 * @returns {void}
 */
function main() {
  program
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version)
    .option('-a, --agent <agent...>', 'Target specific AI agents (space-separated or repeated)')
    .option('-g, --global', 'Operate on the global/user level instead of the local project level');

  // === NATIVE SKILLSMAN PRESET COMMANDS ===

  program
    .command('collect')
    .description('Scan active directories for physical skills, collect them to library, create symlinks and presets')
    .action(() => {
      const opts = program.opts();
      skillsman.collect(opts.agent, opts.global);
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
      const opts = program.opts();
      skillsman.showStatus(opts.agent, opts.global);
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
        const opts = program.opts();
        skillsman.usePresets(presets, opts.agent, opts.global);
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
        const opts = program.opts();
        skillsman.usePresets(presets.map(p => p.startsWith('+') || p.startsWith('-') ? p : '+' + p), opts.agent, opts.global);
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
        const opts = program.opts();
        skillsman.usePresets(presets.map(p => p.startsWith('+') || p.startsWith('-') ? p : '-' + p), opts.agent, opts.global);
      }
    );

  // === DELEGATED ORIGINAL SKILLS COMMANDS ===

  program
    .command('list [args...]')
    .alias('ls')
    .description('List installed skills (delegated to original skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('list', rawArgs);
    });

  program
    .command('add <package> [args...]')
    .alias('a')
    .description('Add a skill package (delegated to original skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('add', rawArgs);
    });

  program
    .command('remove [args...]')
    .alias('rm')
    .description('Remove installed skills (delegated to original skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('remove', rawArgs);
    });

  program
    .command('update [args...]')
    .alias('upgrade')
    .description('Update skills to latest versions (delegated to original skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('update', rawArgs);
    });

  program
    .command('find [args...]')
    .description('Search for skills interactively (delegated to original skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('find', rawArgs);
    });

  program
    .command('init [args...]')
    .description('Initialize a new template skill project (delegated to original skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('init', rawArgs);
    });

  program
    .command('experimental_install [args...]')
    .description('Restore skills from skills-lock.json (delegated to original skills)')
    .allowUnknownOption()
    .action(() => {
      const rawArgs = process.argv.slice(3);
      delegateToSkillsCLI('experimental_install', rawArgs);
    });

  program
    .command('experimental_sync [args...]')
    .description('Sync skills from node_modules into agent directories (delegated to original skills)')
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
