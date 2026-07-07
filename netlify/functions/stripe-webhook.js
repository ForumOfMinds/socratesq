// stripe-webhook.js
// Receives and verifies Stripe events, then updates Supabase accordingly.
// checkout.session.completed  → activate subscription OR add credits
// customer.subscription.deleted → revert plan to free
// invoice.payment_failed → log (Stripe handles retries automatically)

const crypto = require('crypto');

const SUPABASE_URL = 'https://lhreleeqqchskicxgocc.supabase.co';

/* ---- Stripe signature verification (no SDK — uses Node crypto) ---- */
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  try {
    const parts     = sigHeader.split(',');
    const tPart     = parts.find(p => p.startsWith('t='));
    if (!tPart) return false;
    const timestamp  = tPart.slice(2);
    const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
    const signed     = `${timestamp}.${rawBody}`;
    const expected   = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
    return signatures.some(sig => {
      try { return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')); }
      catch { return false; }
    });
  } catch (e) {
    return false;
  }
}

/* ---- Supabase REST helper ---- */
async function sb(method, path, body, sbKey, prefer) {
  const headers = {
    'Authorization': `Bearer ${sbKey}`,
    'apikey':        sbKey,
    'Content-Type':  'application/json'
  };
  if (prefer) headers['Prefer'] = prefer;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

/* ---- Email confirmation via Resend ---- */
async function sendEmail(to, subject, html, resendKey) {
  if (!resendKey || !to) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SocratesQ <welcome@socratesq.app>',
        to:   [to],
        subject,
        html
      })
    });
    if (!res.ok) console.error('Resend error:', await res.text());
    else console.log('Confirmation email sent to', to);
  } catch (e) {
    console.error('Email send error:', e.message);
  }
}

function subscriptionEmailHtml(renewalDate) {
  return `<div style="background:#14181a;padding:40px 24px;font-family:Georgia,serif;">
  <div style="max-width:480px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:24px;color:#ece5d4;letter-spacing:.04em;">Socrates<span style="color:#c9a24b;">Q</span></span>
    </div>
    <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#ece5d4;margin:0 0 16px;">Your membership is active.</h2>
    <p style="font-size:17px;color:#b9b3a3;line-height:1.65;margin:0 0 20px;">
      You now have <strong style="color:#ece5d4;">30 conversations with Socrates</strong> every month &mdash; enough to bring your real questions, return to a thread, and think something through properly.
    </p>
    <div style="background:#1d2326;border:1px solid #2a3236;border-radius:10px;padding:20px 22px;margin:0 0 24px;">
      <p style="font-size:15px;color:#b9b3a3;margin:0 0 10px;font-family:Georgia,serif;"><strong style="color:#c9a24b;">What&rsquo;s included:</strong></p>
      <ul style="font-size:15px;color:#b9b3a3;line-height:1.8;margin:0;padding-left:18px;">
        <li>30 dialogues per month, resetting on your renewal date</li>
        <li>The daily question &mdash; one question from Socrates each morning</li>
        <li>Save any dialogue as a PDF keepsake</li>
        <li>Access to the Forum of Minds as it grows</li>
      </ul>
      ${renewalDate ? `<p style="font-size:13px;color:#676d68;margin:14px 0 0;font-family:Georgia,sans-serif;">Next renewal: ${renewalDate}</p>` : ''}
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://socratesq.app" style="background:#c9a24b;color:#20180a;font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:13px 32px;border-radius:8px;text-decoration:none;display:inline-block;">Return to SocratesQ &rarr;</a>
    </div>
    <p style="font-size:13px;color:#676d68;line-height:1.6;margin:0;">
      You can manage or cancel your subscription at any time from your account page within the app.
    </p>
    <hr style="border:none;border-top:1px solid #2a3236;margin:28px 0;" />
    <p style="font-size:12px;color:#676d68;text-align:center;line-height:1.6;margin:0;">
      SocratesQ &nbsp;&middot;&nbsp; A project of The Forum of Minds Society<br/>
      A philosophical reconstruction &mdash; not the historical figure, and not advice.
    </p>
  </div>
</div>`;
}

function creditsEmailHtml() {
  return `<div style="background:#14181a;padding:40px 24px;font-family:Georgia,serif;">
  <div style="max-width:480px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:24px;color:#ece5d4;letter-spacing:.04em;">Socrates<span style="color:#c9a24b;">Q</span></span>
    </div>
    <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#ece5d4;margin:0 0 16px;">7 conversation credits added.</h2>
    <p style="font-size:17px;color:#b9b3a3;line-height:1.65;margin:0 0 20px;">
      Your account now has <strong style="color:#ece5d4;">7 additional conversation credits</strong>. Credits never expire &mdash; use them whenever you&rsquo;re ready to bring a question to Socrates.
    </p>
    <div style="background:#1d2326;border:1px solid #2a3236;border-radius:10px;padding:20px 22px;margin:0 0 24px;">
      <p style="font-size:15px;color:#b9b3a3;margin:0;font-family:Georgia,serif;">
        Each credit is one full dialogue &mdash; as long as it needs to be, ending whenever you choose. Credits sit in your account until you&rsquo;re ready to use them.
      </p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://socratesq.app" style="background:#c9a24b;color:#20180a;font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:13px 32px;border-radius:8px;text-decoration:none;display:inline-block;">Return to SocratesQ &rarr;</a>
    </div>
    <hr style="border:none;border-top:1px solid #2a3236;margin:28px 0;" />
    <p style="font-size:12px;color:#676d68;text-align:center;line-height:1.6;margin:0;">
      SocratesQ &nbsp;&middot;&nbsp; A project of The Forum of Minds Society<br/>
      A philosophical reconstruction &mdash; not the historical figure, and not advice.
    </p>
  </div>
</div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sbKey         = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey     = process.env.STRIPE_SECRET_KEY;
  const resendKey     = process.env.RESEND_API_KEY;

  if (!webhookSecret || !sbKey) {
    console.error('Missing STRIPE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY');
    return { statusCode: 500, body: 'Server configuration error' };
  }

  const rawBody  = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const sigHeader = event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';

  if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
    console.error('Stripe webhook signature verification failed');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const eventType = stripeEvent.type;
  const obj       = stripeEvent.data.object;

  console.log('Stripe event received:', eventType);

  try {
    /* ---- Payment completed ---- */
    if (eventType === 'checkout.session.completed') {
      const userId          = obj.client_reference_id || obj.metadata?.userId;
      const type            = obj.metadata?.type;
      const customerId      = obj.customer;
      const customerEmail   = obj.customer_details?.email || obj.customer_email || null;

      if (!userId) {
        console.error('No userId found in checkout session');
        return { statusCode: 200, body: JSON.stringify({ received: true }) };
      }

      if (type === 'subscription') {
        // Fetch subscription to get the current period end date
        let subEnd = null;
        if (obj.subscription && stripeKey) {
          try {
            const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, {
              headers: { 'Authorization': `Bearer ${stripeKey}` }
            });
            const sub = await subRes.json();
            if (sub.current_period_end) {
              subEnd = new Date(sub.current_period_end * 1000).toISOString();
            }
          } catch (e) {
            console.error('Could not fetch subscription details:', e.message);
          }
        }

        const currentPeriod = new Date().toISOString().slice(0, 7);
        await sb('POST', 'usage', {
          user_id:             userId,
          plan:                'paid',
          stripe_customer_id:  customerId,
          subscription_end:    subEnd,
          conversations_used:  0,
          period:              currentPeriod,
          credits:             0
        }, sbKey, 'resolution=merge-duplicates');

        console.log(`Subscription activated for user ${userId}, ends ${subEnd}`);
        const renewalFormatted = subEnd
          ? new Date(subEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : null;
        await sendEmail(customerEmail, 'Your SocratesQ Membership is active', subscriptionEmailHtml(renewalFormatted), resendKey);
      }

      if (type === 'credits') {
        // Get current credit balance then add 7
        const getRes = await sb('GET', `usage?user_id=eq.${userId}&select=credits`, null, sbKey);
        const rows   = await getRes.json();
        const current = (Array.isArray(rows) && rows.length > 0) ? (rows[0].credits || 0) : 0;
        const newTotal = current + 7;

        await sb('POST', 'usage', {
          user_id: userId,
          credits: newTotal
        }, sbKey, 'resolution=merge-duplicates');

        console.log(`7 credits added for user ${userId} — new total: ${newTotal}`);
        await sendEmail(customerEmail, '7 conversation credits added to your SocratesQ account', creditsEmailHtml(), resendKey);
      }
    }

    /* ---- Subscription cancelled ---- */
    if (eventType === 'customer.subscription.deleted') {
      const customerId = obj.customer;
      const getRes     = await sb('GET', `usage?stripe_customer_id=eq.${customerId}&select=user_id`, null, sbKey);
      const rows       = await getRes.json();

      if (Array.isArray(rows) && rows.length > 0) {
        const userId = rows[0].user_id;
        await fetch(`${SUPABASE_URL}/rest/v1/usage?user_id=eq.${userId}`, {
          method:  'PATCH',
          headers: {
            'Authorization': `Bearer ${sbKey}`,
            'apikey':        sbKey,
            'Content-Type':  'application/json'
          },
          body: JSON.stringify({ plan: 'free', subscription_end: null })
        });
        console.log(`Subscription cancelled — user ${userId} reverted to free`);
      }
    }

    /* ---- Payment failed ---- */
    if (eventType === 'invoice.payment_failed') {
      // Stripe handles retries automatically — just log for now
      console.log('Invoice payment failed for customer:', obj.customer, '— Stripe will retry');
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return { statusCode: 500, body: 'Handler error' };
  }
};
