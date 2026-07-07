// get-status.js
// Returns the authenticated user's current plan, usage, credits and subscription info.
// Called by the account modal in the app.

const SB_URL = 'https://lhreleeqqchskicxgocc.supabase.co';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  try {
    // Verify token and get user identity
    const authRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': sbKey }
    });
    if (!authRes.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session — please sign in again' }) };
    }
    const user = await authRes.json();
    const userId = user.id;
    const email  = user.email;

    // Fetch usage row
    const usageRes = await fetch(
      `${SB_URL}/rest/v1/usage?user_id=eq.${userId}&select=plan,conversations_used,period,subscription_end,credits,stripe_customer_id`,
      { headers: { 'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey } }
    );
    const rows = await usageRes.json();
    const row  = (Array.isArray(rows) && rows.length > 0) ? rows[0] : {};

    const currentPeriod   = new Date().toISOString().slice(0, 7);
    const plan            = row.plan            || 'free';
    const credits         = row.credits         || 0;
    const subscriptionEnd = row.subscription_end || null;
    const hasCustomer     = !!row.stripe_customer_id;
    const used            = (row.period === currentPeriod) ? (row.conversations_used || 0) : 0;
    const limit           = plan === 'paid' ? 30 : 5;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        plan,
        used,
        limit,
        credits,
        subscription_end: subscriptionEnd,
        has_customer:     hasCustomer
      })
    };
  } catch (err) {
    console.error('get-status error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
