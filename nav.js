/* ============================================================
   SocratesQ — shared header & footer (nav.js)  v2
   One source of truth for navigation on every page.

   USAGE — on each page:
     1. <div id="sq-header"></div>  right after <body>
     2. <div id="sq-footer"></div>  right before </body>
     3. In <head>:
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/shared.css">
        <script src="/nav.js" defer></script>
   ============================================================ */

(function () {
  "use strict";

  /* ---------- 1. CONFIG ---------- */

  var LINKS = [
    { href: "about.html",      label: "About" },
    { href: "socrates.html",   label: "The Socratic Method" },
    { href: "dialogues.html",  label: "Sample Dialogues" },
    { href: "membership.html", label: "Membership" }
  ];

  // Primary action by auth state.
  // Signed OUT: the daily question is already the centrepiece of the landing page,
  // and "Sign in" is already a nav link — so the CTA drives the primary conversion,
  // creating an account. (Returning users use the Sign in link; new users use this.)
  // Signed IN: they land on the full dialogue, so the daily question lives here as their CTA.
  var CTA_SIGNED_OUT = { href: "/#signin",         label: "Create an account" };
  var CTA_SIGNED_IN  = { href: "/#today",          label: "Answer today\u2019s question" };

  var ACCOUNT_LINK = { href: "/#account", label: "Account" };  // opens the account modal on index
  var SIGNIN_LINK  = { href: "/#signin",  label: "Sign in" };  // lands on the index sign-in modal

  var FORUM_URL = "https://www.forumofminds.com";

  /* ---------- 2. ANIMATED LOGO ----------
     Placeholder mark: a ringed question mark that draws itself
     once on page load, then rests.
     TO USE THE EXISTING ANIMATED LOGO from the Socratic Method
     page instead: replace the markup between LOGO-START and
     LOGO-END with that logo's markup, and move its @keyframes
     into shared.css.
  ------------------------------------------------------------ */
  /* LOGO-START — the site's rotating logo (same as the Socratic
     Method page hero), with the circle-Q fallback if the image
     is missing. Sized for the 48px bar. */
  var LOGO_SVG =
    '<img class="sq-logo-img" src="https://socratesq.app/SocratesQ%20logo.png" alt="" aria-hidden="true" ' +
      'onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" />' +
    '<span class="sq-logo-fallback" style="display:none;"><span>Q</span></span>';
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

  function pageKey(path) {
    var seg = path.split("/").pop() || "index.html";
    return seg.replace(/\.html$/, "") || "index";
  }
  function isActive(href) {
    if (href.indexOf("http") === 0) return false;
    return pageKey(location.pathname) === pageKey(href);
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
      '<div class="sq-nav-inner">' +
        '<a class="sq-logo" href="/" aria-label="SocratesQ home">' +
          LOGO_SVG +
          '<span class="sq-logo-word">Socrates<span class="sq-logo-word-q">Q</span></span>' +
        '</a>' +
        '<nav class="sq-nav-links" aria-label="Main">' +
          linkList("sq-nav-link") +
          '<a class="sq-nav-link' + (isActive(auth.href) ? " is-active" : "") +
            '" href="' + auth.href + '">' + esc(auth.label) + "</a>" +
        '</nav>' +
        '<a class="sq-cta" href="' + cta.href + '">' + esc(cta.label) + "</a>" +
        '<button class="sq-burger" aria-label="Open menu" aria-expanded="false" aria-controls="sq-overlay">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
      '</div>' +
    '</header>' +
    '<div class="sq-nav-spacer"></div>' +
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
    var f = LINKS.map(function (l) {
      return '<a href="' + l.href + '"' + (isActive(l.href) ? ' class="is-active"' : '') + '>' + esc(l.label) + "</a>";
    }).join(" &nbsp;&middot;&nbsp; ");

    return '' +
    '<footer class="sq-footer" role="contentinfo">' +
      '<a href="/">SocratesQ</a> &nbsp;&middot;&nbsp; ' + f + ' &nbsp;&middot;&nbsp; ' +
      '<a href="disclaimer.html"' + (isActive("disclaimer.html") ? ' class="is-active"' : '') + '>Before We Begin</a> &nbsp;&middot;&nbsp; ' +
      '<a href="' + FORUM_URL + '" target="_blank" rel="noopener">forumofminds.com</a>' +
      '<div class="sq-footer-note">A project of The Forum of Minds Society &nbsp;&middot;&nbsp; ' +
        '<a href="mailto:help@socratesq.app">help@socratesq.app</a> &nbsp;&middot;&nbsp; &copy; ' +
        new Date().getFullYear() + '</div>' +
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

  // Update only the auth-dependent bits (CTA + account/sign-in link) without
  // rebuilding the whole header. Rebuilding would recreate the logo <img> and
  // cause it to flash and disappear on the second render.
  function applyAuthState(root, signedIn) {
    var cta  = signedIn ? CTA_SIGNED_IN : CTA_SIGNED_OUT;
    var auth = signedIn ? ACCOUNT_LINK : SIGNIN_LINK;

    // The desktop auth link is the last .sq-nav-link inside .sq-nav-links
    var navLinks = root.querySelector(".sq-nav-links");
    if (navLinks) {
      var authLink = navLinks.querySelector(".sq-nav-link:last-child");
      if (authLink) { authLink.setAttribute("href", auth.href); authLink.textContent = auth.label; authLink.classList.toggle("is-active", isActive(auth.href)); }
    }
    // Desktop CTA
    var ctaEl = root.querySelector(".sq-nav .sq-cta");
    if (ctaEl) { ctaEl.setAttribute("href", cta.href); ctaEl.textContent = cta.label; }
    // Overlay auth link
    var ovAuth = root.querySelector(".sq-overlay-auth");
    if (ovAuth) { ovAuth.setAttribute("href", auth.href); ovAuth.textContent = auth.label; }
    // Overlay CTA
    var ovCta = root.querySelector(".sq-overlay-cta");
    if (ovCta) { ovCta.setAttribute("href", cta.href); ovCta.textContent = cta.label; }
  }

  function boot() {
    var headerSlot = document.getElementById("sq-header");
    var footerSlot = document.getElementById("sq-footer");

    // Render ONCE. The logo is built here and never rebuilt.
    if (headerSlot) { headerSlot.innerHTML = renderHeader(false); wireOverlay(headerSlot); }
    if (footerSlot) { footerSlot.innerHTML = renderFooter(); }

    // On auth resolution, patch only the parts that change — never the logo.
    getAuthState().then(function (signedIn) {
      if (signedIn && headerSlot) { applyAuthState(headerSlot, true); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
