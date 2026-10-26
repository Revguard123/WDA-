# Private browser URLs

The homepage `/` and `/portal` share the same member entry experience. With a
valid buyer session they redirect to the existing state-aware destination:
`/setup` for exploring buyers and `/contracts` for active/completed buyers.
Missing sessions show the access form; malformed or revoked cookies show that
form with a recovery notice. The homepage does not accept email or token query
parameters as credentials. Explicit `/portal?email=...` links remain supported
with their existing, unverified-email behavior described below. Both entry
routes are dynamic, private/no-store, no-referrer, and noindex.

`/access` uses the same visual frame and always keeps the email-link recovery
form available, including when a buyer already has a session. Its client posts
only to `/api/access`; the neutral success response does not reveal membership.
The recovery page is also private/no-store, no-referrer, and noindex.

The sidebar shows the saved buyer profile name with a local, faceless,
gender-neutral glass avatar (email-name fallback when the name is unset). No
avatar images or identity data are sent to external services. Log out submits a same-origin POST to
`/auth/logout`, expires only the HTTP-only workspace cookie at `/`, and redirects
to `/portal?logged_out=1`. GET does not log out; cross-site POSTs are rejected.
Logout does not delete saved work, revoke existing email links, or end Kajabi
sessions. Appearance preferences are retained. Focused onboarding also keeps
a compact logout action available without adding sidebar navigation.

Origin checks use the incoming `Host` (including its port), not Next's internal
request URL. This keeps localhost/IP/LAN access working without accepting
cross-origin requests. TLS-terminating proxies must preserve the public `Host`
and overwrite `X-Forwarded-Proto` with one `http`/`https` value. Forwarded-host
headers are not used as an origin allowlist. Logout redirects to the validated
request origin and still expires only the workspace session cookie.

Native logout POSTs can legitimately carry `Origin: null` under our private
`no-referrer` policy. Logout accepts that case only with all three browser Fetch
Metadata signals: `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: navigate`, and
`Sec-Fetch-Dest: document`. Missing, same-site or cross-site signals still reject
opaque origins. Cookie mutation APIs do not opt into this form-only exception.

On mobile, the header avatar opens the same account/support content as a
dropdown; there is no duplicate footer profile or logout form. On tablet and
desktop, the sidebar can collapse to an icon rail. Its device-only preference
is stored as `wda:sidebar-collapsed` (`1`/`0`), with no buyer identifier or access
token. Storage failure does not prevent toggling, and logout preserves this
layout preference alongside appearance.

Buyer pages use `/setup`, `/discover`, `/start`, `/contracts`, and `/targeting`.
Full breakdowns use `/d/<title-slug>--<notice-id>`. The notice suffix is a public
SAM identifier, not an account credential, and prevents title collisions.

Existing emailed token links still work. Middleware sends them through
`/auth/access`, where the buyer credential is validated and exchanged for a
30-day HTTP-only, SameSite=Lax cookie (Secure in production), followed by a
redirect to the clean URL. These responses are private/no-store, no-referrer,
and noindex. Old links remain sensitive: this change does not rotate or revoke
previously issued credentials, or remove them from historical browser/server logs.

Browser APIs use the reserved `me` key. The server resolves it from the cookie;
an arbitrary slug cannot identify a buyer. Profile props sent to the client are
whitelisted and exclude `access_token`. Cookie-authorized mutations reject
cross-origin browser requests. Legacy bearer-token API clients remain supported.

Every breakdown lookup still requires both the authenticated buyer ID and a
delivery notice ID. A slug copied into another browser does not sign someone in
or grant access to another buyer's delivery. Without a current cookie, reopen a
private email link using `/access`. Refreshes and bookmarks work with a current
cookie; an old title slug redirects to its current canonical title after access
and delivery checks.

This is credential transport/URL cleanup, not a new identity-verification system.
The preexisting email-only `/portal?email=...` entry remains an accepted product
tradeoff and does not verify email ownership. Replacing it with verified email
links or Kajabi SSO is a separate authentication change.
