import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpintax, spinText, hydrateVariables, generateVariations } from '../src/utils/spintax.js';

test('Spintax Parser - Simple Choice', () => {
  const template = '{Hello|Hi|Hey} world';
  const spun = spinText(template);
  assert.match(spun, /^(Hello|Hi|Hey) world$/);
});

test('Spintax Parser - Nested Braces', () => {
  const template = '{Hi|{Hey|Greetings|Hello}} there';
  for (let i = 0; i < 20; i++) {
    const spun = spinText(template);
    assert.match(spun, /^(Hi|Hey|Greetings|Hello) there$/);
  }
});

test('Variable Hydration - Basic tags', () => {
  const text = 'Hello {{name}}, welcome to {{company}}!';
  const hydrated = hydrateVariables(text, { name: 'John Doe', company: 'Acme Corp' });
  assert.equal(hydrated, 'Hello John Doe, welcome to Acme Corp!');
});

test('Variable Hydration - Case-insensitive & fallback syntax', () => {
  const text = 'Hi {{NAME}}, your title is {{role|Leader}} at {{COMPANY}}';
  const hydrated = hydrateVariables(text, { name: 'Sarah', company: 'Starlight' });
  assert.equal(hydrated, 'Hi Sarah, your title is Leader at Starlight');
});

test('Full parseSpintax integration', () => {
  const template = '{Hi|Hello|Hey} {{name}}, hope things are {great|productive} at {{company}}!';
  const result = parseSpintax(template, { name: 'Devon', company: 'Apex Inc' });
  assert.match(result, /^(Hi|Hello|Hey) Devon, hope things are (great|productive) at Apex Inc!$/);
});

test('generateVariations produces unique variations', () => {
  const template = '{Hi|Hello|Greetings|Hey} {{name}}, {let\'s talk|quick question|checking in} about {{company}}!';
  const variations = generateVariations(template, { name: 'David', company: 'Google' }, 4);
  assert.ok(variations.length > 1);
  assert.ok(variations.every((v) => v.includes('David') && v.includes('Google')));
});
