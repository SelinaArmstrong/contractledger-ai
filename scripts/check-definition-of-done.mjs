#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizeDefinitionOfDone, validateDefinitionOfDone } from '../lib/definition-of-done.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const featureDirectory = resolve(repositoryRoot, 'docs/definition-of-done/features');
const manifestFlagIndex = process.argv.indexOf('--manifest');
const requestedManifest = manifestFlagIndex >= 0 ? process.argv[manifestFlagIndex + 1] : undefined;

if (manifestFlagIndex >= 0 && !requestedManifest) {
  console.error('Definition of Done gate failed: --manifest requires a path.');
  process.exitCode = 1;
} else {
  const manifestPaths = requestedManifest
    ? [resolve(repositoryRoot, requestedManifest)]
    : readdirSync(featureDirectory)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => resolve(featureDirectory, name));

  if (manifestPaths.length === 0) {
    console.error('Definition of Done gate failed: no feature manifests were found.');
    process.exitCode = 1;
  } else {
    let failed = false;
    let totalCriteria = 0;

    for (const manifestPath of manifestPaths) {
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (error) {
        failed = true;
        console.error(`[FAIL] ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      const errors = validateDefinitionOfDone(manifest, {
        pathExists: (path) => {
          const candidate = resolve(repositoryRoot, path);
          const relativePath = relative(repositoryRoot, candidate);
          return relativePath !== '..' && !relativePath.startsWith('../') && !isAbsolute(relativePath) && existsSync(candidate);
        },
      });
      const summary = summarizeDefinitionOfDone(manifest);
      totalCriteria += summary.total;

      if (errors.length > 0) {
        failed = true;
        console.error(`[FAIL] ${manifest.featureId ?? manifestPath}`);
        for (const error of errors) console.error(`  - ${error}`);
      } else {
        console.log(
          `[PASS] ${manifest.featureId}: ${summary.accountedFor}/${summary.total} criteria accounted for ` +
            `(${summary.complete} complete, ${summary.notApplicable} not applicable)`,
        );
      }
    }

    if (failed) {
      console.error('Definition of Done gate failed.');
      process.exitCode = 1;
    } else {
      console.log(`Definition of Done gate passed: ${manifestPaths.length} feature(s), ${totalCriteria} criteria.`);
    }
  }
}
