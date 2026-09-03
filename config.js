window.TEA_EVENT_CONFIG = {
  // 部署 GAS 網頁應用程式後，把 /exec 網址貼在下方引號內。
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycby1Ldx8mHZjDMrsaDvM-GN7OASqQEqopKW_KWe11J0Z-AzT7IeXXkm_IcGpkYm6RDCGsg/exec",
  EVENT_ID: "2026-09-16-mind-body-tea-tainan",
  META_PIXEL_ID: "770057572700869"
};

(function initializeTeaMetaPixel() {
  "use strict";

  const config = window.TEA_EVENT_CONFIG || {};
  const pixelId = String(config.META_PIXEL_ID || "").trim();

  if (!/^\d{5,25}$/.test(pixelId)) return;

  // 載入 Meta Pixel。此處只初始化基本像素，不傳送表單姓名、手機或職業。
  if (!window.fbq) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js"
    );
  }

  const initializedKey = "__teaMetaPixelInitialized_" + pixelId;
  if (!window[initializedKey]) {
    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
    window[initializedKey] = true;
  }

  // 僅供報名成功後呼叫；recordId 只作為事件去重編號，不含個人資料。
  window.TEA_META_TRACK_COMPLETE_REGISTRATION = function (recordId) {
    if (typeof window.fbq !== "function") return;

    const eventData = {
      content_name: String(config.EVENT_ID || "mind-body-tea")
    };
    const eventId = String(recordId || "").trim();

    try {
      if (eventId) {
        window.fbq(
          "track",
          "CompleteRegistration",
          eventData,
          { eventID: eventId }
        );
      } else {
        window.fbq("track", "CompleteRegistration", eventData);
      }
    } catch (error) {
      console.warn("Meta Pixel CompleteRegistration failed:", error);
    }
  };
})();
