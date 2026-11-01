import { Hono } from 'hono';
import { isNight } from './digest/night.js';
import { readNight } from './digest/read.js';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Digest, NoDigest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // The page and the JSON read the same night the same way, so they can't disagree (ADR 0001).
  app.get('/digest/:night', (c) => {
    const id = c.req.param('night');
    const night = isNight(id) ? readNight(config.runsDir, id) : null;
    if (!night) {
      return c.html(
        <Layout title="digest" lane={lane()}>
          <NoDigest night={id} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night.night}`} lane={lane()}>
        <Digest night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = isNight(night) ? readNight(config.runsDir, night) : null;
    if (!data) return c.json({ error: `no run log for ${night}` }, 404);
    return c.json(data);
  });

  return app;
}
