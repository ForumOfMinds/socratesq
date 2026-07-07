// create-checkout.js
// Creates a Stripe Checkout session and returns the hosted payment URL.
// The app redirects the user to that URL; Stripe handles all card entry.

const PRICE_IDS = {
  subscription: 'price_1TqeKmKAcUpQXAEIjkA4lSp9',  // $12.99/month
  credits:      'price_1TqeMMKAcUpQXAEI4sFH60Hc'   // $4.99 one-time / 7 conversations
};

const BASE_URL = 'https://socratesq.app';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let type, userId, email;
  try {
    const body = JSON.parse(event.body || '{}');
    type    = body.type;
    userId  = body.userId;
    email   = body.email;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!type || !PRICE_IDS[type]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid type — must be "subscription" or "credits"' }) };
  }
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  const isSubscription = type === 'subscription';

  const params = new URLSearchParams();
  params.append('payment_method_types[]', 'card');
  params.append('line_items[0][price]',    PRICE_IDS[type]);
  params.append('line_items[0][quantity]', '1');
  params.append('mode',                    isSubscription ? 'subscription' : 'payment');
  params.append('client_reference_id',     userId);
  params.append('metadata[type]',          type);
  params.append('metadata[userId]',        userId);
  params.append('success_url',             `${BASE_URL}/?payment=success&type=${type}`);
  params.append('cancel_url',              `${BASE_URL}/?payment=cancelled`);
  if (email) params.append('customer_email', email);

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${stripeKey}`,
        'Content-Type':   'application/x-www-form-urlencoded'
      },
      body: params
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Stripe API error:', data.error?.message);
      return { statusCode: 502, body: JSON.stringify({ error: data.error?.message || 'Stripe error' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: data.url })
    };
  } catch (err) {
    console.error('Checkout error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
