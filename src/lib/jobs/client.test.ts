import { afterEach, describe, it, expect, vi } from 'vitest';
import { settleJob } from './client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('settleJob', () => {
  it('takes a finished answer as it is', async () => {
    expect(await settleJob(json({ designId: 'd1' }))).toEqual({ ok: true, result: { designId: 'd1' } });
    expect(await settleJob(json({ error: 'Nope' }, 502))).toEqual({ ok: false, error: 'Nope' });
  });

  it('waits out a background job, through a dropped poll, until it is done', async () => {
    vi.useFakeTimers();
    const polls = [
      json({ status: 'queued' }),
      new Response('', { status: 500 }),
      json({ status: 'running' }),
      json({ status: 'done', result: { designId: 'd2' } }),
    ];
    const fetchMock = vi.fn(async () => polls.shift()!);
    vi.stubGlobal('fetch', fetchMock);

    const pending = settleJob(json({ jobId: 'j1' }, 202));
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ ok: true, result: { designId: 'd2' } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/j1');
  });

  it("passes on the job's own failure for the couple", async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => json({ status: 'failed', error: 'Ava kunne ikke' })));
    const pending = settleJob(json({ jobId: 'j2' }, 202));
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ ok: false, error: 'Ava kunne ikke' });
  });
});
