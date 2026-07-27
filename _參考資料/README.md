# 聽眾舉手統計

一個可直接在瀏覽器開啟的單頁工具，用攝影機畫面搭配視覺模型 API，統計現場聽眾人數、舉手人數與舉手比例。

![UI 效果圖](UI效果圖.png)

## 功能

- 開啟 USB、內建或行動裝置鏡頭預覽。
- 以手動拍攝或固定間隔自動統計舉手狀況。
- 支援長庚 CGU LLM API、OpenAI API、Google AI Studio / Gemini API 或自定義相容 endpoint。
- 保留統計紀錄、摘要與手動拍攝照片。
- 提供全螢幕儀表板模式，方便投影或現場查看。

## 使用方式

1. 使用 Chrome 或 Edge 開啟 `index.html`，或透過 GitHub Pages 網站使用。
2. 允許瀏覽器使用攝影機。
3. 選擇 API 服務，填入 API key 或 Bearer token。若使用 Google AI Studio，預設模型會使用 `gemini-2.5-flash`。
4. 選擇模型與統計間隔。
5. 按下「開始統計」或「手動拍攝」。

## 注意事項

- API key 只在瀏覽器目前頁面中使用，請勿把個人金鑰寫入原始碼。
- 攝影機與 API 呼叫需要瀏覽器支援 `getUserMedia` 與 `fetch`。
- 若直接開啟檔案遇到瀏覽器安全限制，可改用本機靜態伺服器提供檔案。

## 授權

本專案採用 MIT License，詳見 [LICENSE](LICENSE)。
