# 身心同源・自癒有道｜活動報名頁

這是一套可直接放到 GitHub Pages 的單頁活動網站。前端使用 index.html，報名資料由 Google Apps Script 接收並寫入 Google Sheet。

## 檔案內容

- index.html：活動落地頁
- config.js：填入 GAS 網頁應用程式網址
- assets/：版面、互動程式與講者圖片
- gas/Code.gs：Google Apps Script 後端程式

## 一、建立 Google Sheet 與 GAS

1. 新增一份 Google Sheet，例如命名為「0916 茶會報名名單」。
2. 在試算表選擇「擴充功能」→「Apps Script」。
3. 將 gas/Code.gs 的全部內容貼到 Apps Script 編輯器，取代原有程式。
4. 在上方函式選單選擇 setupRegistrationSheet，按「執行」。
5. 第一次執行時，依畫面完成 Google 權限授權。
6. 回到試算表，確認已建立「報名名單」工作表與欄位標題。

## 二、部署 GAS 網頁應用程式

1. Apps Script 右上角選擇「部署」→「新增部署作業」。
2. 類型選擇「網頁應用程式」。
3. 執行身分選擇「我」。
4. 誰可以存取選擇「所有人」。
5. 完成部署後，複製結尾為 /exec 的網址。

如果日後修改 Code.gs，請建立新的部署版本，否則線上版本不會自動更新。

## 三、連接報名頁

打開 config.js，把 GAS_WEB_APP_URL 的空字串改成剛才取得的 /exec 網址，例如：

    GAS_WEB_APP_URL: "https://script.google.com/macros/s/你的部署代碼/exec",

儲存後即可測試報名。

## 四、發布到 GitHub Pages

1. 在 GitHub 建立新的 repository。
2. 上傳 index.html、config.js、assets 資料夾、gas 資料夾與 README.md。
3. 進入 repository 的 Settings → Pages。
4. Source 選擇 Deploy from a branch。
5. Branch 選擇 main，資料夾選擇 /root，然後儲存。
6. 等待 GitHub 顯示公開網址後，以手機與電腦各測試一次。

## 五、正式上線前檢查

- config.js 已填入正確的 GAS /exec 網址。
- 實際送出一筆多人測試資料，Google Sheet 有收到每位參加者的姓名、電話與職業。
- 同一支電話重複報名時，頁面會要求確認名單。
- 日期、時間、地點與報名電話皆正確。
- 手機版的「立即報名」按鈕可正常捲動到表單。
- 測試完成後，可在 Google Sheet 刪除測試資料。

## Facebook 廣告追蹤網址範例

    https://你的GitHub網址/?utm_source=facebook&utm_medium=paid_social&utm_campaign=0916_tea&utm_content=main_image

報名資料會一併記錄 UTM 來源，方便日後查看不同廣告帶來的報名結果。

## 隱私與名單管理

頁面收集每位參加者的姓名、聯絡電話、職業與報名人數，用於確認茶席及了解參加背景。Google Sheet 的共用權限請維持為限制存取，只開放給實際負責聯繫與報到的人員。
