/** A disposable, local-only built Worker. Never uses deployment data or secrets. */
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'contractledger-release-'));
const built = JSON.parse(
  readFileSync(resolve(root, 'dist/server/wrangler.json'), 'utf8'),
);
const config = {
  name: 'contractledger-release-check',
  main: resolve(root, 'dist/server', built.main),
  compatibility_date: built.compatibility_date,
  compatibility_flags: built.compatibility_flags,
  no_bundle: true,
  rules: built.rules,
  assets: { directory: resolve(root, 'dist/client') },
  vars: {
    SITE_URL: 'http://127.0.0.1:8791',
    DEMO_GUEST_ACCESS: 'true',
    ALLOW_LOCAL_MAINTAINER: 'true',
  },
  d1_databases: [
    {
      binding: 'DB',
      database_name: 'release-test',
      database_id: '00000000-0000-0000-0000-000000000001',
    },
  ],
  r2_buckets: [{ binding: 'FILES', bucket_name: 'release-test' }],
};
writeFileSync(join(directory, 'wrangler.json'), JSON.stringify(config));
writeFileSync(join(directory, '.env'), '');
const child = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
    'dev',
    '--config',
    join(directory, 'wrangler.json'),
    '--env-file',
    join(directory, '.env'),
    '--local',
    '--persist-to',
    join(directory, 'state'),
    '--ip',
    '127.0.0.1',
    '--port',
    '8791',
    '--inspector-port',
    '9291',
    '--log-level',
    'error',
  ],
  {
    cwd: directory,
    stdio: 'inherit',
    env: {
      ...process.env,
      WRANGLER_WRITE_LOGS: 'false',
      WRANGLER_REGISTRY_PATH: join(directory, 'registry'),
      MINIFLARE_REGISTRY_PATH: join(directory, 'registry'),
      CHOKIDAR_USEPOLLING: 'true',
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  console.error(error);
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = 1;
});
child.on('exit', (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});
