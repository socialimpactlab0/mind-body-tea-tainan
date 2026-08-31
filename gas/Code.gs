const REGISTRATION_SHEET_NAME = "報名名單";
const TRACKING_SHEET_NAME = "流量紀錄";

const REGISTRATION_HEADERS = [
  "報名時間",
  "報名編號",
  "活動編號",
  "參加人數",
  "第1位姓名",
  "第1位手機",
  "第1位職業",
  "第2位姓名",
  "第2位手機",
  "第2位職業",
  "第3位姓名",
  "第3位手機",
  "第3位職業",
  "第4位姓名",
  "第4位手機",
  "第4位職業",
  "UTM來源",
  "UTM媒介",
  "UTM活動",
  "UTM素材",
  "報名頁網址",
  "瀏覽器資訊",
  "狀態",
  "訪客編號",
  "工作階段編號",
  "FB點擊編號",
  "來源頁"
];

const TRACKING_HEADERS = [
  "事件時間",
  "事件編號",
  "事件名稱",
  "訪客編號",
  "工作階段編號",
  "活動編號",
  "UTM來源",
  "UTM媒介",
  "UTM活動",
  "UTM素材",
  "FB點擊編號",
  "頁面網址",
  "來源頁",
  "裝置",
  "瀏覽器資訊",
  "前端時間",
  "報名編號",
  "事件細節"
];

const ALLOWED_TRACKING_EVENTS = new Set([
  "page_view",
  "registration_click",
  "form_start",
  "registration_success"
]);

/**
 * 第一次使用時，在 Apps Script 編輯器手動執行一次。
 * 會記住目前試算表，並建立／補齊「報名名單」與「流量紀錄」。
 */
function setupRegistrationSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("請從Google試算表的「擴充功能 → Apps Script」開啟並執行。");
  }

  PropertiesService.getScriptProperties()
    .setProperty("SPREADSHEET_ID", spreadsheet.getId());

  const registrationSheet = getOrCreateRegistrationSheet_(spreadsheet);
  const trackingSheet = getOrCreateTrackingSheet_(spreadsheet);

  registrationSheet.setFrozenRows(1);
  registrationSheet.getRange("A:A").setNumberFormat("yyyy/mm/dd hh:mm:ss");
  registrationSheet.autoResizeColumns(1, REGISTRATION_HEADERS.length);

  trackingSheet.setFrozenRows(1);
  trackingSheet.getRange("A:A").setNumberFormat("yyyy/mm/dd hh:mm:ss");
  trackingSheet.autoResizeColumns(1, TRACKING_HEADERS.length);

  return "設定完成：報名名單與流量紀錄已就緒";
}

/**
 * 若既有專案已執行過 setupRegistrationSheet，也可以單獨執行此函式檢查追蹤表。
 */
function setupTrackingSheet() {
  const spreadsheet = getSpreadsheet_();
  const trackingSheet = getOrCreateTrackingSheet_(spreadsheet);
  trackingSheet.setFrozenRows(1);
  trackingSheet.getRange("A:A").setNumberFormat("yyyy/mm/dd hh:mm:ss");
  trackingSheet.autoResizeColumns(1, TRACKING_HEADERS.length);
  return "流量紀錄設定完成";
}

function doGet() {
  return json_({
    ok: true,
    service: "tea-registration",
    tracking: true,
    message: "GAS報名與流量追蹤服務運作中"
  });
}

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return json_({ ok: false, message: "缺少資料" });
    }

    if (clean_(e.parameter.requestType, 40) === "track_event") {
      return handleTrackingEvent_(e.parameter);
    }

    return handleRegistration_(e.parameter);
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      message: "系統暫時無法處理，請稍後再試"
    });
  }
}

function handleTrackingEvent_(parameter) {
  const eventName = clean_(parameter.eventName, 60);
  if (!ALLOWED_TRACKING_EVENTS.has(eventName)) {
    return json_({ ok: false, message: "追蹤事件不正確" });
  }

  const visitorId = safeCell_(clean_(parameter.visitorId, 120));
  const sessionId = safeCell_(clean_(parameter.sessionId, 120));
  if (!visitorId || !sessionId) {
    return json_({ ok: false, message: "缺少匿名追蹤編號" });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return json_({ ok: false, message: "系統忙碌中，請稍後再試" });
  }

  try {
    const spreadsheet = getSpreadsheet_();
    const sheet = getOrCreateTrackingSheet_(spreadsheet);
    const eventId = Utilities.getUuid();

    sheet.appendRow([
      new Date(),
      eventId,
      safeCell_(eventName),
      visitorId,
      sessionId,
      safeCell_(clean_(parameter.eventId, 80)),
      safeCell_(clean_(parameter.utmSource, 120)),
      safeCell_(clean_(parameter.utmMedium, 120)),
      safeCell_(clean_(parameter.utmCampaign, 160)),
      safeCell_(clean_(parameter.utmContent, 160)),
      safeCell_(clean_(parameter.fbclid, 300)),
      safeCell_(clean_(parameter.pageUrl, 500)),
      safeCell_(clean_(parameter.referrer, 500)),
      safeCell_(clean_(parameter.device, 40)),
      safeCell_(clean_(parameter.userAgent, 500)),
      safeCell_(clean_(parameter.clientTime, 80)),
      safeCell_(clean_(parameter.recordId, 120)),
      safeCell_(clean_(parameter.eventDetail, 1000))
    ]);

    return json_({
      ok: true,
      eventId: eventId,
      message: "事件已記錄"
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function handleRegistration_(parameter) {
  const lock = LockService.getScriptLock();

  try {
    // 隱藏欄位有值時視為機器人，但仍回傳成功以避免反覆攻擊。
    if (clean_(parameter.website, 100)) {
      return json_({ ok: true, ignored: true });
    }

    const eventId = safeCell_(clean_(parameter.eventId, 80));
    const partySize = Number(parameter.partySize);

    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 4) {
      return json_({ ok: false, message: "參加人數不正確" });
    }

    const participants = parseParticipants_(parameter.participants, partySize);
    if (!eventId) {
      return json_({ ok: false, message: "活動編號不完整" });
    }

    const phones = participants.map(function(participant) {
      return participant.phone;
    });
    if (new Set(phones).size !== phones.length) {
      return json_({ ok: false, message: "每位參加者請填寫不同的聯絡手機" });
    }

    if (!lock.tryLock(10000)) {
      return json_({ ok: false, message: "系統忙碌中，請稍後再試" });
    }

    const spreadsheet = getSpreadsheet_();
    const sheet = getOrCreateRegistrationSheet_(spreadsheet);

    // 任一參加者的手機已在同一活動報名，即停止新增，避免重複名單。
    if (hasExistingPhone_(sheet, eventId, phones)) {
      return json_({
        ok: false,
        duplicate: true,
        message: "其中一支手機已完成報名，請確認名單或聯絡主辦單位"
      });
    }

    const recordId = Utilities.getUuid();
    const participantCells = [];
    for (let index = 0; index < 4; index += 1) {
      const participant = participants[index];
      participantCells.push(
        participant ? participant.name : "",
        participant ? participant.phone : "",
        participant ? participant.occupation : ""
      );
    }

    sheet.appendRow([
      new Date(),
      recordId,
      eventId,
      partySize,
      ...participantCells,
      safeCell_(clean_(parameter.utmSource, 120)),
      safeCell_(clean_(parameter.utmMedium, 120)),
      safeCell_(clean_(parameter.utmCampaign, 160)),
      safeCell_(clean_(parameter.utmContent, 160)),
      safeCell_(clean_(parameter.pageUrl, 500)),
      safeCell_(clean_(parameter.userAgent, 500)),
      "已報名",
      safeCell_(clean_(parameter.visitorId, 120)),
      safeCell_(clean_(parameter.sessionId, 120)),
      safeCell_(clean_(parameter.fbclid, 300)),
      safeCell_(clean_(parameter.referrer, 500))
    ]);

    return json_({
      ok: true,
      recordId: recordId,
      message: "報名成功"
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("尚未執行 setupRegistrationSheet");
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function getOrCreateRegistrationSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(REGISTRATION_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(REGISTRATION_SHEET_NAME);
  ensureHeaders_(sheet, REGISTRATION_HEADERS, "#315746");
  return sheet;
}

function getOrCreateTrackingSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(TRACKING_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(TRACKING_SHEET_NAME);
  ensureHeaders_(sheet, TRACKING_HEADERS, "#6f5a3e");
  return sheet;
}

function ensureHeaders_(sheet, headers, background) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground(background)
    .setFontColor("#ffffff");
}

function hasExistingPhone_(sheet, eventId, phones) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const rows = sheet.getRange(2, 1, lastRow - 1, REGISTRATION_HEADERS.length).getDisplayValues();
  const submittedPhones = new Set(phones);

  return rows.some(function(row) {
    if (String(row[2]) !== String(eventId)) return false;

    return [row[5], row[8], row[11], row[14]].some(function(value) {
      const phone = normalizePhone_(value);
      return phone && submittedPhones.has(phone);
    });
  });
}

function parseParticipants_(rawValue, partySize) {
  let values;

  try {
    values = JSON.parse(String(rawValue || "[]").slice(0, 4000));
  } catch (error) {
    throw new Error("參加者資料格式不正確");
  }

  if (!Array.isArray(values) || values.length !== partySize) {
    throw new Error("參加者資料與人數不一致");
  }

  return values.map(function(value, index) {
    const name = safeCell_(clean_(value && value.name, 40));
    const phone = normalizePhone_(value && value.phone);
    const occupation = safeCell_(clean_(value && value.occupation, 50));

    if (!name || !occupation) {
      throw new Error("第" + (index + 1) + "位參加者資料不完整");
    }
    if (phone.length < 8 || phone.length > 15) {
      throw new Error("第" + (index + 1) + "位參加者手機格式不正確");
    }

    return {
      name: name,
      phone: phone,
      occupation: occupation
    };
  });
}

function clean_(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizePhone_(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

// 避免姓名或追蹤參數被Google Sheet誤判為公式。
function safeCell_(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
