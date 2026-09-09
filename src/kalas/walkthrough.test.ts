import { describe, it, expect } from 'vitest';
import { armTour } from './walkthrough';

describe('armTour', () => {
  it('arms a couple who has just finished onboarding', () => {
    expect(armTour({ param: null, progress: '0', done: null })).toEqual({ active: true });
  });

  it('resumes them mid-tour', () => {
    expect(armTour({ param: null, progress: '4', done: null })).toEqual({ active: true });
  });

  it('does not arm when there is nothing to resume', () => {
    expect(armTour({ param: null, progress: null, done: null })).toEqual({ active: false });
  });

  it('stays off once they have been through it — even if progress lingers', () => {
    // This is the ring: any leftover progress key re-armed the tour, so
    // finishing it and coming back started it over.
    expect(armTour({ param: null, progress: '7', done: '1' })).toEqual({ active: false });
    expect(armTour({ param: null, progress: '0', done: '1' })).toEqual({ active: false });
  });

  it('replays on an explicit request, clearing the done marker', () => {
    expect(armTour({ param: '1', progress: null, done: '1' })).toEqual({
      active: true, setProgress: '0', clearDone: true, stripParam: true,
    });
  });

  it('strips the param so a reload does not replay it again', () => {
    // Left in the address bar it re-armed on every refresh — the other ring.
    expect(armTour({ param: '1', progress: '3', done: null }).stripParam).toBe(true);
  });

  it('ignores a param that is not exactly "1"', () => {
    expect(armTour({ param: '0', progress: null, done: '1' })).toEqual({ active: false });
  });
});
