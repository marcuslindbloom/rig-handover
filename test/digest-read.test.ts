import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('finds 5 jobs, sorted, and the truncated last line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('folds fixtures/refresh into one row', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps digest/render with a null owner', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row?.owner).toBeNull();
    expect(row?.lastError).toBeNull();
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not a date', () => {
    writeFileSync(join(dir, 'x.jsonl'), '');
    expect(readNight(dir, 'x')).toBeNull();
    expect(readNight(dir, '../etc/passwd')).toBeNull();
  });

  it('reads an empty file as an empty night', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts invalid lines, skips blank ones, never throws', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
      '',
      '   ',
      'not json',
      '[]',
      'null',
      '{"at":"t","job":"a","status":"done","owner":"x"}',
      '{"at":"t","job":"a","status":"ok","owner":7}',
      '{"at":"t","job":"a","status":"ok"}',
      '{"at":"t","job":"a","status":"ok","owner":"x","error":5}',
      '{"job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T02:00:00-05:00","job":"a","status":"ok","owner":null}',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(8);
    expect(night?.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 2,
        retries: 0,
        lastStatus: 'ok',
        lastError: 'boom',
        firstAt: '2026-01-01T01:00:00+01:00',
        lastAt: '2026-01-01T02:00:00-05:00',
      },
    ]);
  });
});
