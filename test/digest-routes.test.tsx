import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
let savedMarker: string | undefined;

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

const line = (job: string, status: string, owner: string | null, at: string, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

const write = (night: string, lines: string[]) => writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n'));

// Job names in the page's row order; marked rows carry a "! " text cue.
const pageJobs = (html: string): string[] =>
  [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => (m[1] ?? '').replace(/^! /, ''));

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  savedMarker = process.env.LANE_MARKER;
  process.env.LANE_MARKER = 'TEST-MARKER';
});
afterEach(() => {
  if (savedMarker === undefined) delete process.env.LANE_MARKER;
  else process.env.LANE_MARKER = savedMarker;
});

describe('digest routes', () => {
  it('renders a normal night; page and JSON agree on jobs and order', async () => {
    write('2026-10-01', [
      line('zeta-sync', 'ok', 'anna', '2026-10-01T01:00:00+01:00'),
      line('alpha-backup', 'retry', 'bo', '2026-10-01T01:10:00+01:00', 'timeout'),
      line('alpha-backup', 'retry', 'bo', '2026-10-01T01:11:00+01:00', 'timeout'),
      line('alpha-backup', 'retry', 'bo', '2026-10-01T01:12:00+01:00', 'timeout'),
      line('alpha-backup', 'ok', 'bo', '2026-10-01T01:13:00+01:00'),
      line('mid-report', 'fail', 'cy', '2026-10-01T02:00:00+01:00', 'boom'),
      line('orphan-job', 'ok', null, '2026-10-01T03:00:00+01:00'),
    ]);
    const res = await app().request('/digest/2026-10-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('digest · 2026-10-01');
    expect(html).toContain('! alpha-backup');
    expect(html).toContain('! mid-report');
    expect(html).toContain('ok · 3 retries');
    expect(html).toContain('boom');
    expect(html.match(/class="warn"/g)).toHaveLength(2);
    expect(html).toMatch(/<td>orphan-job<\/td><td>—<\/td>/);
    expect(html).toMatch(/<tr><td>zeta-sync<\/td>/);

    const api = await app().request('/api/digest/2026-10-01');
    expect(api.status).toBe(200);
    const data = (await api.json()) as Night;
    expect(data.rows.map((r) => r.job)).toEqual(['alpha-backup', 'mid-report', 'orphan-job', 'zeta-sync']);
    expect(pageJobs(html)).toEqual(data.rows.map((r) => r.job));
    expect(data.rows.find((r) => r.job === 'orphan-job')?.owner).toBeNull();
    expect(data.badLines).toBe(0);
  });

  it('404s for both when the night has no file', async () => {
    const page = await app().request('/digest/2026-10-02');
    expect(page.status).toBe(404);
    expect(await page.text()).toContain('no run log for 2026-10-02');
    const api = await app().request('/api/digest/2026-10-02');
    expect(api.status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    write('2026-10-03', []);
    const page = await app().request('/digest/2026-10-03');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const api = await app().request('/api/digest/2026-10-03');
    expect(api.status).toBe(200);
    expect(((await api.json()) as Night).rows).toEqual([]);
  });

  it('counts a bad line and still renders the rest', async () => {
    write('2026-10-04', [line('good-job', 'ok', 'anna', '2026-10-04T01:00:00+01:00'), '{not json']);
    const page = await app().request('/digest/2026-10-04');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('good-job');
    expect(html).toMatch(/1 line didn(&#39;|')t parse/);
    const api = await app().request('/api/digest/2026-10-04');
    const data = (await api.json()) as Night;
    expect(data.badLines).toBe(1);
    expect(data.rows).toHaveLength(1);
  });

  it('404s for an invalid night', async () => {
    expect((await app().request('/digest/not-a-date')).status).toBe(404);
    expect((await app().request('/api/digest/not-a-date')).status).toBe(404);
  });
});
