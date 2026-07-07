// create-portal.js
// Creates a Stripe Customer Portal session and returns the URL.
// Subscribers are redirected there to manage or cancel their subscription.
// Requires: Stripe Customer Portal enabled in Stripe Dashboard → Settings → Billing → Customer portal

const SB_URL    = 'https://lhreleeqqchskicxgocc.supabase.co';
const RETURN_URL = 'https://socratesq.app/';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const sbKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !sbKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  try {
    // Verify token
    const authRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': sbKey }
    });
    if (!authRes.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session — please sign in again' }) };
    }
    const { id: userId } = await authRes.json();

    // Get Stripe customer ID from Supabase
    const usageRes = await fetch(
      `${SB_URL}/rest/v1/usage?user_id=eq.${userId}&select=stripe_customer_id`,
      { headers: { 'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey } }
    );
    const rows = await usageRes.json();
    const customerId = (Array.isArray(rows) && rows.length > 0) ? rows[0].stripe_customer_id : null;

    if (!customerId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No active subscription found' }) };
    }

    // Create Stripe Customer Portal session
    const params = new URLSearchParams();
    params.append('customer',   customerId);
    params.append('return_url', RETURN_URL);

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type':  'application/x-www-form-urlencoded'
      },
      body: params
    });

    const portal = await portalRes.json();

    if (!portalRes.ok) {
      console.error('Stripe portal error:', portal.error?.message);
      return { statusCode: 502, body: JSON.stringify({ error: portal.error?.message || 'Could not open portal' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: portal.url })
    };
  } catch (err) {
    console.error('create-portal error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
