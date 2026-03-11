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
  const { gaId, clarityId, metaPixelId } = getAnalyticsConfig();
  const snippets = [];
  
  if (isValidId(gaId)) {
    snippets.push(
      `<!-- Google tag (gtag.js) --> 
       <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script> <script> 
         window.dataLayer = window.dataLayer || []; 
         function gtag(){dataLayer.push(arguments);} 
         gtag('js', new Date()); 
         
         gtag('config', '${gaId}'); 
       </script>`,
    );
  }

  if (isValidId(clarityId)) {
    snippets.push(
      `<!-- Microsoft Clarity -->
       <script>
        (function(c,l,a,r,i,t,y){ 
          c[a]=c[a]||function(){ (c[a].q=c[a].q||[]).push(arguments); }; 
          t=l.createElement(r); t.async=1; t.src="https://www.clarity.ms/tag/"+i; 
          y=l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t,y); 
        })(window, document, "clarity", "script", "${clarityId}");
       </script>
       <!-- Microsoft Clarity -->`,
    );
  }

  if (isValidId(metaPixelId)) {
    snippets.push(
      `<!-- Facebook Pixel Code -->
       <script>
         !function(f,b,e,v,n,t,s)
         {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
         n.callMethod.apply(n,arguments):n.queue.push(arguments)};
         if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
         n.queue=[];t=b.createElement(e);t.async=!0;
         t.src=v;s=b.getElementsByTagName(e)[0];
         s.parentNode.insertBefore(t,s)}(window, document,'script',
         'https://connect.facebook.net/en_US/fbevents.js');
         fbq('init', '${metaPixelId}');
         fbq('track', 'PageView');
       </script>
       <noscript>
         <img height="1" width="1" style="display:none" 
             src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1"/>
       </noscript>
       <!-- End Facebook Pixel Code -->`,
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
