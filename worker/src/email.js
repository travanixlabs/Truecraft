/* ==========================================================================
   Quote notification email

   Built to the website's design language — the same ink/green/stone palette
   and the same typographic rhythm — within what email clients actually
   support: tables for layout, inline styles only, no webfonts, no flexbox.
   Outlook renders through Word, so anything cleverer than this breaks.
   ========================================================================== */

const C = {
  green: '#4C8B3C',
  greenDark: '#3A6D2D',
  greenMid: '#86B36F',
  ink: '#171E27',
  inkDeep: '#10161D',
  inkSoft: '#2E3742',
  stone: '#F6F5F1',
  line: '#E6E4DE',
  grey: '#6B7480',
  white: '#FFFFFF',
};

// Archivo is the site face; email clients fall back through this stack.
const SANS = "'Archivo','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderHtml(q, opts = {}) {
  const logo = opts.logoUrl || '';
  const received = formatReceived(opts.now);
  const tel = q.phone.replace(/[^\d+]/g, '');

  const preheader = `${q.name}${q.suburb ? ' in ' + q.suburb : ''} — ${q.job}${q.phone ? ' — ' + q.phone : ''}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>New quote request</title>
</head>
<body style="margin:0;padding:0;background:${C.stone};">
<div style="display:none;font-size:1px;color:${C.stone};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.stone};">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:${C.white};">

    <!-- Header -->
    <tr>
      <td bgcolor="${C.ink}" style="background:${C.ink};padding:22px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="left" style="vertical-align:middle;">
              ${logo
                ? `<img src="${esc(logo)}" width="132" alt="Truecraft Property Services" style="display:block;border:0;width:132px;height:auto;">`
                : `<span style="font:700 20px/1 ${SANS};color:${C.white};letter-spacing:-0.02em;">True<span style="color:${C.greenMid};">craft</span></span>`}
            </td>
            <td align="right" style="vertical-align:middle;">
              <span style="font:700 11px/1.4 ${SANS};color:${C.greenMid};letter-spacing:.18em;text-transform:uppercase;">New quote request</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Lede -->
    <tr>
      <td style="padding:32px 28px 4px;">
        <h1 style="margin:0 0 8px;font:700 26px/1.15 ${SANS};color:${C.ink};letter-spacing:-0.02em;">${esc(q.name)}</h1>
        <p style="margin:0;font:400 16px/1.55 ${SANS};color:${C.grey};">
          wants a quote for <strong style="color:${C.inkSoft};">${esc(q.job)}</strong>${q.suburb ? ` in <strong style="color:${C.inkSoft};">${esc(q.suburb)}</strong>` : ''}.
        </p>
      </td>
    </tr>

    <!-- Call button -->
    <tr>
      <td style="padding:22px 28px 6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${C.green}" style="background:${C.green};">
              <a href="tel:${esc(tel)}" style="display:inline-block;padding:15px 26px;font:600 16px/1 ${SANS};color:${C.white};text-decoration:none;">
                Call ${esc(q.phone)}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Details -->
    <tr>
      <td style="padding:24px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${row('Phone', q.phone, `tel:${tel}`)}
          ${row('Email', q.email, q.email ? `mailto:${q.email}` : null)}
          ${row('Suburb', q.suburb)}
          ${row('Job type', q.job)}
          ${row('Photos', q.photoCount ? `${q.photoCount} attached to this email` : 'None supplied')}
        </table>
      </td>
    </tr>

    ${q.details ? `
    <!-- Message -->
    <tr>
      <td style="padding:26px 28px 0;">
        <p style="margin:0 0 8px;font:700 11px/1.4 ${SANS};color:${C.grey};letter-spacing:.14em;text-transform:uppercase;">What they are after</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.stone};">
          <tr><td style="padding:18px 20px;border-left:3px solid ${C.green};">
            <p style="margin:0;font:400 15px/1.65 ${SANS};color:${C.inkSoft};white-space:pre-wrap;">${esc(q.details)}</p>
          </td></tr>
        </table>
      </td>
    </tr>` : ''}

    <!-- Reply hint -->
    <tr>
      <td style="padding:26px 28px 32px;">
        <p style="margin:0;font:400 14px/1.6 ${SANS};color:${C.grey};">
          ${q.email
            ? `Hit <strong style="color:${C.inkSoft};">Reply</strong> to email ${esc(q.name.split(' ')[0])} back, or call the number above.`
            : `No email address was given — call the number above to get back to ${esc(q.name.split(' ')[0])}.`}
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td bgcolor="${C.inkDeep}" style="background:${C.inkDeep};padding:20px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="left" style="font:400 12px/1.6 ${SANS};color:#8A929C;">
              Sent from the Truecraft website
            </td>
            <td align="right" style="font:400 12px/1.6 ${SANS};color:#8A929C;white-space:nowrap;">
              ${esc(received)}
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

export function renderText(q, opts = {}) {
  return [
    'NEW QUOTE REQUEST — Truecraft website',
    '='.repeat(40),
    '',
    `${q.name} wants a quote for ${q.job}${q.suburb ? ' in ' + q.suburb : ''}.`,
    '',
    `Phone:    ${q.phone}`,
    q.email ? `Email:    ${q.email}` : null,
    q.suburb ? `Suburb:   ${q.suburb}` : null,
    `Job type: ${q.job}`,
    `Photos:   ${q.photoCount ? q.photoCount + ' attached' : 'none supplied'}`,
    '',
    q.details ? ['What they are after:', q.details, ''].join('\n') : null,
    q.email ? 'Reply to this email to reach them, or call the number above.' : 'Call the number above to get back to them.',
    '',
    formatReceived(opts.now),
  ].filter(v => v !== null).join('\n');
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function row(label, value, href) {
  if (!value) return '';
  const inner = href
    ? `<a href="${esc(href)}" style="color:${C.green};text-decoration:none;">${esc(value)}</a>`
    : esc(value);
  return `<tr>
    <td width="110" style="width:110px;padding:11px 14px 11px 0;border-bottom:1px solid ${C.line};font:700 11px/1.5 ${SANS};color:${C.grey};letter-spacing:.12em;text-transform:uppercase;vertical-align:top;">${esc(label)}</td>
    <td style="padding:11px 0;border-bottom:1px solid ${C.line};font:400 15px/1.5 ${SANS};color:${C.ink};">${inner}</td>
  </tr>`;
}

function formatReceived(now) {
  const d = now instanceof Date ? now : new Date();
  try {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Perth',
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d).replace(/ /g, ' ') + ' AWST';
  } catch (e) {
    return d.toISOString();
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
