# truecraft-quote — Worker

Receives the quote form POST from the website, validates and rate-limits it,
then sends the enquiry to `truecraft@outlook.com.au` via Resend.

## One-time setup

All of this runs from the `worker/` folder.

```bash
npx wrangler login                              # opens a browser
npx wrangler kv namespace create RATE_LIMIT     # paste the printed id into wrangler.toml
npx wrangler secret put RESEND_API_KEY          # from resend.com/api-keys
npx wrangler secret put TURNSTILE_SECRET        # from the Turnstile widget you create
npx wrangler deploy
```

`deploy` prints the Worker URL. Put it in `index.html` on the form's
`data-endpoint`, and put the Turnstile **site key** on the `.cf-turnstile`
div's `data-sitekey`.

Turnstile widget: Cloudflare dashboard → Turnstile → Add widget. Add the
hostnames it will run on (`travanixlabs.github.io`, plus the custom domain
later). It gives you a site key (public, goes in the HTML) and a secret key
(goes in `wrangler secret`).

Secrets are encrypted in Cloudflare and are never committed here.

## Sender address

Until a domain is verified in Resend, `FROM_EMAIL` **must** stay as
`onboarding@resend.dev` and `TO_EMAIL` must be the Resend account's own login
address. Resend blocks anything else on an unverified account.

Since the account login *is* `truecraft@outlook.com.au`, that works as-is.
Once a domain is verified, change `FROM_EMAIL` in `wrangler.toml` to something
like `Truecraft website <quotes@truecraft.com.au>` and redeploy — nothing else
needs to change.

## Limits

Enforced in `LIMITS` at the top of `src/index.js`, and mirrored in
`assets/js/site.js` for fast feedback. The Worker never trusts the browser's
copy.

| Limit | Value | Why |
| --- | --- | --- |
| Photos per enquiry | 5 | |
| Total request size | 8 MB | After the browser shrinks images to 1600 px |
| Min fill time | 3 s | Faster than a human can type |
| Max page age | 4 h | Stale tab, make them reload |
| Per IP cooldown | 15 min | |
| Per IP daily | 5 | |
| **Global daily** | **60** | Guards the Resend free tier's 100/day |

The global cap is the budget guard: even a determined flood from many IPs stops
at 60 emails a day, well under the free allowance. Raise it if Truecraft ever
gets busy enough to need to.

Rate limits live in Workers KV, which is eventually consistent — counts are
approximate under a burst. That's fine for flood control.

## Spam layers

1. Honeypot field (`company`) — filled only by bots. Returns a fake success.
2. Time trap — rejects submissions under 3 seconds old.
3. Cloudflare Turnstile — verified server-side.
4. Rate limits above.

## Testing

```bash
npx wrangler dev            # runs locally on :8787
```

Point the form's `data-endpoint` at `http://localhost:8787` and serve the site
with `python -m http.server 8000` (that origin is already in `ALLOWED_ORIGINS`).

Watch production logs with `npx wrangler tail`.
