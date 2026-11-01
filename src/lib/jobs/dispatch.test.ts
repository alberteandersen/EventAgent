import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const runJobInline = vi.fn();
vi.mock('./run', () => ({
  JOB_KINDS: { 'website.build': { failure: 'Juno kunne ikke designe siden.' } },
  runJobInline: (...args: unknown[]) => runJobInline(...args),
}));
vi.mock('@/lib/gemini/log', () => ({ logAgentError: vi.fn() }));

const inserted: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: 'job-1' }, error: null }) }) };
      },
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({}) };
      },
    }),
  }),
}));

import { dispatchJob, BACKGROUND_FUNCTION_PATH } from './dispatch';

const job = { eventId: 'e1', userId: 'u1', payload: { styleDirection: 'lyst' } };
const request = new Request('https://kalas.example/api/website/design', { method: 'POST' });

beforeEach(() => {
  inserted.length = 0;
  updates.length = 0;
  runJobInline.mockReset();
  process.env.CRON_SECRET = 's3cret';
});
afterEach(() => {
  delete process.env.JOBS_BACKGROUND;
  vi.unstubAllGlobals();
});

describe('dispatchJob, locally', () => {
  it('runs the work in the request and answers with its result', async () => {
    runJobInline.mockResolvedValue({ designId: 'd1' });
    const res = await dispatchJob(request, 'website.build', job);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ designId: 'd1' });
    expect(inserted).toHaveLength(0);
  });

  it('answers with the couple-facing failure, not the error', async () => {
    runJobInline.mockRejectedValue(new Error('gemini 500 stack…'));
    const res = await dispatchJob(request, 'website.build', job);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Juno kunne ikke designe siden.' });
  });
});

describe('dispatchJob, on Netlify', () => {
  beforeEach(() => { process.env.JOBS_BACKGROUND = 'netlify'; });

  it('records the job, hands it to the background function and answers 202', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await dispatchJob(request, 'website.build', job);

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: 'job-1' });
    expect(inserted).toEqual([{ event_id: 'e1', user_id: 'u1', kind: 'website.build', payload: { styleDirection: 'lyst' } }]);
    expect(runJobInline).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(`https://kalas.example${BACKGROUND_FUNCTION_PATH}`);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer s3cret');
    expect(JSON.parse(String(init.body))).toEqual({ jobId: 'job-1' });
  });

  it('marks the job failed when the function cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const res = await dispatchJob(request, 'website.build', job);
    expect(res.status).toBe(502);
    expect(updates[0]).toMatchObject({ status: 'failed', error: 'Juno kunne ikke designe siden.' });
  });
});
