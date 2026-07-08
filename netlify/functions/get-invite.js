// get-invite.js
// Returns the authenticated user's invite code, generating one if they don't have one yet.
// The invite link is: https://socratesq.app/?invite={code}
// When a friend uses the link and creates an account, both parties receive +1 credit.

const SB_URL = 'https://lhreleeqqchskicxgocc.supabase.co';
const CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1 to avoid confusion

function generateCode() {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbKey) return { statusCode: 500, body: JSON.stringify({ error: 'Config error' }) };

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

  try {
    // Verify token
    const authRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': sbKey }
    });
    if (!authRes.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };
    const { id: userId } = await authRes.json();

    // Check if user already has an invite code in the usage table
    const usageRes = await fetch(
      `${SB_URL}/rest/v1/usage?user_id=eq.${userId}&select=invite_code`,
      { headers: { 'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey } }
    );
    const rows = await usageRes.json();
    const existingCode = (Array.isArray(rows) && rows.length > 0) ? rows[0].invite_code : null;

    if (existingCode) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: existingCode })
      };
    }

    // Generate a new unique code
    let code = generateCode();
    let attempts = 0;

    while (attempts < 5) {
      // Check uniqueness in invites table
      const checkRes = await fetch(
        `${SB_URL}/rest/v1/invites?code=eq.${code}&select=code`,
        { headers: { 'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey } }
      );
      const existing = await checkRes.json();
      if (!Array.isArray(existing) || existing.length === 0) break; // unique
      code = generateCode();
      attempts++;
    }

    // Store invite code in invites table
    const createRes = await fetch(`${SB_URL}/rest/v1/invites`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sbKey}`,
        'apikey': sbKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ code, inviter_id: userId })
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error('Failed to create invite:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Could not generate invite code' }) };
    }

    // Store code in usage table for fast lookup
    await fetch(`${SB_URL}/rest/v1/usage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sbKey}`,
        'apikey': sbKey,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ user_id: userId, invite_code: code })
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    };
  } catch (err) {
    console.error('get-invite error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
