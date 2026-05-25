const fs = require('fs');
const path = require('path');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const version = process.argv[2];

if (!version) {
  console.error('Error: Version argument is required (e.g., node extract-changelog.js 0.1.0).');
  process.exit(1);
}

const changelog = fs.readFileSync(changelogPath, 'utf8');
const lines = changelog.split('\n');

let recording = false;
const sectionLines = [];

for (const line of lines) {
  if (line.startsWith('## ')) {
    if (recording) {
      // Reached the next version header, stop recording
      break;
    }
    // Normalize header to match (remove spaces and brackets)
    // E.g., "## [0.1.0] - 2026-05-25" -> "##0.1.0-2026-05-25"
    const cleanLine = line.replace(/\s+/g, '').replace(/\[/g, '').replace(/\]/g, '');
    if (cleanLine.startsWith(`##${version}-`) || cleanLine === `##${version}`) {
      recording = true;
      continue;
    }
  }
  if (recording) {
    sectionLines.push(line);
  }
}

const result = sectionLines.join('\n').trim();
if (!result) {
  console.log(`⚠ Warning: Changelog section for version "${version}" is empty. Creating default release notes.`);
  const defaultNotes = `## Release ${version}\n\nNo detailed release notes provided for this version. See [CHANGELOG.md](https://github.com/AlexRadch/skillsman/blob/main/CHANGELOG.md) for full history.`;
  fs.writeFileSync(path.join(__dirname, '..', 'RELEASE_NOTES.md'), defaultNotes, 'utf8');
} else {
  fs.writeFileSync(path.join(__dirname, '..', 'RELEASE_NOTES.md'), result, 'utf8');
  console.log(`✔ Successfully extracted release notes for version ${version} to RELEASE_NOTES.md`);
}

