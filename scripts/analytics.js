import { config as _cfg } from "@shevky/base";

function getAnalyticsConfig() {
  return _cfg.analytics ?? {};
}

const PLACEHOLDER_IDS = new Set([
  "GTM-XXXXXXX",
  "G-XXXXXXXXXX",
  "CLARITY-ID",
  "META-PIXEL-ID",
]);

/** @param {unknown} value */
function isValidId(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !PLACEHOLDER_IDS.has(trimmed);
}

function getSnippets() {
  const { gtmId, gaId, clarityId, metaPixelId } = getAnalyticsConfig();
  const snippets = [];

  if (isValidId(gtmId)) {
    snippets.push(
      `<script>(function (w, d, s, l, i) { w[l] = w[l] || []; w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" }); var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l !== "dataLayer" ? "&l=" + l : ""; j.async = true; j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl; f.parentNode.insertBefore(j, f); })(window, document, "script", "dataLayer", "${gtmId}");</script>`,
    );
  }

  if (isValidId(gaId)) {
    snippets.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>`,
    );
    snippets.push(
      `<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag("js", new Date()); gtag("config", "${gaId}");</script>`,
    );
  }

  if (isValidId(clarityId)) {
    snippets.push(
      `<script>(function(c,l,a,r,i,t,y){ c[a]=c[a]||function(){ (c[a].q=c[a].q||[]).push(arguments); }; t=l.createElement(r); t.async=1; t.src="https://www.clarity.ms/tag/"+i; y=l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t,y); })(window, document, "clarity", "script", "${clarityId}");</script>`,
    );
  }

  if (isValidId(metaPixelId)) {
    snippets.push(
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init","${metaPixelId}");fbq("track","PageView");</script>`,
    );
  }

  return snippets;
}

const API = {
  get snippets() {
    return this.enabled ? getSnippets() : [];
  },
  get enabled() {
    return Boolean(getAnalyticsConfig().enabled);
  },
  get google() {
    const { gaId, gtmId } = getAnalyticsConfig();

    return {
      ga: gaId,
      gtm: gtmId,
    };
  },
  get microsoft() {
    const { clarityId } = getAnalyticsConfig();

    return {
      clarity: clarityId,
    };
  },
};

export default API;
