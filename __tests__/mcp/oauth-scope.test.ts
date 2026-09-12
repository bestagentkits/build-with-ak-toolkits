import { describe, it, expect } from 'vitest';
import { hasRequiredScope, DEFAULT_SCOPES, buildWwwAuthenticate } from '../../src/auth/oauth-worker';

describe('OAuth Bearer scope enforcement', () => {
  it('rejects missing scopes', () => {
    expect(hasRequiredScope(undefined, DEFAULT_SCOPES)).toBe(false);
    expect(hasRequiredScope([], DEFAULT_SCOPES)).toBe(false);
  });

  it('accepts a token that carries at least one required scope', () => {
    expect(hasRequiredScope(['build-with-ak:read'], DEFAULT_SCOPES)).toBe(true);
    expect(hasRequiredScope(['openid', 'build-with-ak:write'], DEFAULT_SCOPES)).toBe(true);
  });

  it('rejects a token scoped to something else entirely', () => {
    expect(hasRequiredScope(['openid', 'profile'], DEFAULT_SCOPES)).toBe(false);
    expect(hasRequiredScope(['some-other:scope'], DEFAULT_SCOPES)).toBe(false);
  });

  it('builds an RFC 9728 WWW-Authenticate challenge pointing at resource metadata', () => {
    const header = buildWwwAuthenticate('https://worker.example/.well-known/oauth-protected-resource');
    expect(header).toBe('Bearer resource_metadata="https://worker.example/.well-known/oauth-protected-resource"');
  });
});
