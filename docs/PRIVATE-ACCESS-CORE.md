# Private access foundation

Scope: the first release batch, October 19, 2026. This document describes the
server/session foundation, not the full visual refresh or its client wiring.

## Browser access

Legacy buyer links exchange their UUID credential at `/auth/access` for the
`wda_buyer_access` cookie, then redirect to `/setup`, `/discover`, `/start`,
`/contracts`, `/targeting`, or a readable `/d/<title>--<notice-id>` URL. Cookie
authorization remains necessary; a contract slug is not a credential. Delivery
lookups remain scoped to the authenticated buyer. Unsafe destinations fall back
to `/contracts`; only supported targeting query flags survive the exchange.

The cookie lasts 30 days, is HTTP-only, SameSite=Lax, and uses Secure in
production. The reserved `me` key resolves it on the server for existing page
and API handlers. Legacy bearer API clients remain supported. Middleware marks
matched pages and access responses private/no-store, no-referrer, and noindex.

## Logout and origin validation

`POST /auth/logout` expires only this cookie at `/` and redirects to
`/portal?logged_out=1`. GET does not log out. Saved profiles, deliveries, emailed
credentials, Kajabi sessions, and appearance preferences are not changed.

Origin checks use the incoming Host, including its port, rather than Next's
internal localhost URL. Reverse proxies must preserve the public Host and
overwrite X-Forwarded-Proto with one http/https value. X-Forwarded-Host is not
trusted. Cross-site browser requests and mismatched origins are rejected.

The private no-referrer policy can make native forms send `Origin: null`.
Only logout permits this case, requiring POST plus all three browser metadata
headers: Sec-Fetch-Site same-origin, Sec-Fetch-Mode navigate, and Sec-Fetch-Dest
document. Missing metadata, same-site (rather than same-origin), cross-site,
iframe, and fetch/XHR requests do not qualify. Cookie-authorized mutation APIs
remain strict and do not opt into that exception.

## Boundaries and follow-up

This is credential transport cleanup, not a new identity verification system.
It does not rotate old credentials or erase historical logs. The existing
unverified email-only portal entry is unchanged. The redesigned entry pages,
logout controls, canonical reader redirects, and profile-prop whitelist wiring
are delivered in the dependent UI batches. Until those batches land, existing
page internals may still use legacy redirects/props; do not describe the first
batch as completing all client credential cleanup.

Verify the independent foundation with `node --test test/buyerSession.test.mjs`.
Tests use synthetic records and mocked persistence, not real member credentials.
