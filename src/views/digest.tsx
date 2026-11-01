import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

// Marked rows carry a text cue too, not color only: previews are read as screenshots.
function marked(row: DigestRow): boolean {
  return row.lastStatus === 'fail' || row.retries >= 3;
}

export function Digest({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => {
              const m = marked(row);
              return (
                <tr class={m ? 'warn' : undefined}>
                  <td>{m ? `! ${row.job}` : row.job}</td>
                  <td>{row.owner ?? dash}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.retries >= 3 ? `${row.lastStatus} · ${row.retries} retries` : row.lastStatus}</td>
                  <td>{row.lastError ?? dash}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && (
        <p class="mute">
          {night.badLines === 1 ? "1 line didn't parse" : `${night.badLines} lines didn't parse`}
        </p>
      )}
    </>
  );
}

export function NoDigest({ night }: { night: string }) {
  return (
    <>
      <h1>digest</h1>
      <p class="mute">no run log for {night}</p>
    </>
  );
}
