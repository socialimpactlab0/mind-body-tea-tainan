const ANALYTICS_SHEET_NAME = "流量分析";

/**
 * 第一次加入本檔時手動執行一次。
 * 會建立「流量分析」工作表，並設定每分鐘自動更新。
 */
function setupAnalyticsDashboard() {
  const spreadsheet = getSpreadsheet_();
  if (!spreadsheet.getSheetByName(ANALYTICS_SHEET_NAME)) {
    spreadsheet.insertSheet(ANALYTICS_SHEET_NAME);
  }

  refreshTeaAnalytics();

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "refreshTeaAnalytics") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("refreshTeaAnalytics")
    .timeBased()
    .everyMinutes(1)
    .create();

  return "流量分析已建立，並設定每分鐘自動更新";
}

/**
 * 可手動執行，立即重算儀表板。
 */
function refreshTeaAnalytics() {
  const spreadsheet = getSpreadsheet_();
  const trackingSheet = spreadsheet.getSheetByName(TRACKING_SHEET_NAME);
  if (!trackingSheet) throw new Error("找不到「流量紀錄」工作表");

  let analyticsSheet = spreadsheet.getSheetByName(ANALYTICS_SHEET_NAME);
  if (!analyticsSheet) analyticsSheet = spreadsheet.insertSheet(ANALYTICS_SHEET_NAME);

  const rows = trackingSheet.getLastRow() > 1
    ? trackingSheet.getRange(2, 1, trackingSheet.getLastRow() - 1, TRACKING_HEADERS.length).getValues()
    : [];

  const stages = {
    page_view: new Set(),
    registration_click: new Set(),
    form_start: new Set(),
    registration_success: new Set()
  };

  const byContent = {};
  const byCampaign = {};
  const bySource = {};
  const byDevice = {};

  let firstDate = null;
  let eventId = "";

  rows.forEach(function(row) {
    const time = row[0];
    const eventName = String(row[2] || "");
    const sessionId = String(row[4] || "");
    const rowEventId = String(row[5] || "");
    const utmSource = String(row[6] || "");
    const utmCampaign = String(row[8] || "");
    const utmContent = String(row[9] || "");
    const referrer = String(row[12] || "");
    const device = String(row[13] || "unknown") || "unknown";
    const recordId = String(row[16] || "");

    if (time instanceof Date && !isNaN(time.getTime())) {
      if (!firstDate || time < firstDate) firstDate = time;
    }
    if (!eventId && rowEventId) eventId = rowEventId;

    const stageKey = eventName === "registration_success"
      ? (recordId || sessionId)
      : sessionId;
    if (stageKey && stages[eventName]) stages[eventName].add(stageKey);

    addAnalyticsEvent_(byContent, utmContent || "未標記", eventName, sessionId, recordId);
    addAnalyticsEvent_(byCampaign, utmCampaign || "未標記", eventName, sessionId, recordId);
    addAnalyticsEvent_(bySource, analyticsSource_(utmSource, referrer), eventName, sessionId, recordId);
    addAnalyticsEvent_(byDevice, device, eventName, sessionId, recordId);
  });

  const visits = stages.page_view.size;
  const clicks = stages.registration_click.size;
  const starts = stages.form_start.size;
  const completed = stages.registration_success.size;

  buildAnalyticsSheet_(
    analyticsSheet,
    {
      visits: visits,
      clicks: clicks,
      starts: starts,
      completed: completed,
      clickRate: rate_(clicks, visits),
      startRate: rate_(starts, clicks),
      completeRate: rate_(completed, starts),
      overallRate: rate_(completed, visits),
      firstDate: firstDate,
      eventId: eventId,
      byContent: analyticsRows_(byContent, true),
      byCampaign: analyticsRows_(byCampaign, true),
      bySource: analyticsRows_(bySource, false),
      byDevice: deviceRows_(byDevice)
    },
    spreadsheet.getSpreadsheetTimeZone() || "Asia/Taipei"
  );
}

function addAnalyticsEvent_(map, key, eventName, sessionId, recordId) {
  if (!map[key]) {
    map[key] = {
      visits: new Set(),
      clicks: new Set(),
      starts: new Set(),
      completed: new Set()
    };
  }

  const item = map[key];
  if (eventName === "page_view" && sessionId) item.visits.add(sessionId);
  if (eventName === "registration_click" && sessionId) item.clicks.add(sessionId);
  if (eventName === "form_start" && sessionId) item.starts.add(sessionId);
  if (eventName === "registration_success") {
    const completedKey = recordId || sessionId;
    if (completedKey) item.completed.add(completedKey);
  }
}

function analyticsRows_(map, includeStart) {
  return Object.keys(map).map(function(key) {
    const item = map[key];
    const visits = item.visits.size;
    const clicks = item.clicks.size;
    const starts = item.starts.size;
    const completed = item.completed.size;

    if (includeStart) {
      return [key, visits, clicks, starts, completed, rate_(clicks, visits), rate_(completed, visits)];
    }
    return [key, visits, clicks, completed, rate_(completed, visits)];
  }).sort(function(a, b) {
    return b[1] - a[1];
  });
}

function deviceRows_(map) {
  return Object.keys(map).map(function(key) {
    const item = map[key];
    const visits = item.visits.size;
    const completed = item.completed.size;
    return [key, visits, completed, rate_(completed, visits)];
  }).sort(function(a, b) {
    return b[1] - a[1];
  });
}

function analyticsSource_(utmSource, referrer) {
  const source = String(utmSource || "").trim();
  if (source) return source.toLowerCase();

  const ref = String(referrer || "").trim();
  if (!ref) return "direct";

  const match = ref.match(/^https?:\/\/([^\/?#]+)/i);
  return match ? match[1].replace(/^www\./i, "").toLowerCase() : "other";
}

function buildAnalyticsSheet_(sheet, data, timezone) {
  const C = {
    navy: "#0f1b32",
    header: "#1f2e45",
    section: "#c7d3df",
    body: "#f4f6f8",
    green: "#d7f4df",
    yellow: "#fff1bd",
    red: "#f9d7d7",
    white: "#ffffff"
  };

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.clearConditionalFormatRules();

  for (let col = 1; col <= 13; col += 1) sheet.setColumnWidth(col, 95);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(8, 24);
  sheet.setColumnWidth(9, 160);

  sheet.getRange("A1:M2").merge()
    .setValue("《9/16專題茶會》網站流量分析")
    .setBackground(C.navy)
    .setFontColor(C.white)
    .setFontSize(20)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  const firstDateText = data.firstDate
    ? Utilities.formatDate(data.firstDate, timezone, "yyyy/MM/dd")
    : "尚無資料";
  const updatedText = Utilities.formatDate(new Date(), timezone, "yyyy/MM/dd HH:mm:ss");

  sheet.getRange("A4").setValue("統計開始日").setFontWeight("bold");
  sheet.getRange("B4:C4").merge().setValue(firstDateText).setFontWeight("bold");
  sheet.getRange("D4").setValue("活動編號").setFontWeight("bold");
  sheet.getRange("E4:H4").merge().setValue(data.eventId || "尚無資料").setFontWeight("bold");
  sheet.getRange("I4").setValue("最後更新").setFontWeight("bold");
  sheet.getRange("J4:M4").merge().setValue(updatedText).setFontWeight("bold");
  sheet.getRange("A4:M4").setBackground("#dbe4ee");

  metric_(sheet, "A6:C6", "A7:C7", "進站工作階段", data.visits, C);
  metric_(sheet, "D6:F6", "D7:F7", "點擊報名", data.clicks, C);
  metric_(sheet, "G6:I6", "G7:I7", "開始填表", data.starts, C);
  metric_(sheet, "J6:M6", "J7:M7", "完成報名", data.completed, C);

  metricRate_(sheet, "A9:C9", "A10:C10", "報名點擊率", data.clickRate, C);
  metricRate_(sheet, "D9:F9", "D10:F10", "開始填表率", data.startRate, C);
  metricRate_(sheet, "G9:I9", "G10:I10", "表單完成率", data.completeRate, C);
  metricRate_(sheet, "J9:M9", "J10:M10", "整體報名率", data.overallRate, C);

  const materialEnd = table_(sheet, 13, 1, "素材成效比較",
    ["素材", "進站", "點報名", "開始填表", "完成報名", "點擊率", "整體報名率"],
    data.byContent, C);

  const deviceEnd = table_(sheet, 13, 9, "裝置成效",
    ["裝置", "進站", "完成報名", "報名率"],
    data.byDevice, C);

  const sourceEnd = table_(sheet, deviceEnd + 3, 9, "來源成效",
    ["來源", "進站", "點報名", "完成報名", "報名率"],
    data.bySource, C);

  table_(sheet, Math.max(materialEnd, sourceEnd) + 3, 1, "廣告活動成效",
    ["UTM活動", "進站", "點報名", "開始填表", "完成報名", "點擊率", "整體報名率"],
    data.byCampaign, C);

  sheet.setFrozenRows(4);
}

function metric_(sheet, headerRange, valueRange, label, value, C) {
  sheet.getRange(headerRange).merge().setValue(label)
    .setBackground(C.header).setFontColor(C.white).setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange(valueRange).merge().setValue(value)
    .setBackground(C.body).setFontSize(24).setFontWeight("bold")
    .setHorizontalAlignment("center");
}

function metricRate_(sheet, headerRange, valueRange, label, value, C) {
  sheet.getRange(headerRange).merge().setValue(label)
    .setBackground("#52657c").setFontColor(C.white).setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange(valueRange).merge().setValue(value).setNumberFormat("0.0%")
    .setBackground(C.body).setFontSize(19).setFontWeight("bold")
    .setHorizontalAlignment("center");
}

function table_(sheet, startRow, startCol, title, headers, rows, C) {
  const count = headers.length;
  sheet.getRange(startRow, startCol, 1, count).merge().setValue(title)
    .setBackground(C.section).setFontWeight("bold");
  sheet.getRange(startRow + 1, startCol, 1, count).setValues([headers])
    .setBackground(C.header).setFontColor(C.white).setFontWeight("bold")
    .setHorizontalAlignment("center");

  const output = rows.length ? rows.slice(0, 30) : [["尚無資料"].concat(new Array(count - 1).fill(""))];
  sheet.getRange(startRow + 2, startCol, output.length, count).setValues(output);

  headers.forEach(function(header, index) {
    if (String(header).indexOf("率") !== -1) {
      sheet.getRange(startRow + 2, startCol + index, output.length, 1).setNumberFormat("0.0%");
    }
  });

  const rateIndex = headers.findIndex(function(header) {
    return header === "整體報名率" || header === "報名率";
  });
  if (rateIndex >= 0 && rows.length) {
    output.forEach(function(row, index) {
      const value = Number(row[rateIndex]) || 0;
      sheet.getRange(startRow + 2 + index, startCol + rateIndex).setBackground(
        value >= 0.07 ? C.green : value >= 0.04 ? C.yellow : C.red
      );
    });
  }

  return startRow + 1 + output.length;
}

function rate_(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}
