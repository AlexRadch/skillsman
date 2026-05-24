const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../../index');

describe('Frontmatter Parser Unit Tests', () => {
  it('should parse standard YAML frontmatter correctly', () => {
    const standardInput = `---
name: dev
description: "Разработка кода"
skills:
  - playwright-best-practices
  - brainstorming
---
# Body Content Here`;

    const standardRes = parseFrontmatter(standardInput);
    assert.strictEqual(standardRes.data.name, 'dev');
    assert.strictEqual(standardRes.data.description, 'Разработка кода');
    assert.deepStrictEqual(standardRes.data.skills, ['playwright-best-practices', 'brainstorming']);
    assert.strictEqual(standardRes.content.trim(), '# Body Content Here');
  });

  it('should parse frontmatter with single-quoted or unquoted string values', () => {
    const quotesInput = `---
name: 'marketing-test'
description: Single quotes test
skills: []
presets:
  - circleA
---`;
    const quotesRes = parseFrontmatter(quotesInput);
    assert.strictEqual(quotesRes.data.name, 'marketing-test');
    assert.strictEqual(quotesRes.data.description, 'Single quotes test');
    assert.deepStrictEqual(quotesRes.data.skills, []);
    assert.deepStrictEqual(quotesRes.data.presets, ['circleA']);
  });

  it('should return empty data when no frontmatter is present', () => {
    const plainText = `# No Frontmatter at all`;
    const plainRes = parseFrontmatter(plainText);
    assert.deepStrictEqual(plainRes.data, {});
    assert.strictEqual(plainRes.content, plainText);
  });
});
