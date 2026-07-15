/* ═══════════════════════════════════════════════════════════════
   SocratesQ in-app support widget (shared across all pages).
   Scripted-first, AI fallback, then "Contact a person" escalation
   (message emailed to a private inbox via /api/support-message).
   Purely technical/account help. Not Socrates. No address shown.
   Loaded on every page via <script src="/support.js" defer>.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  if (window.__sqSupportLoaded) return;      // guard against double-load
  window.__sqSupportLoaded = true;

  // ---- styles ----
  var css = ''
    + '#sqSupportBtn{position:fixed;bottom:18px;right:18px;z-index:1200;background:var(--sq-ink-2,#1a1f22);color:var(--sq-parchment,#ece5d4);border:1px solid var(--sq-gold,#c9a24b);border-radius:24px;font-family:"Inter",sans-serif;font-size:13px;padding:9px 16px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35);transition:background .2s,color .2s;}'
    + '#sqSupportBtn:hover{background:var(--sq-gold,#c9a24b);color:#20180a;}'
    + '#sqSupportPanel{position:fixed;bottom:62px;right:18px;z-index:1200;width:340px;max-width:calc(100vw - 36px);background:var(--sq-ink,#14181a);border:1px solid rgba(201,162,75,.35);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden;font-family:"Inter",sans-serif;}'
    + '#sqSupportPanel.open{display:flex;}'
    + '.sqsup-head{padding:14px 16px;border-bottom:1px solid rgba(201,162,75,.2);display:flex;align-items:center;justify-content:space-between;}'
    + '.sqsup-head h3{margin:0;font-family:"EB Garamond",serif;font-size:16px;color:var(--sq-parchment,#ece5d4);font-weight:500;}'
    + '.sqsup-close{background:none;border:none;color:var(--sq-dim,#8a8578);font-size:20px;cursor:pointer;line-height:1;}'
    + '.sqsup-body{padding:14px 16px;max-height:400px;overflow-y:auto;}'
    + '.sqsup-intro{font-size:13px;color:var(--sq-parchment-dim,#b8b2a4);line-height:1.5;margin:0 0 12px;}'
    + '.sqsup-q{display:block;width:100%;text-align:left;background:var(--sq-ink-2,#1a1f22);border:1px solid rgba(201,162,75,.18);color:var(--sq-parchment,#ece5d4);font-family:"Inter",sans-serif;font-size:13px;padding:10px 12px;border-radius:10px;cursor:pointer;margin-bottom:8px;transition:border-color .2s;}'
    + '.sqsup-q:hover{border-color:var(--sq-gold,#c9a24b);}'
    + '.sqsup-answer{font-size:13px;color:var(--sq-parchment,#ece5d4);line-height:1.6;background:var(--sq-ink-2,#1a1f22);border-radius:10px;padding:12px 14px;margin-bottom:12px;}'
    + '.sqsup-answer strong{color:var(--sq-gold,#c9a24b);}'
    + '.sqsup-ta{width:100%;box-sizing:border-box;resize:none;background:var(--sq-ink-2,#1a1f22);border:1px solid rgba(201,162,75,.25);color:var(--sq-parchment,#ece5d4);font-family:"Inter",sans-serif;font-size:13px;padding:10px 12px;border-radius:10px;outline:none;min-height:88px;margin-bottom:8px;}'
    + '.sqsup-send{background:var(--sq-gold,#c9a24b);color:#20180a;border:none;font-family:"Inter",sans-serif;font-weight:600;font-size:13px;padding:10px 16px;border-radius:10px;cursor:pointer;width:100%;}'
    + '.sqsup-send:disabled{opacity:.6;cursor:default;}'
    + '.sqsup-link{background:none;border:none;color:var(--sq-gold,#c9a24b);font-family:"Inter",sans-serif;font-size:13px;cursor:pointer;text-decoration:underline;padding:4px 0;}'
    + '.sqsup-back{background:none;border:none;color:var(--sq-dim,#8a8578);font-family:"Inter",sans-serif;font-size:12px;cursor:pointer;padding:4px 0;margin-top:4px;text-decoration:underline;}'
    + '.sqsup-note{font-size:12px;color:var(--sq-dim,#8a8578);line-height:1.5;margin:8px 0 0;}'
    + '@media (max-width:520px){#sqSupportPanel{bottom:58px;}}';

  var SUPPORT_INTENTS = [
    { q: 'My payment didn\u2019t go through',
      a: 'If a payment failed, nothing was charged \u2014 you can safely try again. Make sure the card details and billing ZIP are correct, and that the card allows online payments. If your bank flagged it, approving the charge in your banking app and retrying usually works. Still stuck after a second try? Use \u201cContact a person\u201d below and we\u2019ll look into it.' },
    { q: 'I paid but my credits / membership didn\u2019t appear',
      a: 'Purchases usually appear within a minute, but the confirmation can lag slightly behind the payment. Try this: open your <strong>Account</strong> (top menu), then close and reopen it to refresh \u2014 or refresh the page. If your balance still hasn\u2019t updated a few minutes after a successful payment, use \u201cContact a person\u201d and include roughly when you paid.' },
    { q: 'I can\u2019t sign in',
      a: 'First, check the email address is the one you registered with. If you\u2019ve forgotten your password, use the \u201cForgot password\u201d option on the sign-in screen to reset it \u2014 the reset email can take a minute and may land in spam. If you signed up but never confirmed, check your inbox for the original confirmation email. Still locked out? Use \u201cContact a person\u201d and tell us the email you used.' },
    { q: 'The dialogue stopped or showed an error',
      a: 'Occasionally the connection to Socrates falters for a moment. Refreshing the page and sending your message again usually clears it. If it happens repeatedly, signing out and back in refreshes your session and tends to fix it. If it keeps happening, let us know via \u201cContact a person\u201d and describe what you were doing.' },
    { q: 'How do I cancel my membership?',
      a: 'Open your <strong>Account</strong> from the top menu and choose <strong>Manage subscription</strong> \u2014 that opens the billing portal where you can cancel any time. Your membership stays active through the period you\u2019ve already paid for, and nothing renews after that.' },
    { q: 'How do I save my conversation?',
      a: 'At the end of a dialogue you\u2019ll see <strong>Save this dialogue as PDF</strong>. That creates a PDF on your own device \u2014 we keep no copy. It\u2019s the only way a conversation is ever stored anywhere, and only because you chose to save it.' }
  ];

  function esc(s){ return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Best-effort: the signed-in email. On the app page it's exposed as
  // window.currentEmail. On static pages the app isn't running, but the Supabase
  // session (with the user's email) is still in localStorage — dig it out of there.
  function currentEmailForSupport(){
    try { if (typeof window.currentEmail === 'string' && window.currentEmail) return window.currentEmail; } catch(e){}
    try { if (typeof currentEmail === 'string' && currentEmail) return currentEmail; } catch(e){}
    // Fall back to the Supabase auth token stored in localStorage.
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > -1) {
          var v = JSON.parse(localStorage.getItem(k));
          if (!v) continue;
          var u = v.user || (v.currentSession && v.currentSession.user);
          if (u && u.email) return u.email;
        }
      }
    } catch (e) {}
    return '';
  }

  var btn, panel, body, closeBtn;

  function renderMenu() {
    var h = '<p class="sqsup-intro">Pick what\u2019s going on, and we\u2019ll try to sort it out right here. This is technical help \u2014 for your conversations with Socrates, just talk to him.</p>';
    SUPPORT_INTENTS.forEach(function (it, i) { h += '<button class="sqsup-q" data-i="' + i + '">' + esc(it.q) + '</button>'; });
    h += '<button class="sqsup-q" data-other="1">Something else</button>';
    body.innerHTML = h;
    body.querySelectorAll('.sqsup-q').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('data-other')) { renderAsk(''); return; }
        renderAnswer(parseInt(b.getAttribute('data-i'), 10));
      });
    });
  }

  function renderAnswer(i) {
    var it = SUPPORT_INTENTS[i];
    body.innerHTML = '<div class="sqsup-answer">' + it.a + '</div>'
      + '<p class="sqsup-note">Did that solve it? If not, you can contact a person.</p>'
      + '<button class="sqsup-link" id="sqSupEscalate">Contact a person &rarr;</button><br>'
      + '<button class="sqsup-back" id="sqSupBack">&larr; Back to all topics</button>';
    document.getElementById('sqSupEscalate').addEventListener('click', function () { renderContact(it.q, ''); });
    document.getElementById('sqSupBack').addEventListener('click', renderMenu);
  }

  function renderAsk(context) {
    body.innerHTML = '<p class="sqsup-intro">Tell us what\u2019s happening and we\u2019ll do our best to help.</p>'
      + '<textarea class="sqsup-ta" id="sqSupText" placeholder="Describe the problem\u2026"></textarea>'
      + '<button class="sqsup-send" id="sqSupTry">Get help</button>'
      + '<button class="sqsup-back" id="sqSupBack">&larr; Back to all topics</button>';
    document.getElementById('sqSupBack').addEventListener('click', renderMenu);
    document.getElementById('sqSupTry').addEventListener('click', function () { tryAI(context); });
  }

  async function tryAI(context) {
    var ta = document.getElementById('sqSupText');
    var text = (ta.value || '').trim();
    if (!text) { ta.focus(); return; }
    var sendBtn = document.getElementById('sqSupTry');
    sendBtn.disabled = true; sendBtn.textContent = 'Thinking\u2026';
    var answer = '';
    try {
      var res = await fetch('/api/support-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      if (res.ok) { var d = await res.json(); answer = (d && d.text) ? d.text : ''; }
    } catch (e) {}
    if (answer) {
      body.innerHTML = '<div class="sqsup-answer">' + esc(answer) + '</div>'
        + '<p class="sqsup-note">If that didn\u2019t resolve it, you can contact a person.</p>'
        + '<button class="sqsup-link" id="sqSupEscalate">Contact a person &rarr;</button><br>'
        + '<button class="sqsup-back" id="sqSupBack">&larr; Back to all topics</button>';
      document.getElementById('sqSupEscalate').addEventListener('click', function () { renderContact(context, text); });
      document.getElementById('sqSupBack').addEventListener('click', renderMenu);
    } else {
      renderContact(context, text);
    }
  }

  function renderContact(context, prefill) {
    var known = currentEmailForSupport();
    var emailBlock = '';
    if (!known) {
      // Not signed in — we have no way to reply unless they tell us. Ask for an
      // email (optional but encouraged), and offer sign-in as the smoother path.
      emailBlock =
        '<p class="sqsup-note" style="margin:0 0 8px;">Signed in? <button type="button" class="sqsup-link" id="sqSupSignin" style="font-size:12px;">Sign in first</button> and we\u2019ll already have your details. Otherwise, leave your email so we can reply:</p>'
        + '<input type="email" class="sqsup-ta" id="sqSupEmail" style="min-height:0;" placeholder="you@example.com (so we can reply)" />';
    }
    body.innerHTML =
      '<p class="sqsup-intro">Leave your message and we\u2019ll get back to you \u2014 usually within a day.</p>'
      + emailBlock
      + '<textarea class="sqsup-ta" id="sqSupMsg" placeholder="Your message\u2026">' + esc(prefill || '') + '</textarea>'
      + '<button class="sqsup-send" id="sqSupSend">Send message</button>'
      + '<button class="sqsup-back" id="sqSupBack">&larr; Back to all topics</button>';
    document.getElementById('sqSupBack').addEventListener('click', renderMenu);
    document.getElementById('sqSupSend').addEventListener('click', function () { sendContact(context); });
    var si = document.getElementById('sqSupSignin');
    if (si) si.addEventListener('click', function () { window.location.href = '/#signin'; });
  }

  async function sendContact(context) {
    var msgEl = document.getElementById('sqSupMsg');
    var msg = (msgEl.value || '').trim();
    if (!msg) { msgEl.focus(); return; }

    // Reply address: the signed-in email if we have one, otherwise whatever they typed.
    var email = currentEmailForSupport();
    var emailEl = document.getElementById('sqSupEmail');
    if (!email && emailEl) {
      email = (emailEl.value || '').trim();
      // Encourage (but don't hard-require) a valid-looking email so we can reply.
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailEl.focus(); return; }
    }

    var sendBtn = document.getElementById('sqSupSend');
    sendBtn.disabled = true; sendBtn.textContent = 'Sending\u2026';
    try {
      var res = await fetch('/api/support-message', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, fromEmail: email, context: context || ('page: ' + location.pathname) }) });
      if (res.ok) {
        var replyLine = email
          ? 'Your message has been sent \u2014 we\u2019ll get back to you at ' + esc(email) + ', usually within a day.'
          : 'Your message has been sent \u2014 we\u2019ll get back to you, usually within a day.';
        body.innerHTML = '<div class="sqsup-answer">' + replyLine + '</div>'
          + '<button class="sqsup-back" id="sqSupBack">&larr; Back to all topics</button>';
        document.getElementById('sqSupBack').addEventListener('click', renderMenu);
      } else {
        sendBtn.disabled = false; sendBtn.textContent = 'Send message';
        var note = document.createElement('p'); note.className = 'sqsup-note';
        note.textContent = 'That didn\u2019t go through. Please try again in a moment.';
        msgEl.parentNode.insertBefore(note, sendBtn.nextSibling);
      }
    } catch (e) {
      sendBtn.disabled = false; sendBtn.textContent = 'Send message';
    }
  }

  function openPanel() { renderMenu(); panel.classList.add('open'); }
  function closePanel() { panel.classList.remove('open'); }

  function build() {
    if (document.getElementById('sqSupportBtn')) return; // already present (e.g. app page)
    var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    btn = document.createElement('button');
    btn.id = 'sqSupportBtn'; btn.setAttribute('aria-label', 'Get help'); btn.textContent = 'Help';

    panel = document.createElement('div');
    panel.id = 'sqSupportPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Support');
    panel.innerHTML = '<div class="sqsup-head"><h3>How can we help?</h3><button class="sqsup-close" id="sqSupClose" aria-label="Close">&times;</button></div><div class="sqsup-body" id="sqSupBody"></div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    body = document.getElementById('sqSupBody');
    closeBtn = document.getElementById('sqSupClose');

    btn.addEventListener('click', function () { if (panel.classList.contains('open')) closePanel(); else openPanel(); });
    closeBtn.addEventListener('click', closePanel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
