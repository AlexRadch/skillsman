const fs = require('fs');
const path = require('path');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const packagePath = path.join(__dirname, '..', 'package.json');

// Get version from package.json
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = pkg.version;

// Get current date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0];

let changelog = fs.readFileSync(changelogPath, 'utf8');

// Find the ## [Unreleased] header
const target = '## [Unreleased]';
if (!changelog.includes(target)) {
  console.error('Error: "## [Unreleased]" header not found in CHANGELOG.md');
  process.exit(1);
}

// Replace ## [Unreleased] with ## [Unreleased] and the new version + date header below it
const replacement = `## [Unreleased]\n\n## [${version}] - ${today}`;
changelog = changelog.replace(target, replacement);

fs.writeFileSync(changelogPath, changelog, 'utf8');
console.log(`✔ Automatically updated CHANGELOG.md: Added ## [${version}] - ${today}`);
