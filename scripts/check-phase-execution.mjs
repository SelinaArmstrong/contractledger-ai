#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizePhaseExecution, validatePhaseExecution } from '../lib/phase-execution.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const phaseDirectory = resolve(repositoryRoot, 'docs/execution-loop/phases');
const manifestFlagIndex = process.argv.indexOf('--manifest');
const requestedManifest = manifestFlagIndex >= 0 ? process.argv[manifestFlagIndex + 1] : undefined;

if (manifestFlagIndex >= 0 && !requestedManifest) {
  console.error('Phase execution gate failed: --manifest requires a path.');
  process.exitCode = 1;
} else {
  const manifestPaths = requestedManifest
    ? [resolve(repositoryRoot, requestedManifest)]
    : readdirSync(phaseDirectory)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => resolve(phaseDirectory, name));

  if (manifestPaths.length === 0) {
    console.error('Phase execution gate failed: no phase manifests were found.');
    process.exitCode = 1;
  } else {
    let failed = false;
    let totalSteps = 0;

    for (const manifestPath of manifestPaths) {
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (error) {
        failed = true;
        console.error(`[FAIL] ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      const errors = validatePhaseExecution(manifest, {
        pathExists: (path) => {
          const candidate = resolve(repositoryRoot, path);
          const relativePath = relative(repositoryRoot, candidate);
          return relativePath !== '..' && !relativePath.startsWith('../') && !isAbsolute(relativePath) && existsSync(candidate);
        },
      });
      const summary = summarizePhaseExecution(manifest);
      totalSteps += summary.total;

      if (errors.length > 0) {
        failed = true;
        console.error(`[FAIL] ${manifest.phaseId ?? manifestPath}`);
        for (const error of errors) console.error(`  - ${error}`);
      } else {
        console.log(
          `[PASS] ${manifest.phaseId}: ${summary.finished}/${summary.total} steps finished ` +
            `(${summary.complete} complete, ${summary.notApplicable} not applicable)`,
        );
      }
    }

    if (failed) {
      console.error('Phase execution gate failed.');
      process.exitCode = 1;
    } else {
      console.log(`Phase execution gate passed: ${manifestPaths.length} phase(s), ${totalSteps} steps checked.`);
    }
  }
}
