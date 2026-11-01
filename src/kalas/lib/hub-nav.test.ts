import { describe, expect, it } from 'vitest';
import { migrateSavedScreen } from './hub-nav';

describe('migrateSavedScreen', () => {
  it('reopens a page that still exists', () => {
    expect(migrateSavedScreen('budget')).toBe('budget');
    expect(migrateSavedScreen('team')).toBe('team');
  });

  it('opens Hjem for anything that is not a page any more', () => {
    // A tab left on a removed screen would otherwise render nothing at all.
    expect(migrateSavedScreen('inspiration')).toBeNull();
    expect(migrateSavedScreen('juno')).toBeNull();
    expect(migrateSavedScreen('no-such-screen')).toBeNull();
    expect(migrateSavedScreen(null)).toBeNull();
  });
});
