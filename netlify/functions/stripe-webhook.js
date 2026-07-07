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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sbKey         = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey     = process.env.STRIPE_SECRET_KEY;

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
      const userId     = obj.client_reference_id || obj.metadata?.userId;
      const type       = obj.metadata?.type;
      const customerId = obj.customer;

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
