const SHEET_NAME = "報名名單";
const HEADERS = [
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
  "狀態"
];

/**
 * 第一次使用時，在Apps Script編輯器手動執行一次。
 * 會記住目前試算表並建立「報名名單」工作表。
 */
function setupRegistrationSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("請從Google試算表的「擴充功能 → Apps Script」開啟並執行。");
  }

  PropertiesService.getScriptProperties()
    .setProperty("SPREADSHEET_ID", spreadsheet.getId());

  const sheet = getOrCreateSheet_(spreadsheet);
  sheet.setFrozenRows(1);
  sheet.getRange("A:A").setNumberFormat("yyyy/mm/dd hh:mm:ss");
  sheet.autoResizeColumns(1, HEADERS.length);

  return "設定完成";
}

function doGet() {
  return json_({
    ok: true,
    service: "tea-registration",
    message: "GAS報名服務運作中"
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    if (!e || !e.parameter) {
      return json_({ ok: false, message: "缺少報名資料" });
    }

    // 隱藏欄位有值時視為機器人，但仍回傳成功以避免反覆攻擊。
    if (clean_(e.parameter.website, 100)) {
      return json_({ ok: true, ignored: true });
    }

    const eventId = safeCell_(clean_(e.parameter.eventId, 80));
    const partySize = Number(e.parameter.partySize);

    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 4) {
      return json_({ ok: false, message: "參加人數不正確" });
    }

    const participants = parseParticipants_(e.parameter.participants, partySize);
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
    const sheet = getOrCreateSheet_(spreadsheet);

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
      safeCell_(clean_(e.parameter.utmSource, 120)),
      safeCell_(clean_(e.parameter.utmMedium, 120)),
      safeCell_(clean_(e.parameter.utmCampaign, 160)),
      safeCell_(clean_(e.parameter.utmContent, 160)),
      safeCell_(clean_(e.parameter.pageUrl, 500)),
      safeCell_(clean_(e.parameter.userAgent, 500)),
      "已報名"
    ]);

    return json_({
      ok: true,
      recordId: recordId,
      message: "報名成功"
    });
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      message: "系統暫時無法處理，請稍後再試"
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

function getOrCreateSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS])
      .setFontWeight("bold")
      .setBackground("#315746")
      .setFontColor("#ffffff");
  }

  return sheet;
}

function hasExistingPhone_(sheet, eventId, phones) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
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
