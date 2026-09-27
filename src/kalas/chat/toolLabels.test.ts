import { describe, expect, it } from 'vitest';
import { functionDeclarations } from '@/lib/gemini/tools';
import { EN } from '../strings';
import { TOOL_LABELS, toolLabel } from './toolLabels';

describe('tool labels', () => {
  it('names every tool Ava can call', () => {
    const missing = functionDeclarations.map((d) => d.name!).filter((n) => !TOOL_LABELS[n]);
    expect(missing).toEqual([]);
  });

  it('has an English translation for every label', () => {
    const untranslated = Object.values(TOOL_LABELS).map((l) => l.label).filter((l) => !EN[l]);
    expect(untranslated).toEqual([]);
  });

  it('shows the argument that says what the tool was about', () => {
    expect(toolLabel('search_venues', { category: 'photographer' }).detail).toBe('photographer');
    expect(toolLabel('add_guests', { guests: [{}, {}, {}] }).detail).toBe('3');
    expect(toolLabel('add_guests', {}).detail).toBeUndefined();
  });

  it('falls back to a readable name for a tool it does not know', () => {
    const l = toolLabel('plan_honeymoon', {});
    expect(l.label).toBe('plan honeymoon');
    expect(l.known).toBe(false);
  });
});
