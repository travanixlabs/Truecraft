/* ==========================================================================
   Truecraft quote form — Cloudflare Worker

   Receives the quote form POST, validates it, rate-limits it, and sends the
   enquiry to Truecraft via Resend.

   Every limit enforced in the browser is enforced again here. The client-side
   checks exist to give people fast feedback; these exist because the client
   cannot be trusted.
   ========================================================================== */

const LIMITS = {
  maxPhotos: 5,
  maxTotalBytes: 8 * 1024 * 1024,   // whole request, after the browser resizes
  maxFieldChars: 4000,
  minFillSeconds: 3,                // faster than this is a bot
  maxFormAgeSeconds: 60 * 60 * 4,   // stale page, make them reload
  perIpCooldownSeconds: 15 * 60,    // one enquiry per IP per 15 min
  perIpDaily: 5,
  globalDaily: 60,                  // guards the Resend free tier's 100/day
};

const JOB_TYPES = [
  'Patio', 'Pergola', 'Decking', 'Carport', 'Fencing',
  'Wall cladding', 'Shed', 'Balustrading', 'Something else',
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
    if (env.ALLOWED_ORIGINS && !isAllowedOrigin(origin, env)) {
      return json({ error: 'Forbidden' }, 403, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    try {
      // ── Size guard, before we read the body into memory ──────────────────
      const declared = Number(request.headers.get('Content-Length') || 0);
      if (declared > LIMITS.maxTotalBytes) {
        return json({ error: 'Those photos are too large. Please attach fewer, or smaller, images.' }, 413, cors);
      }

      const form = await request.formData();

      // ── Bot traps ────────────────────────────────────────────────────────
      // Hidden field: real people never see it, so anything in it is a bot.
      if ((form.get('company') || '').toString().trim() !== '') {
        return json({ ok: true }, 200, cors); // lie to the bot
      }

      const renderedAt = Number(form.get('rendered_at') || 0);
      const age = (Date.now() - renderedAt) / 1000;
      if (!renderedAt || age < LIMITS.minFillSeconds) {
        return json({ error: 'That was a bit quick — please try again.' }, 400, cors);
      }
      if (age > LIMITS.maxFormAgeSeconds) {
        return json({ error: 'This page has been open a while. Please refresh and resend.' }, 400, cors);
      }

      // ── Turnstile ────────────────────────────────────────────────────────
      if (env.TURNSTILE_SECRET) {
        const ok = await verifyTurnstile(form.get('cf-turnstile-response'), ip, env.TURNSTILE_SECRET);
        if (!ok) return json({ error: 'Could not verify you are human. Please try again.' }, 400, cors);
      }

      // ── Fields ───────────────────────────────────────────────────────────
      const name = clean(form.get('name'));
      const phone = clean(form.get('phone'));
      const suburb = clean(form.get('suburb'));
      const email = clean(form.get('email'));
      const details = clean(form.get('details'));
      let job = clean(form.get('job'));

      if (!name || !phone) return json({ error: 'Name and phone are required.' }, 400, cors);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: 'That email address does not look right.' }, 400, cors);
      }
      if (!JOB_TYPES.includes(job)) job = 'Something else';

      // ── Attachments ──────────────────────────────────────────────────────
      const photos = form.getAll('photos').filter(f => f && typeof f === 'object' && f.size > 0);
      if (photos.length > LIMITS.maxPhotos) {
        return json({ error: `Please attach no more than ${LIMITS.maxPhotos} photos.` }, 400, cors);
      }
      let photoBytes = 0;
      for (const p of photos) {
        if (!ALLOWED_IMAGE_TYPES.includes(p.type)) {
          return json({ error: 'Photos must be JPEG, PNG or WebP.' }, 400, cors);
        }
        photoBytes += p.size;
      }
      if (photoBytes > LIMITS.maxTotalBytes) {
        return json({ error: 'Those photos are too large. Please attach fewer, or smaller, images.' }, 413, cors);
      }

      // ── Rate limits ──────────────────────────────────────────────────────
      const limited = await checkRateLimits(env, ip);
      if (limited) return json({ error: limited.message }, 429, cors);

      // ── Send ─────────────────────────────────────────────────────────────
      const attachments = [];
      for (let i = 0; i < photos.length; i++) {
        attachments.push({
          filename: safeFilename(photos[i].name, i),
          content: toBase64(await photos[i].arrayBuffer()),
        });
      }

      const sent = await sendViaResend(env, {
        name, phone, suburb, email, job, details, ip,
        photoCount: photos.length,
        attachments,
      });

      if (!sent.ok) {
        console.error('resend failed', sent.status, sent.body);
        return json({ error: 'We could not send that just now. Please call 0418 126 371.' }, 502, cors);
      }

      await recordSubmission(env, ip);
      return json({ ok: true }, 200, cors);

    } catch (err) {
      console.error('quote handler error', err && err.stack || err);
      return json({ error: 'Something went wrong. Please call 0418 126 371.' }, 500, cors);
    }
  },
};

/* ── Rate limiting ───────────────────────────────────────────────────────────
   KV is eventually consistent, so these are coarse rather than exact. That is
   fine: the point is to stop floods, not to police an exact count. The global
   counter is the one that protects the Resend quota. */

async function checkRateLimits(env, ip) {
  if (!env.RATE_LIMIT) return null;

  if (await env.RATE_LIMIT.get(`cool:${ip}`)) {
    return { message: 'You have already sent an enquiry in the last 15 minutes. Call 0418 126 371 if it is urgent.' };
  }

  const daily = Number(await env.RATE_LIMIT.get(`ipday:${ip}`) || 0);
  if (daily >= LIMITS.perIpDaily) {
    return { message: 'That is a few enquiries for one day. Please call 0418 126 371.' };
  }

  const global = Number(await env.RATE_LIMIT.get(`global:${today()}`) || 0);
  if (global >= LIMITS.globalDaily) {
    return { message: 'The quote form is busy today. Please call 0418 126 371.' };
  }

  return null;
}

async function recordSubmission(env, ip) {
  if (!env.RATE_LIMIT) return;
  const daily = Number(await env.RATE_LIMIT.get(`ipday:${ip}`) || 0);
  const global = Number(await env.RATE_LIMIT.get(`global:${today()}`) || 0);
  await Promise.all([
    env.RATE_LIMIT.put(`cool:${ip}`, '1', { expirationTtl: LIMITS.perIpCooldownSeconds }),
    env.RATE_LIMIT.put(`ipday:${ip}`, String(daily + 1), { expirationTtl: 86400 }),
    env.RATE_LIMIT.put(`global:${today()}`, String(global + 1), { expirationTtl: 172800 }),
  ]);
}

/* ── Turnstile ─────────────────────────────────────────────────────────────── */

async function verifyTurnstile(token, ip, secret) {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token.toString());
  body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('turnstile check failed', e);
    return false;
  }
}

/* ── Resend ────────────────────────────────────────────────────────────────── */

async function sendViaResend(env, q) {
  const payload = {
    from: env.FROM_EMAIL || 'Truecraft website <onboarding@resend.dev>',
    to: [env.TO_EMAIL || 'truecraft@outlook.com.au'],
    subject: `Quote request — ${q.job}${q.suburb ? ' — ' + q.suburb : ''}`,
    html: emailHtml(q),
    text: emailText(q),
  };
  if (q.email) payload.reply_to = q.email;
  if (q.attachments.length) payload.attachments = q.attachments;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return { ok: res.ok, status: res.status, body: res.ok ? null : await res.text() };
}

function emailHtml(q) {
  const row = (label, value) => value
    ? `<tr><td style="padding:6px 16px 6px 0;color:#6B7480;font:600 12px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;vertical-align:top;white-space:nowrap">${esc(label)}</td>
         <td style="padding:6px 0;color:#171E27;font:400 15px/1.5 Arial,sans-serif">${esc(value)}</td></tr>`
    : '';

  return `<div style="font-family:Arial,sans-serif;max-width:640px">
  <p style="margin:0 0 4px;font:600 12px/1 Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#4C8B3C">Truecraft website</p>
  <h1 style="margin:0 0 18px;font:700 22px/1.2 Arial,sans-serif;color:#171E27">New quote request</h1>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px">
    ${row('Name', q.name)}
    ${row('Phone', q.phone)}
    ${row('Email', q.email)}
    ${row('Suburb', q.suburb)}
    ${row('Job type', q.job)}
    ${row('Photos', q.photoCount ? `${q.photoCount} attached` : 'None')}
  </table>
  ${q.details ? `<p style="margin:0 0 6px;font:600 12px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#6B7480">What they are after</p>
  <p style="margin:0 0 20px;padding:14px 16px;background:#F6F5F1;font:400 15px/1.6 Arial,sans-serif;color:#2E3742;white-space:pre-wrap">${esc(q.details)}</p>` : ''}
  <p style="margin:0;font:400 13px/1.5 Arial,sans-serif;color:#6B7480">
    Call back on <a href="tel:${esc(q.phone.replace(/[^\d+]/g, ''))}" style="color:#4C8B3C">${esc(q.phone)}</a>${q.email ? ', or just hit Reply to email them.' : '.'}
  </p>
</div>`;
}

function emailText(q) {
  return [
    'New quote request — Truecraft website',
    '',
    `Name:     ${q.name}`,
    `Phone:    ${q.phone}`,
    q.email ? `Email:    ${q.email}` : null,
    q.suburb ? `Suburb:   ${q.suburb}` : null,
    `Job type: ${q.job}`,
    `Photos:   ${q.photoCount || 'none'}`,
    '',
    q.details ? `What they are after:\n${q.details}` : null,
  ].filter(Boolean).join('\n');
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function clean(v) {
  return (v == null ? '' : v.toString()).trim().slice(0, LIMITS.maxFieldChars);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function safeFilename(name, i) {
  const base = String(name || '').replace(/[^\w.\- ]+/g, '').slice(-60);
  return base || `photo-${i + 1}.jpg`;
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000; // keep the argument list to String.fromCharCode sane
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isAllowedOrigin(origin, env) {
  return env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin);
}

function corsHeaders(origin, env) {
  const allow = !env.ALLOWED_ORIGINS || isAllowedOrigin(origin, env) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
