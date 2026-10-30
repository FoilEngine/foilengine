import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CoreRulesParseError,
  compareRuleNumbers,
  fingerprint,
  indexCoreRules,
  normalizeText,
  parentOf,
} from '../src/index.ts';

// Shaped like the text unpdf extracts from the Core Rules PDF.
const SAMPLE = [
  'Riftbound Core Rules',
  'Last Updated: 2026-10-09',
  '000. Golden and Silver Rules',
  '053. Cards refer to themselves in the first person.',
  '053.1. * Units and legends say "I," "me," etc.',
  '103. To play Riftbound, a player must have a Main Deck, a Rune Deck, a Champion Legend, and a number of',
  'Battlefields determined by the Mode of Play.',
  '103.2. 1 Champion Legend',
  '103.2.b. This will dictate the Domain Identity of the deck.',
  '103.2.b.1. Cards included in your deck must abide by your Domain Identity.',
  'Example: A unit reads in part “If [Name] is in your deck, choose 3 different legends.”',
  '103.2.b.1.a. A fifth level exists.',
  '103.10. Ten comes after two.',
  '431. Channel',
  '431.4. Channeling is a Limited Action.',
  '431.4.a. A player Channels two Runes during the Channel Phase on their turn.',
].join('\n');

describe('indexCoreRules', () => {
  const index = indexCoreRules(SAMPLE);

  it('reads the version from the "Last Updated" line', () => {
    expect(index.version).toBe('CR-2026-10-09');
    expect(index.lastUpdated).toBe('2026-10-09');
  });

  it('keeps every rule, in order, with its exact number', () => {
    expect(index.rules.map((rule) => rule.number)).toEqual([
      '000',
      '053',
      '053.1',
      '103',
      '103.2',
      '103.2.b',
      '103.2.b.1',
      '103.2.b.1.a',
      '103.10',
      '431',
      '431.4',
      '431.4.a',
    ]);
    expect(index.ruleCount).toBe(12);
  });

  it('joins continuation lines and examples into the rule text', () => {
    const rule103 = index.rules.find((rule) => rule.number === '103');
    expect(rule103?.text).toBe(
      'To play Riftbound, a player must have a Main Deck, a Rune Deck, a Champion Legend, and a number of Battlefields determined by the Mode of Play.',
    );
    const rule = index.rules.find((r) => r.number === '103.2.b.1');
    expect(rule?.text).toContain('Example: A unit reads in part “If [Name] is in your deck');
  });

  it('does not take a line starting with a digit for a rule', () => {
    expect(index.rules.find((rule) => rule.number === '103.2')?.text).toBe('1 Champion Legend');
  });

  it('records the parent of every rule', () => {
    expect(index.rules.map((rule) => [rule.number, rule.parent])).toContainEqual([
      '103.2.b.1.a',
      '103.2.b.1',
    ]);
    expect(index.rules.find((rule) => rule.number === '000')?.parent).toBeNull();
  });

  it('fingerprints each rule text', () => {
    for (const rule of index.rules) {
      expect(rule.fingerprint).toBe(fingerprint(rule.text));
      expect(rule.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('rejects a text without a "Last Updated" date', () => {
    expect(() => indexCoreRules('000. Golden Rule')).toThrow(CoreRulesParseError);
  });

  it('rejects a text without rules', () => {
    expect(() => indexCoreRules('Last Updated: 2026-10-09\nNothing here.')).toThrow(
      CoreRulesParseError,
    );
  });

  it('rejects rule numbers that go backwards', () => {
    const text = 'Last Updated: 2026-10-09\n104. Setup\n103. Deck';
    expect(() => indexCoreRules(text)).toThrow('Rule 103 comes after 104');
  });

  it('rejects duplicated rule numbers', () => {
    const text = 'Last Updated: 2026-10-09\n103. Deck\n103. Deck again';
    expect(() => indexCoreRules(text)).toThrow('Rule 103 comes after 103');
  });

  it('rejects a sub-rule whose parent is missing', () => {
    const text = 'Last Updated: 2026-10-09\n103. Deck\n103.2.a. Orphan';
    expect(() => indexCoreRules(text)).toThrow('Rule 103.2.a has no parent rule 103.2');
  });
});

describe('fingerprint', () => {
  it('ignores how the PDF wraps lines', () => {
    const words = fc.array(fc.stringMatching(/^[A-Za-z’“”.,]{1,8}$/), {
      minLength: 1,
      maxLength: 30,
    });
    const separator = fc.constantFrom(' ', '  ', '\n', ' \n ', '\t');
    fc.assert(
      fc.property(words, fc.array(separator, { minLength: 30, maxLength: 30 }), (list, seps) => {
        const wrapped = list.map((word, i) => `${word}${seps[i] ?? ' '}`).join('');
        expect(fingerprint(wrapped)).toBe(fingerprint(list.join(' ')));
      }),
    );
  });

  it('changes when a word changes', () => {
    expect(fingerprint('A player Channels two Runes')).not.toBe(
      fingerprint('A player Channels three Runes'),
    );
  });
});

describe('rule numbers', () => {
  it('sort numbers numerically and letters alphabetically', () => {
    const sorted = ['103.10', '103.2.b', '103', '103.2', '103.2.a', '104', '103.2.b.1'].sort(
      compareRuleNumbers,
    );
    expect(sorted).toEqual(['103', '103.2', '103.2.a', '103.2.b', '103.2.b.1', '103.10', '104']);
  });

  it('give the parent of a sub-rule', () => {
    expect(parentOf('103.2.b.1')).toBe('103.2.b');
    expect(parentOf('103')).toBeNull();
  });

  it('normalize whitespace', () => {
    expect(normalizeText('  a \n b\t c  ')).toBe('a b c');
  });
});
