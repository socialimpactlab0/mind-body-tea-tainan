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

  function gasUrlIsReady() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
      String(config.GAS_WEB_APP_URL || "").trim()
    );
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    buttonText.hidden = loading;
    buttonLoading.hidden = !loading;
  }

  function normalizePhone(value) {
    return String(value || "").replace(/[^0-9]/g, "");
  }

  function getTracking() {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmContent: params.get("utm_content") || ""
    };
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
      userAgent: navigator.userAgent,
      ...getTracking()
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
    syncParticipantGroups();
    successState.hidden = true;
    form.hidden = false;
    status.textContent = "";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
