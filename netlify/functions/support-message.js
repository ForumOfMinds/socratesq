// Support escalation endpoint.
// Receives a message the person typed in the in-app support widget (Tier 2,
// "Contact a person") and forwards it to a PRIVATE support inbox via Resend.
//
// The destination address lives ONLY in the SUPPORT_EMAIL environment variable
// in Netlify — it never appears in this code, in the client, or anywhere on the
// site, so it can't be scraped by spam bots. The person who writes in never sees
// an address; they just get a plain confirmation that their message was sent.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const resendKey = process.env.RESEND_API_KEY;
  const supportInbox = process.env.SUPPORT_EMAIL; // private, never exposed
  if (!resendKey || !supportInbox) {
    // Fail gracefully — don't reveal configuration details to the client.
    return { statusCode: 500, body: JSON.stringify({ error: 'Support is temporarily unavailable. Please try again later.' }) };
  }

  let message, fromEmail, context;
  try {
    const parsed = JSON.parse(event.body || '{}');
    message   = (parsed.message   || '').toString().slice(0, 4000);
    fromEmail = (parsed.fromEmail || '').toString().slice(0, 200);
    context   = (parsed.context   || '').toString().slice(0, 500);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request.' }) };
  }

  if (!message.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please include a message.' }) };
  }

  const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const when = new Date().toISOString();

  const html = `<div style="font-family:Georgia,serif;color:#1a1a1a;line-height:1.6;">
    <h2 style="color:#9a7b3f;font-size:18px;">SocratesQ — support message</h2>
    <p style="margin:0 0 6px;"><strong>From:</strong> ${esc(fromEmail) || '(not signed in / no email given)'}</p>
    ${context ? `<p style="margin:0 0 6px;"><strong>Where:</strong> ${esc(context)}</p>` : ''}
    <p style="margin:0 0 12px;"><strong>Received:</strong> ${esc(when)}</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;">
    <p style="white-space:pre-wrap;">${esc(message)}</p>
  </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SocratesQ Support <help@socratesq.app>',
        to: [supportInbox],
        // If the person gave an email, set reply-to so a reply goes straight to
        // them — the reply is composed privately by a human, never auto-sent.
        ...(fromEmail ? { reply_to: fromEmail } : {}),
        subject: 'SocratesQ support message',
        html
      })
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('Support Resend error:', detail);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not send your message right now. Please try again shortly.' }) };
    }
  } catch (e) {
    console.error('Support send error:', e.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not send your message right now. Please try again shortly.' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
