// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job in a night. Times keep the log's offset (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as `—`
  runs: number; // lines for this job, any status
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  counts: Record<RunStatus, number>; // parsed lines per status, for the board (§ 2c)
  badLines: number; // lines that didn't parse; counted, never thrown
};

// Reads runs/<night>.jsonl. Returns null when the night has no file; an empty file gives
// rows: []. Never throws on a bad line.
// Implemented in src/digest/read.ts as `export const readNight: ReadNight`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
