import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { EN } from './strings';

/* The dictionary and the code have to agree both ways: every string the UI
   passes to t() has an English entry, and every entry is still said
   somewhere. Without this the file drifted to a fifth dead keys, and new
   copy shipped half-translated. */

const SRC = join(__dirname, '..');
const DICTIONARY = join(__dirname, 'strings.ts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    // Tests are not the UI: a key only a test says is unused, and i18n's own
    // test deliberately asks for one that does not exist.
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && path !== DICTIONARY ? [path] : [];
  });
}

/** Which arguments of each translating call are dictionary keys. */
const KEY_ARGS: Record<string, number[]> = { t: [0], tn: [1, 2], translate: [1], translateCount: [2, 3] };

const literals = new Set<string>();
const translated = new Map<string, string>(); // key → first file that asks for it

for (const file of sourceFiles(SRC)) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literals.add(node.text);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      for (const i of KEY_ARGS[node.expression.text] ?? []) {
        const arg = node.arguments[i];
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && !translated.has(arg.text)) {
          translated.set(arg.text, relative(SRC, file));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

describe('strings', () => {
  it('has an English entry for every string the UI translates', () => {
    const missing = [...translated].filter(([key]) => !(key in EN)).map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('has no entries the code no longer says', () => {
    const unused = Object.keys(EN).filter((key) => !literals.has(key));
    expect(unused).toEqual([]);
  });
});
