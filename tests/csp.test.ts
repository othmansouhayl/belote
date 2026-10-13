import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../scripts/csp.ts';

describe('politique de sécurité du site (CSP)', () => {
  it('autorise seulement le site et le serveur Supabase (https + temps réel)', () => {
    const csp = contentSecurityPolicy('https://abcd.supabase.co');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('en local (http) le temps réel passe en ws, et sans Supabase rien d’autre que le site', () => {
    expect(contentSecurityPolicy('http://127.0.0.1:54400')).toContain("connect-src 'self' http://127.0.0.1:54400 ws://127.0.0.1:54400");
    expect(contentSecurityPolicy(undefined)).toContain("connect-src 'self';");
  });
});
