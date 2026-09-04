import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json' with { type: 'json' };

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';
const cloudflareD1DatabaseId =
  process.env.CLOUDFLARE_D1_DATABASE_ID ?? SITE_CREATOR_PLACEHOLDER_DATABASE_ID;

const { d1, r2 } = hostingConfig;

/**
 * Writes the hosting project id into the built bundle instead of the
 * repository.
 *
 * `.openai/hosting.json` is committed because the build reads the `d1` and
 * `r2` binding names from it, but the project id is an identifier for one
 * particular hosted account and has no business in a public repository. The
 * sites plugin copies that file into `dist/.openai/` verbatim, so this runs
 * afterwards and stamps the id in from the environment when a deploy needs it.
 * With `OPENAI_PROJECT_ID` unset — which is every clone of this repository —
 * the bundle simply has no project id, exactly as the source does.
 */
function stampHostingProjectId() {
  return {
    name: 'contractledger:hosting-project-id',
    async closeBundle() {
      const projectId = process.env.OPENAI_PROJECT_ID?.trim();
      if (!projectId) return;
      const target = resolve(process.cwd(), 'dist', '.openai', 'hosting.json');
      await mkdir(resolve(process.cwd(), 'dist', '.openai'), {
        recursive: true,
      });
      const current = await readFile(target, 'utf8').then(
        (text) => JSON.parse(text) as Record<string, unknown>,
        () => ({ ...hostingConfig }) as Record<string, unknown>,
      );
      await writeFile(
        target,
        `${JSON.stringify({ project_id: projectId, ...current }, null, 2)}\n`,
      );
    },
  };
}

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: cloudflareD1DatabaseId,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
      // Last, so it runs after the sites plugin has copied hosting.json.
      stampHostingProjectId(),
    ],
  };
});
