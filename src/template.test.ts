import { describe, expect, it } from 'vitest';

import { findClosingBrace, singleTemplateCode, splitTemplate } from './template';

describe('template parsing', () => {
  it('findClosingBrace skips braces inside strings and template literals', () => {
    const text = "${ x ? '}' : `a${ {b: 1}.b }` }";
    expect(findClosingBrace(text, 1)).toBe(text.length - 1);
  });

  it('findClosingBrace returns -1 for an unclosed brace', () => {
    expect(findClosingBrace('${ a', 1)).toBe(-1);
    expect(findClosingBrace("${ 'unterminated }", 1)).toBe(-1);
  });

  it('singleTemplateCode accepts one template, including object literals and blocks', () => {
    expect(singleTemplateCode('${VAR}')).toBe('VAR');
    expect(singleTemplateCode('${ {a: 1} }')).toBe(' {a: 1} ');
    expect(singleTemplateCode('${ let x = 1; if (x) { x++; } x }')).toBe(' let x = 1; if (x) { x++; } x ');
  });

  it('singleTemplateCode ignores surrounding whitespace from YAML block scalars', () => {
    expect(singleTemplateCode('${VAR}\n')).toBe('VAR');
  });

  it('singleTemplateCode rejects strings that are not exactly one template', () => {
    expect(singleTemplateCode('${a} / ${b}')).toBeUndefined();
    expect(singleTemplateCode('${a}${b}')).toBeUndefined();
    expect(singleTemplateCode('state = ${a}')).toBeUndefined();
    expect(singleTemplateCode('plain')).toBeUndefined();
  });

  it('splitTemplate separates text and code parts', () => {
    expect(splitTemplate('sensor.${model}_pv_${n}')).toEqual([
      { kind: 'text', value: 'sensor.' },
      { kind: 'code', value: 'model' },
      { kind: 'text', value: '_pv_' },
      { kind: 'code', value: 'n' },
    ]);
  });

  it('splitTemplate keeps an unterminated template as literal text', () => {
    expect(splitTemplate('a ${b} c ${d')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'code', value: 'b' },
      { kind: 'text', value: ' c ${d' },
    ]);
  });
});
