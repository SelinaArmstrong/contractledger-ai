#!/usr/bin/env node

/**
 * Refuses a manual deploy that has not said which Cloudflare account it means.
 *
 * `wrangler deploy` does not fail when no account is specified. It falls back
 * to whichever account the local OAuth login happens to hold, and if the
 * bindings in the config do not exist there it creates the ones it can — then
 * fails on the ones it cannot. That is not a theoretical hazard: on 2026-11-26
 * a bare `npm run deploy` from a machine logged into an unrelated account
 * uploaded this app's assets there, created an empty R2 bucket named after the
 * production one, and only then stopped, because the D1 database in
 * `wrangler.jsonc` does not exist in that account. The production Worker was
 * never touched and the stray bucket had to be cleaned up by hand.
 *
 * Deploying is normally not a local command at all. Pushing to `main` is the
 * deploy: Cloudflare Workers Builds builds the commit and releases it, and it
 * reports back on the commit as the `Workers Builds: contractledger-ai` check.
 * A local deploy is the exception, so it has to be deliberate.
 *
 * The gate is the narrowest one that catches the case above: refuse only when
 * nothing in the environment names a target or supplies a credential. Anything
 * that can legitimately deploy — the managed build, a scoped API token, an
 * explicit account id — passes untouched, so this cannot stand between a
 * commit and production.
 */

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const ci = process.env.CI?.trim();

if (ci) {
  console.log('Deploy target: managed build environment (CI is set).');
  process.exit(0);
}

if (accountId) {
  console.log(`Deploy target: Cloudflare account ${accountId}.`);
  if (!apiToken)
    console.log(
      'No CLOUDFLARE_API_TOKEN set; wrangler will use the local login for this account.',
    );
  process.exit(0);
}

if (apiToken) {
  console.log(
    'Deploy target: the account the supplied API token is scoped to.',
  );
  process.exit(0);
}

console.error(
  `Refusing to deploy: no Cloudflare account was named.

Pushing to main is the deploy path. Cloudflare Workers Builds picks the commit
up and releases it, and reports back on the commit as the check
"Workers Builds: contractledger-ai". Nothing needs to run here.

Without CLOUDFLARE_ACCOUNT_ID, wrangler would deploy to whichever account this
machine is logged into. When that is the wrong account it does not refuse: it
uploads the assets, creates whatever bindings it can, and fails on the rest.

If you do mean to deploy from here, name the account that owns the production
Worker and run it again:

  CLOUDFLARE_ACCOUNT_ID=<account id> npm run deploy

Check the account first with \`npx wrangler whoami\`, which prints the account
the local login can reach. It is not necessarily the one serving the site.`,
);
process.exit(1);
