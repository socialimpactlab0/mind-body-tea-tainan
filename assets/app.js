(function () {
  "use strict";

  const config = window.TEA_EVENT_CONFIG || {};
  const form = document.getElementById("registrationForm");
  const successState = document.getElementById("successState");
  const status = document.getElementById("formStatus");
  const submitButton = form.querySelector(".submit-button");
  const buttonText = submitButton.querySelector(".button-text");
  const buttonLoading = submitButton.querySelector(".button-loading");
  const newRegistration = document.getElementById("newRegistration");
  const partySizeSelect = form.elements.partySize;
  const participantGroups = Array.from(
    document.querySelectorAll("[data-participant]")
  );

  const VISITOR_KEY = "tea_event_visitor_id_v1";
  const SESSION_KEY = "tea_event_session_id_v1";
  const ATTRIBUTION_KEY = "tea_event_attribution_v1";

  const visitorId = getOrCreateId(localStorage, VISITOR_KEY);
  const sessionId = getOrCreateId(sessionStorage, SESSION_KEY);
  const tracking = getTracking();
  let formStarted = false;

  function gasUrlIsReady() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
      String(config.GAS_WEB_APP_URL || "").trim()
    );
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function getOrCreateId(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = createId();
        storage.setItem(key, value);
      }
      return value;
    } catch (error) {
      return createId();
    }
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    buttonText.hidden = loading;
    buttonLoading.hidden = !loading;
  }

  function normalizePhone(value) {
    return String(value || "").replace(/[^0-9]/g, "");
  }

  function readSavedAttribution() {
    try {
      const raw = localStorage.getItem(ATTRIBUTION_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function saveAttribution(value) {
    try {
      localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
    } catch (error) {
      // 隱私模式或瀏覽器禁止儲存時，仍可使用當次網址的追蹤參數。
    }
  }

  function getTracking() {
    const params = new URLSearchParams(window.location.search);
    const saved = readSavedAttribution();
    const current = {
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmContent: params.get("utm_content") || "",
      fbclid: params.get("fbclid") || ""
    };

    const hasCurrentAttribution = Object.values(current).some(Boolean);
    if (hasCurrentAttribution) {
      saveAttribution(current);
      return current;
    }

    return {
      utmSource: saved.utmSource || "",
      utmMedium: saved.utmMedium || "",
      utmCampaign: saved.utmCampaign || "",
      utmContent: saved.utmContent || "",
      fbclid: saved.fbclid || ""
    };
  }

  function getDeviceType() {
    const ua = navigator.userAgent || "";
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
    return "desktop";
  }

  function trackEvent(eventName, detail) {
    if (!gasUrlIsReady()) return Promise.resolve();

    const extra = detail || {};
    const payload = new URLSearchParams({
      requestType: "track_event",
      eventName: eventName,
      eventId: config.EVENT_ID || "mind-body-tea",
      visitorId: visitorId,
      sessionId: sessionId,
      pageUrl: window.location.href,
      referrer: document.referrer || "",
      device: getDeviceType(),
      userAgent: navigator.userAgent || "",
      clientTime: new Date().toISOString(),
      recordId: String(extra.recordId || ""),
      eventDetail: JSON.stringify(extra),
      ...tracking
    });

    return fetch(config.GAS_WEB_APP_URL, {
      method: "POST",
      body: payload,
      redirect: "follow",
      keepalive: true
    }).catch(function (error) {
      console.warn("Tracking event failed:", eventName, error);
    });
  }

  function syncParticipantGroups() {
    const partySize = Number(partySizeSelect.value) || 1;

    participantGroups.forEach(function (group) {
      const index = Number(group.dataset.participant);
      const active = index <= partySize;
      group.hidden = !active;

      group.querySelectorAll("input").forEach(function (input) {
        input.disabled = !active;
        input.required = active;
        if (!active) input.value = "";
      });
    });
  }

  function collectParticipants(formData, partySize) {
    const participants = [];

    for (let index = 1; index <= partySize; index += 1) {
      participants.push({
        name: String(formData.get("participant" + index + "Name") || "").trim(),
        phone: normalizePhone(formData.get("participant" + index + "Phone")),
        occupation: String(formData.get("participant" + index + "Occupation") || "").trim()
      });
    }

    return participants;
  }

  function markFormStarted() {
    if (formStarted) return;
    formStarted = true;
    trackEvent("form_start", {
      field: document.activeElement && document.activeElement.name
        ? document.activeElement.name
        : ""
    });
  }

  document.querySelectorAll('a[href="#registration"]').forEach(function (link) {
    link.addEventListener("click", function () {
      trackEvent("registration_click", {
        label: String(link.textContent || "").trim().slice(0, 100),
        className: String(link.className || "").slice(0, 150)
      });
    });
  });

  form.addEventListener("input", markFormStarted, { once: false });
  form.addEventListener("change", markFormStarted, { once: false });

  partySizeSelect.addEventListener("change", syncParticipantGroups);
  syncParticipantGroups();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    status.textContent = "";

    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const partySize = Number(formData.get("partySize"));
    const participants = collectParticipants(formData, partySize);
    const invalidPhoneIndex = participants.findIndex(function (participant) {
      return participant.phone.length < 8 || participant.phone.length > 15;
    });

    if (invalidPhoneIndex !== -1) {
      status.textContent = "請確認第" + (invalidPhoneIndex + 1) + "位參加者的手機格式。";
      form.elements["participant" + (invalidPhoneIndex + 1) + "Phone"].focus();
      return;
    }

    const uniquePhones = new Set(participants.map(function (participant) {
      return participant.phone;
    }));
    if (uniquePhones.size !== participants.length) {
      status.textContent = "每位參加者請填寫不同的聯絡手機。";
      return;
    }

    if (!gasUrlIsReady()) {
      status.textContent = "目前尚未設定GAS收件網址，請先依README完成設定。";
      return;
    }

    const payload = new URLSearchParams({
      eventId: config.EVENT_ID || "mind-body-tea",
      partySize: String(partySize),
      participants: JSON.stringify(participants),
      website: String(formData.get("website") || ""),
      pageUrl: window.location.href,
      referrer: document.referrer || "",
      visitorId: visitorId,
      sessionId: sessionId,
      userAgent: navigator.userAgent,
      ...tracking
    });

    setLoading(true);

    try {
      const response = await fetch(config.GAS_WEB_APP_URL, {
        method: "POST",
        body: payload,
        redirect: "follow"
      });

      if (!response.ok) throw new Error("HTTP " + response.status);

      const result = await response.json();
      if (!result.ok) {
        status.textContent = result.message || "報名資料無法送出，請確認後再試。";
        return;
      }

      trackEvent("registration_success", {
        recordId: result.recordId || "",
        partySize: partySize
      });

      // 只有 Google Sheet 已確認報名成功後，才通知 Meta 完成註冊。
      if (typeof window.TEA_META_TRACK_COMPLETE_REGISTRATION === "function") {
        window.TEA_META_TRACK_COMPLETE_REGISTRATION(result.recordId || "");
      }

      form.hidden = true;
      successState.hidden = false;
      successState.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error(error);
      status.textContent = "資料暫時無法送出，請稍後再試或使用頁面下方報名專線。";
    } finally {
      setLoading(false);
    }
  });

  newRegistration.addEventListener("click", function () {
    form.reset();
    formStarted = false;
    syncParticipantGroups();
    successState.hidden = true;
    form.hidden = false;
    status.textContent = "";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  trackEvent("page_view", {
    title: document.title
  });
})();
