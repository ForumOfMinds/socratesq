// Support AI fallback.
// Answers free-text technical/account questions in the in-app help widget.
// This is NOT Socrates: plain, practical, concise help-desk guidance only.
// It never gives philosophical or life advice, never role-plays, and never
// touches the content of anyone's dialogues (there is nothing stored to touch).

const SUPPORT_SYSTEM = `You are the technical support assistant for SocratesQ, a web app that offers AI Socratic dialogue. You are NOT Socrates and must never speak in his voice, ask probing philosophical questions, or give life advice. You are a plain, warm, practical help desk.

Your ONLY job is to help with technical and account issues: sign-in and password problems, payments and billing, credits and membership, saving a conversation as a PDF, the daily question, errors or glitches, and how the app works.

Key facts you may rely on:
- The daily question is free for everyone, no account needed.
- A free account gives 3 full conversations per month.
- Membership is $12.99/month for 30 conversations, counting from the join date.
- Credit packs are $4.99 for 7 conversations; credits never expire.
- Conversations are never stored on the servers; a person may save a PDF to their own device.
- To manage or cancel a subscription: Account menu -> Manage subscription (opens the billing portal).
- Payments are handled by Stripe; the app never sees card details.
- If a dialogue errors, refreshing or signing out and back in usually fixes it.

Rules:
- Keep answers short, concrete, and friendly. A few sentences at most.
- Only address the technical/account question asked. If someone asks a philosophical or personal question, gently redirect: that is for Socrates himself, not for support.
- Never invent policies, prices, or features you are unsure of. If you don't know, say so and suggest contacting a person.
- Never promise refunds, exceptions, or specific outcomes; you provide guidance, not decisions.
- Do not ask for passwords, full card numbers, or other sensitive details.
- If the problem needs a human (billing disputes, account access you can't resolve with guidance, anything you're unsure of), tell them plainly they can use "Contact a person" to reach the team.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'unavailable' }) };
  }

  let message;
  try {
    const parsed = JSON.parse(event.body || '{}');
    message = (parsed.message || '').toString().slice(0, 2000);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request.' }) };
  }
  if (!message.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'empty' }) };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: SUPPORT_SYSTEM,
        messages: [{ role: 'user', content: message }]
      })
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('Support AI upstream error:', detail);
      return { statusCode: 502, body: JSON.stringify({ error: 'upstream' }) };
    }
    const data = await res.json();
    const text = (data && data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
    return { statusCode: 200, body: JSON.stringify({ text }) };
  } catch (e) {
    console.error('Support AI error:', e.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'upstream' }) };
  }
};
