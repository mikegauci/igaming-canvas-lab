// Deploys the assembled dist/ folder to Vercel through its REST API.
//
// Vercel's Git integration kept failing with "Git information retrieval failed", and the Vercel
// CLI refuses some tokens while loading the user ("User not found (404)"). Plain API calls avoid
// both: upload every built file, create a deployment from them, then wait until it is ready.
// Nothing is built on Vercel; it serves exactly what CI built and tested.
//
//   VERCEL_TOKEN=… VERCEL_TEAM_ID=… VERCEL_PROJECT_ID=… node scripts/deploy.mjs [--prod]
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY } =
  process.env;
const production = process.argv.includes('--prod');
const root = new URL('..', import.meta.url).pathname;
const distDir = join(root, 'dist');

/** vercel.json keys that affect serving. Build settings are left out: nothing is built. */
const ROUTING_KEYS = ['trailingSlash', 'cleanUrls', 'redirects', 'rewrites', 'headers'];
const UPLOAD_CONCURRENCY = 8;
const READY_TIMEOUT_MS = 10 * 60 * 1000;
/** Whole deployments are retried too: Vercel sometimes fails one before it even starts. */
const DEPLOY_ATTEMPTS = 3;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls the Vercel API for the team, retrying network errors, 429s and 5xx responses. */
async function api(path, init = {}, attempts = 4) {
  const url = new URL(path, 'https://api.vercel.com');
  url.searchParams.set('teamId', VERCEL_TEAM_ID);
  const request = {
    ...init,
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, ...init.headers },
  };

  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await fetch(url, request);
    } catch (error) {
      if (attempt >= attempts) throw error;
      await wait(attempt * 2000);
      continue;
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < attempts) {
      await wait(attempt * 2000);
      continue;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const { code = '', message = response.statusText } = body.error ?? {};
      throw new Error(
        `${init.method ?? 'GET'} ${url.pathname} → ${response.status} ${code}: ${message}`,
      );
    }
    return body;
  }
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function collectFiles() {
  const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const routing = Object.fromEntries(
    Object.entries(config).filter(([key]) => ROUTING_KEYS.includes(key)),
  );
  const built = listFiles(distDir).map((path) => ({
    file: relative(distDir, path).split(sep).join('/'),
    data: readFileSync(path),
  }));
  return [...built, { file: 'vercel.json', data: Buffer.from(JSON.stringify(routing)) }].map(
    (entry) => ({
      ...entry,
      sha: createHash('sha1').update(entry.data).digest('hex'),
      size: entry.data.length,
    }),
  );
}

async function uploadAll(files) {
  const queue = [...files];
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      await api('/v2/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': file.sha },
        body: file.data,
      });
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
}

/** Resolves with the finished deployment (READY, ERROR or CANCELED). */
async function waitUntilDone(id) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const deployment = await api(`/v13/deployments/${id}`);
    if (['READY', 'ERROR', 'CANCELED'].includes(deployment.readyState)) return deployment;
    if (Date.now() > deadline) throw new Error(`Deployment ${id} was not ready after 10 minutes`);
    await wait(3000);
  }
}

async function createDeployment(files) {
  return api('/v13/deployments?skipAutoDetectionConfirmation=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'igaming-canvas-lab',
      project: VERCEL_PROJECT_ID,
      ...(production && { target: 'production' }),
      files: files.map(({ file, sha, size }) => ({ file, sha, size })),
      // Static files only: no framework, install or build step on Vercel.
      projectSettings: {
        framework: null,
        buildCommand: null,
        installCommand: null,
        outputDirectory: null,
      },
    }),
  });
}

if (!VERCEL_TOKEN) fail('Missing VERCEL_TOKEN. See README > Deployment.');
if (!VERCEL_TEAM_ID || !VERCEL_PROJECT_ID) fail('Set VERCEL_TEAM_ID and VERCEL_PROJECT_ID.');

try {
  const files = collectFiles();
  console.log(`Uploading ${files.length} files…`);
  await uploadAll(files);

  let ready = null;
  for (let attempt = 1; attempt <= DEPLOY_ATTEMPTS && !ready; attempt++) {
    const created = await createDeployment(files);
    console.log(`Created ${created.id} (attempt ${attempt}), waiting for it to be ready…`);
    const done = await waitUntilDone(created.id);
    if (done.readyState === 'READY') ready = done;
    else {
      const reason = done.errorMessage ?? done.errorCode ?? 'no reason given';
      console.log(`::warning::${created.id} ended as ${done.readyState}: ${reason}`);
      if (attempt < DEPLOY_ATTEMPTS) await wait(attempt * 30_000);
    }
  }
  if (!ready)
    fail(`Vercel failed the deployment ${DEPLOY_ATTEMPTS} times. Check vercel-status.com.`);

  const url = `https://${production ? (ready.alias?.[0] ?? ready.url) : ready.url}`;
  console.log(`Deployed to ${url}`);
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `url=${url}\n`);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `Deployed to ${url}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
