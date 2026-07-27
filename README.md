# 臺海課程想定生成與兵推系統

一套可直接部署到 GitHub Pages、也可在電腦上以瀏覽器單機開啟的課程模擬系統。

## 核心功能

- 離線想定生成：依教學重點、難度、回合、情報不確定度、民事壓力、天候與美軍支援程度組合情境。
- 可選 AI 想定生成：支援長庚 CGU LLM API、OpenAI、Google Gemini 與 Anthropic Claude；模型與 endpoint 均可修改。
- 回合兵推：藍方、紅方、琥珀方提交命令，由規則引擎與事件卡產生抽象結果。
- 紅方反應：依藍方命令產生可修改的紅方回應；未輸入 API Key 時使用離線規則，已輸入時可使用 CGU、OpenAI、Gemini 或 Claude。
- 概略情勢圖：只使用北／中／南海峽、東部外海、本島整體等抽象區域。
- 情報與戰場迷霧：情報帶有來源可靠度與信心值。
- 後勤與資源：追蹤準備、持續性、指管、情報、資源及民事風險。
- 攔截資源配置實驗：以合成機率展示資源投入與邊際效益。
- 課後檢討：自動建立決策時間線、主要風險及反思題。
- 匯入／匯出：JSON保存完整課程狀態，CSV匯出回合紀錄。
- 本機保存：進度只存在瀏覽器 localStorage，除非主動匯出。

## 單機使用

解壓縮後直接雙擊 `index.html`。

本專案不使用 ES Module 或外部 CDN。離線規則生成器可在多數瀏覽器的 `file://` 模式直接執行；AI 功能會使用瀏覽器 `fetch` 呼叫使用者選擇的服務。

若瀏覽器的本機檔案政策較嚴格，可在專案目錄執行：

```bash
python3 -m http.server 8000
```

再開啟：

```text
http://localhost:8000
```

Windows 也可雙擊 `start-local.bat`。

## GitHub Pages 部署

1. 建立新的 GitHub repository。
2. 將本專案全部檔案上傳到 repository 根目錄。
3. 進入 **Settings → Pages**。
4. Source 選擇 **Deploy from a branch**。
5. Branch 選擇 `main`，資料夾選 `/root`。
6. 儲存後等待 GitHub Pages 網址產生。

離線模式不需要 Firebase、資料庫伺服器或 API Key。AI 模式需自行輸入服務商 API Key，Key 不會儲存或匯出。

## 專案結構

```text
index.html
styles.css
app.js
data/
  demo-data.js
docs/
  system-spec.md
  course-guide.md
  data-model.md
reference/
  taiwan_strait_wargame_demo.sqlite
  taiwan_strait_wargame_demo.xlsx
start-local.bat
start-local.command
LICENSE
```

## 資料與安全界線

- 公開來源目錄與少量國防部公告樣本屬真實公開資料。
- 兵力、能力、庫存、妥善、損失、機率、事件結果及區域位置均為合成示範。
- 不含精確軍事座標、真實單位部署、現役庫存、弱點、射擊表或可靠實戰效能。
- 不得用於真實目標選擇、武器配置、攔截規劃、漏洞分析或即時作戰支援。

## 未來擴充

目前採完全離線規則式生成器。未來可新增：

- 校內地端LLM想定文字生成
- 教師／學生多使用者房間
- 白方裁決介面與人工修正紀錄
- IndexedDB大型情境庫
- Monte Carlo批次比較
- 課程評分規準與學習歷程匯出
- 開放標準介接其他模擬器

詳見 `docs/system-spec.md`。
