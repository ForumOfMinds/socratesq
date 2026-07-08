// redeem-invite.js
// Called once after a new member's first sign-in when they arrived via an invite link.
// Credits both the inviter and invitee with +1 conversation credit.
// Marks the invite as credited so it can only be used once.

const SB_URL = 'https://lhreleeqqchskicxgocc.supabase.co';

async function sbGet(path, sbKey) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { 'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey }
  });
  return res.json();
}

async function sbPatch(path, body, sbKey) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${sbKey}`, 'apikey': sbKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function sbUpsert(body, sbKey) {
  return fetch(`${SB_URL}/rest/v1/usage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sbKey}`,
      'apikey': sbKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbKey) return { statusCode: 500, body: JSON.stringify({ error: 'Config error' }) };

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

  let inviteCode;
  try {
    const body = JSON.parse(event.body || '{}');
    inviteCode = body.inviteCode;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (!inviteCode) return { statusCode: 400, body: JSON.stringify({ error: 'No invite code provided' }) };

  try {
    // Verify the invitee's token
    const authRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': sbKey }
    });
    if (!authRes.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };
    const { id: inviteeId } = await authRes.json();

    // Look up the invite
    const inviteRows = await sbGet(`invites?code=eq.${inviteCode}&select=code,inviter_id,invitee_id,credited`, sbKey);
    if (!Array.isArray(inviteRows) || inviteRows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invite code not found' }) };
    }

    const invite = inviteRows[0];

    // Guard: already credited
    if (invite.credited) {
      return { statusCode: 200, body: JSON.stringify({ status: 'already_credited' }) };
    }

    // Guard: cannot redeem your own invite
    if (invite.inviter_id === inviteeId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cannot redeem your own invite code' }) };
    }

    const inviterId = invite.inviter_id;

    // Get current credits for both parties
    const [inviterRows, inviteeRows] = await Promise.all([
      sbGet(`usage?user_id=eq.${inviterId}&select=credits`, sbKey),
      sbGet(`usage?user_id=eq.${inviteeId}&select=credits`, sbKey)
    ]);

    const inviterCredits = (Array.isArray(inviterRows) && inviterRows.length > 0) ? (inviterRows[0].credits || 0) : 0;
    const inviteeCredits = (Array.isArray(inviteeRows) && inviteeRows.length > 0) ? (inviteeRows[0].credits || 0) : 0;

    // Credit both parties (+1 each)
    await Promise.all([
      sbUpsert({ user_id: inviterId, credits: inviterCredits + 1 }, sbKey),
      sbUpsert({ user_id: inviteeId, credits: inviteeCredits + 1 }, sbKey)
    ]);

    // Mark invite as credited
    await sbPatch(
      `invites?code=eq.${inviteCode}`,
      { invitee_id: inviteeId, credited: true, credited_at: new Date().toISOString() },
      sbKey
    );

    console.log(`Invite ${inviteCode} redeemed: inviter ${inviterId} and invitee ${inviteeId} each credited +1`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'credited', inviterCredits: inviterCredits + 1, inviteeCredits: inviteeCredits + 1 })
    };
  } catch (err) {
    console.error('redeem-invite error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
