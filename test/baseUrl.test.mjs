// Unit tests for the single source of truth for the app's public base URL.
// This precedence is load-bearing for longevity: every buyer-facing link in
// every email is built from it, so a silent regression here would break links
// across the whole product. Locking the order in keeps the domain a single lever.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveBaseUrl } from '../lib/baseUrl.js';

const ENV_KEYS = ['APP_BASE_URL', 'VERCEL_PROJECT_PRODUCTION_URL'];

function withEnv(vars, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const req = (url) => ({ url });

test('explicit override wins over everything', () => {
  withEnv({ APP_BASE_URL: 'https://app.wardogsacademy.com' }, () => {
    assert.equal(
      resolveBaseUrl({ explicit: 'https://override.example', req: req('https://x/y') }),
      'https://override.example'
    );
  });
});

test('APP_BASE_URL beats the Vercel alias and the request origin', () => {
  withEnv(
    { APP_BASE_URL: 'https://app.wardogsacademy.com', VERCEL_PROJECT_PRODUCTION_URL: 'wda.vercel.app' },
    () => {
      assert.equal(
        resolveBaseUrl({ req: req('https://wda-git-main-x.vercel.app/api/access') }),
        'https://app.wardogsacademy.com'
      );
    }
  );
});

test('Vercel production alias is preferred over a branch-preview request origin', () => {
  withEnv({ VERCEL_PROJECT_PRODUCTION_URL: 'wda.vercel.app' }, () => {
    assert.equal(
      resolveBaseUrl({ req: req('https://wda-git-main-x.vercel.app/api/access') }),
      'https://wda.vercel.app'
    );
  });
});

test('falls back to the request origin when no env is set', () => {
  withEnv({}, () => {
    assert.equal(resolveBaseUrl({ req: req('https://localhost:3000/api/x') }), 'https://localhost:3000');
  });
});

test('trailing slashes are trimmed so links never double up', () => {
  withEnv({ APP_BASE_URL: 'https://app.wardogsacademy.com/' }, () => {
    assert.equal(resolveBaseUrl(), 'https://app.wardogsacademy.com');
  });
});

test('returns empty string when nothing resolves', () => {
  withEnv({}, () => {
    assert.equal(resolveBaseUrl(), '');
  });
});
