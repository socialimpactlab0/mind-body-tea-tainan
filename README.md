# 身心同源・自癒有道｜活動報名頁

這是一套可直接放到 GitHub Pages 的單頁活動網站。前端使用 index.html，報名與網站行為資料由 Google Apps Script 接收並寫入 Google Sheet。

## 檔案內容

- index.html：活動落地頁
- config.js：GAS 網頁應用程式網址與活動編號
- assets/app.js：報名互動、UTM 與漏斗事件追蹤
- gas/Code.gs：Google Apps Script 報名與「流量紀錄」後端
- gas/Analytics.gs：建立「流量分析」儀表板

## 一、建立 Google Sheet 與 GAS

1. 新增一份 Google Sheet，例如命名為「0916 茶會報名名單」。
2. 在試算表選擇「擴充功能」→「Apps Script」。
3. 將 gas/Code.gs 的全部內容貼到 Apps Script 的 Code.gs，取代原有程式。
4. 在 Apps Script 左側按「＋」新增指令碼檔案，命名為 Analytics，將 gas/Analytics.gs 全部內容貼入。
5. 在上方函式選單選擇 setupRegistrationSheet，按「執行」。
6. 接著選擇 setupAnalyticsDashboard，再按一次「執行」。
7. 第一次執行時，依畫面完成 Google 權限授權。
8. 回到試算表，應可看到三張工作表：
   - 報名名單
   - 流量紀錄
   - 流量分析

「流量分析」會每分鐘自動更新一次，也可以在 Apps Script 手動執行 refreshTeaAnalytics 立即重算。

## 二、漏斗追蹤內容

網站目前記錄四個階段：

1. page_view：進站
2. registration_click：點擊「立即報名／保留茶席」
3. form_start：第一次開始填寫報名表
4. registration_success：報名成功

流量分析會顯示：

- 進站工作階段
- 點擊報名
- 開始填表
- 完成報名
- 報名點擊率
- 開始填表率
- 表單完成率
- 整體報名率
- 素材成效比較（utm_content）
- 廣告活動成效（utm_campaign）
- 來源成效（utm_source／referrer）
- 裝置成效（mobile／desktop／tablet）

進站、點報名與開始填表會以工作階段編號去重；完成報名會以報名成功事件的報名編號去重。

## 三、部署 GAS 網頁應用程式

1. Apps Script 右上角選擇「部署」→「新增部署作業」。
2. 類型選擇「網頁應用程式」。
3. 執行身分選擇「我」。
4. 誰可以存取選擇「所有人」。
5. 完成部署後，複製結尾為 /exec 的網址。

如果既有網站已經在使用同一個 /exec 網址，修改 GAS 後請到「部署 → 管理部署作業」，編輯原部署並建立「新版本」，不要另換一個網址。

## 四、連接報名頁

config.js 已設定 GAS_WEB_APP_URL。若日後更換部署網址，再修改這裡即可。

## 五、Facebook 廣告追蹤網址範例

    https://socialimpactlab0.github.io/mind-body-tea-tainan/?utm_source=facebook&utm_medium=paid_social&utm_campaign=0916_health&utm_content=doctor_a

建議命名方式：

- utm_source：facebook / instagram
- utm_medium：paid_social
- utm_campaign：廣告活動或受眾，例如 0916_health、0916_culture
- utm_content：素材，例如 doctor_a、doctor_b

這樣「流量分析」就能直接比較每一支素材與每一組廣告帶來的進站、點報名及完成報名。

## 六、正式上線前檢查

- 打開網站一次，「流量紀錄」出現 page_view。
- 點一次「立即報名」，出現 registration_click。
- 開始填資料，出現 form_start。
- 完成測試報名，出現 registration_success。
- 「流量分析」可看到四段漏斗數字。
- 實際送出一筆多人測試資料，Google Sheet 有收到每位參加者的姓名、電話與職業。
- 測試完成後，可刪除測試報名資料；若要正式重新開始統計，也一併清除流量紀錄測試列。

## 隱私與名單管理

未報名前僅以匿名 visitor_id 與 session_id 記錄網站行為，不會因為進站就知道訪客姓名。完成報名後，報名成功事件可透過報名編號與同一工作階段串接。Google Sheet 的共用權限請維持為限制存取，只開放給實際負責聯繫與分析的人員。
