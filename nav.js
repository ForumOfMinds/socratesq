/* ============================================================
   SocratesQ — shared header & footer (nav.js)
   One source of truth for navigation on every page.

   USAGE — on each page:
     1. Add  <div id="sq-header"></div>  right after <body>
     2. Add  <div id="sq-footer"></div>  right before </body>
     3. Add  <script src="/nav.js" defer></script>  in <head>
     4. Make sure /shared.css is linked in <head>
   ============================================================ */

(function () {
  "use strict";

  /* ---------- 1. CONFIG ---------- */

  var LINKS = [
    { href: "/about",      label: "About" },
    { href: "/socrates",   label: "The Socratic Method" },
    { href: "/dialogues",  label: "Sample Dialogues" },
    { href: "/membership", label: "Membership" }
  ];

  // Where the two primary actions lead.
  // ADJUST these two paths if your app uses different entry URLs.
  var CTA_SIGNED_OUT = { href: "/#today",        label: "Answer today\u2019s question" };
  var CTA_SIGNED_IN  = { href: "/?dialogue=new", label: "Enter a dialogue \u2192" };

  var ACCOUNT_LINK = { href: "/account", label: "Account" };
  var SIGNIN_LINK  = { href: "/#signin", label: "Sign in" };
  // If your sign-in is a modal on the landing page, "/#signin" can be
  // intercepted there; on other pages it simply routes home.

  /* ---------- 2. ANIMATED LOGO ----------
     Self-contained placeholder: a laurel-ringed question mark whose
     stroke draws itself on page load, then rests (no perpetual motion,
     so it never competes with reading).

     TO USE YOUR EXISTING LOGO from the Socratic Method page instead:
     replace everything between LOGO-START and LOGO-END with the markup
     copied from socrates.html, and move its @keyframes into shared.css.
  ------------------------------------------------------------ */
  /* LOGO-START */
  var LOGO_SVG =
    '<svg class="sq-logo-mark" viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">' +
      '<circle class="sq-logo-ring" cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<path class="sq-logo-q" d="M18 19 q0-7 6.5-7 q6.5 0 6.5 6.2 q0 4.4-4.2 6.4 q-2.6 1.3-2.6 4.4" ' +
        'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle class="sq-logo-dot" cx="24.2" cy="35.5" r="1.9" fill="currentColor" stroke="none"/>' +
    '</svg>';
  /* LOGO-END */

  /* ---------- 3. AUTH STATE (Supabase-aware, defensive) ---------- */

  function authFromLocalStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") > -1) {
          var v = JSON.parse(localStorage.getItem(k));
          if (v && (v.access_token || (v.currentSession && v.currentSession.access_token))) return true;
        }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function getAuthState() {
    // Manual override hook: set  window.sqAuth = true/false  before nav.js
    if (typeof window.sqAuth === "boolean") return Promise.resolve(window.sqAuth);

    var sb = window.supabaseClient || (window.supabase && window.supabase.auth ? window.supabase : null);
    if (sb && sb.auth && typeof sb.auth.getSession === "function") {
      return sb.auth.getSession()
        .then(function (r) { return !!(r && r.data && r.data.session); })
        .catch(function () { return authFromLocalStorage(); });
    }
    return Promise.resolve(authFromLocalStorage());
  }

  /* ---------- 4. RENDER ---------- */

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function isActive(href) {
    var p = location.pathname.replace(/\/+$/, "") || "/";
    var h = href.replace(/\/+$/, "") || "/";
    return p === h || p === h + ".html";
  }

  function linkList(cls) {
    return LINKS.map(function (l) {
      return '<a class="' + cls + (isActive(l.href) ? " is-active" : "") +
             '" href="' + l.href + '">' + esc(l.label) + "</a>";
    }).join("");
  }

  function renderHeader(signedIn) {
    var cta  = signedIn ? CTA_SIGNED_IN : CTA_SIGNED_OUT;
    var auth = signedIn ? ACCOUNT_LINK : SIGNIN_LINK;

    return '' +
    '<header class="sq-nav" role="banner">' +
      '<a class="sq-logo" href="/" aria-label="SocratesQ home">' +
        LOGO_SVG +
        '<span class="sq-logo-word">Socrates<span class="sq-logo-word-q">Q</span></span>' +
      '</a>' +
      '<nav class="sq-nav-links" aria-label="Main">' +
        linkList("sq-nav-link") +
        '<a class="sq-nav-link sq-nav-auth' + (isActive(auth.href) ? " is-active" : "") +
          '" href="' + auth.href + '">' + esc(auth.label) + "</a>" +
      '</nav>' +
      '<a class="sq-cta" href="' + cta.href + '">' + esc(cta.label) + "</a>" +
      '<button class="sq-burger" aria-label="Open menu" aria-expanded="false" aria-controls="sq-overlay">' +
        '<span></span><span></span><span></span>' +
      '</button>' +
    '</header>' +
    '<div class="sq-overlay" id="sq-overlay" hidden>' +
      '<button class="sq-overlay-close" aria-label="Close menu">&times;</button>' +
      '<nav class="sq-overlay-links" aria-label="Main menu">' +
        linkList("sq-overlay-link") +
        '<a class="sq-overlay-link sq-overlay-auth" href="' + auth.href + '">' + esc(auth.label) + "</a>" +
        '<a class="sq-cta sq-overlay-cta" href="' + cta.href + '">' + esc(cta.label) + "</a>" +
      '</nav>' +
    '</div>';
  }

  function renderFooter() {
    return '' +
    '<footer class="sq-footer" role="contentinfo">' +
      '<nav class="sq-footer-links" aria-label="Footer">' +
        '<a href="/disclaimer">Before We Begin</a>' +
        '<span class="sq-footer-dot">\u00B7</span>' +
        '<a href="https://forumofminds.com" rel="noopener">Forum of Minds</a>' +
        '<span class="sq-footer-dot">\u00B7</span>' +
        '<a href="mailto:help@socratesq.app">help@socratesq.app</a>' +
      '</nav>' +
      '<p class="sq-footer-note">&copy; ' + new Date().getFullYear() +
        ' SocratesQ \u00B7 Nothing you say here is stored, shared, or sold.</p>' +
    '</footer>';
  }

  /* ---------- 5. MOBILE OVERLAY BEHAVIOR ---------- */

  function wireOverlay(root) {
    var burger  = root.querySelector(".sq-burger");
    var overlay = root.querySelector(".sq-overlay");
    if (!burger || !overlay) return;

    function open()  { overlay.hidden = false; requestAnimationFrame(function () { overlay.classList.add("is-open"); }); burger.setAttribute("aria-expanded", "true");  document.body.classList.add("sq-no-scroll"); }
    function close() { overlay.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); document.body.classList.remove("sq-no-scroll"); setTimeout(function () { overlay.hidden = true; }, 260); }

    burger.addEventListener("click", open);
    overlay.querySelector(".sq-overlay-close").addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target.tagName === "A") close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !overlay.hidden) close(); });
  }

  /* ---------- 6. BOOT ---------- */

  function boot() {
    var headerSlot = document.getElementById("sq-header");
    var footerSlot = document.getElementById("sq-footer");

    // Render immediately as signed-out (no layout flash), upgrade if session found.
    if (headerSlot) { headerSlot.innerHTML = renderHeader(false); wireOverlay(headerSlot); }
    if (footerSlot) { footerSlot.innerHTML = renderFooter(); }

    getAuthState().then(function (signedIn) {
      if (signedIn && headerSlot) { headerSlot.innerHTML = renderHeader(true); wireOverlay(headerSlot); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
