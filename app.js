(() => {
  "use strict";

  const DATA = window.WARGAME_DATA;
  const STORAGE_KEY = "taiwan-strait-scenario-generator-v1";

  const API_PROVIDERS = {
    cgu: {
      label: "長庚 CGU LLM API",
      shortLabel: "長庚 CGU",
      endpoint: "https://air.cgu.edu.tw/cgullmapi/v1",
      model: "gpt-5.4-mini",
      apiStyle: "responses"
    },
    openai: {
      label: "OpenAI API",
      shortLabel: "OpenAI",
      endpoint: "https://api.openai.com/v1",
      model: "gpt-5.5",
      apiStyle: "responses"
    },
    google: {
      label: "Google AI Studio / Gemini API",
      shortLabel: "Google Gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions",
      model: "gemini-2.5-flash",
      apiStyle: "gemini"
    },
    anthropic: {
      label: "Anthropic / Claude API",
      shortLabel: "Claude",
      endpoint: "https://api.anthropic.com/v1/messages",
      model: "claude-sonnet-4-20250514",
      apiStyle: "anthropic"
    }
  };

  const AI_SCENARIO_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: { type: "string" },
      objectives: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 },
      successCriteria: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 },
      constraints: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
      events: {
        type: "array", minItems: 4, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          properties: {
            trigger_turn: { type: "integer" },
            event_name: { type: "string" },
            category: { type: "string" },
            zone_id: { type: "string", enum: ["Z-NW", "Z-CW", "Z-SW", "Z-NE", "Z-E", "Z-SE", "Z-ISL", "Z-REAR"] },
            affected_actor: { type: "string", enum: ["BLUE", "RED", "AMBER", "WHITE", "ALL"] },
            description: { type: "string" },
            readiness_delta: { type: "integer" },
            sustainment_delta: { type: "integer" },
            command_delta: { type: "integer" },
            civilian_risk_delta: { type: "integer" }
          },
          required: ["trigger_turn", "event_name", "category", "zone_id", "affected_actor", "description", "readiness_delta", "sustainment_delta", "command_delta", "civilian_risk_delta"]
        }
      },
      intel: {
        type: "array", minItems: 4, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          properties: {
            turn: { type: "integer" },
            recipient_actor: { type: "string", enum: ["BLUE", "RED", "AMBER"] },
            zone_id: { type: "string", enum: ["Z-NW", "Z-CW", "Z-SW", "Z-NE", "Z-E", "Z-SE", "Z-ISL", "Z-REAR"] },
            report_type: { type: "string" },
            report_text: { type: "string" },
            source_reliability: { type: "string", enum: ["A", "B", "C", "D"] },
            confidence_pct: { type: "integer" }
          },
          required: ["turn", "recipient_actor", "zone_id", "report_type", "report_text", "source_reliability", "confidence_pct"]
        }
      }
    },
    required: ["overview", "objectives", "successCriteria", "constraints", "events", "intel"]
  };

  const RED_REACTION_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: ["增加空中施壓", "海上臨檢演示", "電磁壓制", "遠程火力展示", "調整封控區", "外交訊息操作"]
      },
      zone: {
        type: "string",
        enum: ["Z-NW", "Z-CW", "Z-SW", "Z-NE", "Z-E", "Z-SE", "Z-ISL"]
      },
      resource: { type: "integer" },
      rationale: { type: "string" },
      reaction_summary: { type: "string" }
    },
    required: ["action", "zone", "resource", "rationale", "reaction_summary"]
  };

  const ACTIONS = {
    BLUE: [
      ["強化防空警戒", { readiness: 2, command: 1, intel: 1, civilian: 1 }],
      ["商船護航", { sustainment: -1, command: 1, civilian: -3 }],
      ["分散部署", { readiness: 1, sustainment: -1, civilian: 0 }],
      ["備援通訊", { command: 4, intel: 1, civilian: 0 }],
      ["後勤修復", { readiness: 1, sustainment: 5, civilian: 0 }],
      ["情報融合", { intel: 5, command: 1, civilian: 0 }]
    ],
    RED: [
      ["增加空中施壓", { readiness: -1, command: 1, intel: 0, civilian: 3 }],
      ["海上臨檢演示", { sustainment: -1, command: 0, intel: 1, civilian: 4 }],
      ["電磁壓制", { readiness: 0, command: 2, intel: 2, civilian: 2 }],
      ["遠程火力展示", { readiness: -2, command: 0, intel: 0, civilian: 6 }],
      ["調整封控區", { sustainment: 1, command: 1, intel: 0, civilian: 3 }],
      ["外交訊息操作", { readiness: 0, command: 1, intel: 2, civilian: -1 }]
    ],
    AMBER: [
      ["提供ISR支援", { readiness: 0, command: 1, intel: 6, civilian: 0 }],
      ["提升後勤準備", { readiness: 1, sustainment: 6, intel: 0, civilian: 0 }],
      ["網路防護支援", { readiness: 1, command: 5, intel: 1, civilian: 0 }],
      ["外交協調", { readiness: 0, command: 2, intel: 1, civilian: -3 }],
      ["遠距海上存在", { readiness: 1, command: 1, intel: 2, civilian: 2 }],
      ["人道支援準備", { readiness: 0, sustainment: 2, intel: 0, civilian: -5 }]
    ]
  };

  const FOCUS_LIBRARY = {
    joint: {
      title: "聯合決策與整體情勢",
      objectives: ["維持關鍵海空通道與指揮韌性", "在資源有限下平衡防護、後勤與民事需求", "辨識升級風險並保留外交空間"],
      success: ["關鍵功能維持在可接受水準", "未因單一回合投入耗盡後續資源", "能解釋每項決策的假設與替代方案"]
    },
    airdefense: {
      title: "防空資源與預警",
      objectives: ["比較預警品質、攔截配置與庫存保留", "處理多目標與資訊不確定性", "理解單次成功率不等於整體防護效果"],
      success: ["防護任務與庫存風險取得平衡", "能說明感測、指管及環境對結果的影響", "避免把合成機率視為真實武器性能"]
    },
    logistics: {
      title: "後勤持續性與修復",
      objectives: ["維持補給、維修與運輸節點", "在任務壓力下安排修復優先順序", "評估民事交通與軍事後勤的衝突"],
      success: ["持續性指數未跌破危險門檻", "完成至少一次有效修復或替代路線", "提出可驗證的後勤風險指標"]
    },
    intelligence: {
      title: "情報判讀與戰場迷霧",
      objectives: ["區分事實、推測及未知", "評估來源可靠度與分析信心", "避免以單一訊息直接推導對手意圖"],
      success: ["重大決策引用至少兩項獨立線索", "明確標記關鍵假設", "能在新情報出現後修正判斷"]
    },
    civil: {
      title: "民事韌性與危機溝通",
      objectives: ["維持商運、人道與基礎功能", "處理假訊息與群眾焦慮", "平衡軍事行動與民事風險"],
      success: ["民事風險未持續失控", "建立公開訊息與跨部門協調方案", "每回合均評估非軍事後果"]
    },
    diplomacy: {
      title: "升級控制與外交協調",
      objectives: ["辨識可能觸發升級的行動", "利用外交訊號及有限承諾創造降溫窗口", "評估外部支援的政治限制"],
      success: ["保留至少一條降溫或談判路徑", "避免只以戰果衡量任務成果", "能說明軍事與政治目標的關係"]
    }
  };

  const DIFFICULTY = {
    intro: { noise: 0.55, events: 0.65, pressure: 0.75, label: "基礎" },
    standard: { noise: 0.8, events: 0.9, pressure: 1.0, label: "標準" },
    advanced: { noise: 1.0, events: 1.15, pressure: 1.2, label: "進階" }
  };

  const state = {
    scenario: null,
    currentTurn: 1,
    status: {},
    orders: {},
    logs: [],
    revealedIntel: [],
    currentLibrary: "sources",
    aiBusy: false,
    redReactionBusy: false,
    turnBusy: false
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const actorLabel = (id) => ({ BLUE: "藍方", RED: "紅方", AMBER: "美軍支援", WHITE: "白方" }[id] || id);
  const zoneName = (id) => DATA.zones.find(z => z.zone_id === id)?.zone_name || id;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hashText(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function sample(arr, count, rng) {
    const copy = [...arr];
    const result = [];
    while (copy.length && result.length < count) {
      result.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    }
    return result;
  }

  function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function setTab(tabId) {
    document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabId));
    document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.id === tabId));
    if (tabId === "aar") renderAAR();
    if (tabId === "library") renderLibrary();
  }

  function averageForActor(actorId, field) {
    const rows = DATA.forcePackages.filter(p => p.actor_id === actorId);
    if (!rows.length) return 70;
    return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length;
  }

  function initialStatus(scenario) {
    const amberEnabled = scenario.amberSupport !== "none";
    return {
      BLUE: {
        readiness: round1(averageForActor("BLUE", "readiness")),
        sustainment: round1(averageForActor("BLUE", "sustainment")),
        command: round1(averageForActor("BLUE", "command_quality")),
        intel: 64 - scenario.uncertainty * 3,
        resources: 100,
        civilianRisk: 25 + scenario.civilPressure * 5
      },
      RED: {
        readiness: round1(averageForActor("RED", "readiness")),
        sustainment: round1(averageForActor("RED", "sustainment")),
        command: round1(averageForActor("RED", "command_quality")),
        intel: 68 - scenario.uncertainty * 2,
        resources: 100,
        civilianRisk: 0
      },
      AMBER: {
        readiness: amberEnabled ? round1(averageForActor("AMBER", "readiness")) : 0,
        sustainment: amberEnabled ? round1(averageForActor("AMBER", "sustainment")) : 0,
        command: amberEnabled ? round1(averageForActor("AMBER", "command_quality")) : 0,
        intel: amberEnabled ? 82 : 0,
        resources: scenario.amberSupport === "limited" ? 80 : scenario.amberSupport === "indirect" ? 60 : 0,
        civilianRisk: 0
      }
    };
  }

  function generateScenario(formValues) {
    const rng = mulberry32(formValues.seed);
    const focus = FOCUS_LIBRARY[formValues.focus];
    const difficulty = DIFFICULTY[formValues.difficulty];
    const eventCount = Math.max(4, Math.min(DATA.eventCards.length, Math.round(formValues.turns * 0.7 * difficulty.events)));
    const selectedEvents = sample(DATA.eventCards, eventCount, rng).map((event, index) => ({
      ...event,
      trigger_turn: Math.max(2, Math.min(formValues.turns, Math.round(2 + index * ((formValues.turns - 2) / Math.max(1, eventCount - 1))))),
      event_id: `${event.event_id}-${formValues.seed}`
    }));

    const initialIntel = sample(DATA.intelligenceReports, Math.min(6, 2 + formValues.uncertainty), rng).map((r, idx) => ({
      ...r,
      report_id: `GEN-INT-${idx + 1}`,
      turn: Math.min(formValues.turns, Math.max(1, Math.ceil((idx + 1) * formValues.turns / 6))),
      confidence_pct: clamp(Number(r.confidence_pct) - formValues.uncertainty * 4 + Math.round(rng() * 12), 35, 95)
    }));

    const constraints = [
      formValues.teacherConstraints,
      "所有區域均為概略區域，不使用精確座標。",
      "白方可修正模型結果，但必須記錄裁決理由。",
      formValues.amberSupport === "none" ? "本想定不納入美軍支援。" :
        formValues.amberSupport === "indirect" ? "美軍僅提供ISR、後勤、網路與外交等間接支援。" :
        "美軍提供有限海空存在與防護支援，但受政治與升級風險限制。",
      formValues.weatherPreset === "adverse" ? "前半段海象及能見度明顯不利。" :
        formValues.weatherPreset === "stable" ? "天候大致穩定，但仍可能出現局部突變。" :
        "天候與海象在不同區域快速變化。"
    ].filter(Boolean);

    const overviewTemplates = [
      "紅方宣布在臺海周邊進行高強度聯合活動，商船改道、空運受限，雙方在資訊不完整下尋求維持自身目標。",
      "一系列海空活動與資訊操作使區域風險升高，藍方需要在有限資源下維持指揮、交通與民事韌性。",
      "區域出現有限封控、電磁干擾及外交施壓。各方必須判斷對手意圖，並避免局部事件失控。"
    ];

    return {
      id: `TS-${formValues.seed}`,
      name: formValues.name,
      seed: formValues.seed,
      focus: formValues.focus,
      focusTitle: focus.title,
      difficulty: formValues.difficulty,
      difficultyLabel: difficulty.label,
      turns: formValues.turns,
      hoursPerTurn: formValues.hoursPerTurn,
      uncertainty: formValues.uncertainty,
      civilPressure: formValues.civilPressure,
      amberSupport: formValues.amberSupport,
      weatherPreset: formValues.weatherPreset,
      overview: pick(overviewTemplates, rng),
      objectives: focus.objectives,
      successCriteria: focus.success,
      constraints,
      events: selectedEvents,
      intel: initialIntel,
      createdAt: new Date().toISOString(),
      dataClass: "EDUCATIONAL_SYNTHETIC"
    };
  }

  function readScenarioForm() {
    return {
      name: $("scenarioName").value.trim() || "未命名課程想定",
      seed: Number($("scenarioSeed").value) || Date.now(),
      focus: $("focus").value,
      difficulty: $("difficulty").value,
      turns: clamp(Number($("turns").value) || 12, 4, 24),
      hoursPerTurn: Number($("hoursPerTurn").value),
      uncertainty: Number($("uncertainty").value),
      civilPressure: Number($("civilPressure").value),
      amberSupport: $("amberSupport").value,
      weatherPreset: $("weatherPreset").value,
      teacherConstraints: $("teacherConstraints").value.trim()
    };
  }

  function setAiStatus(message, type = "") {
    const node = $("aiStatus");
    node.textContent = message;
    node.className = `api-status ${type}`.trim();
  }

  function getProviderConfig() {
    return API_PROVIDERS[$("apiProvider").value] || API_PROVIDERS.cgu;
  }

  function normalizeResponsesEndpoint(endpoint) {
    const value = endpoint.trim().replace(/\/+$/, "");
    return !value || /\/responses$/i.test(value) ? value : `${value}/responses`;
  }

  function normalizeAnthropicEndpoint(endpoint) {
    const value = endpoint.trim().replace(/\/+$/, "");
    return !value || /\/messages$/i.test(value) ? value : `${value}/messages`;
  }

  function normalizeGeminiEndpoint(endpoint, model) {
    const value = endpoint.trim().replace(/\/+$/, "");
    if (!value || /\/interactions$/i.test(value) || /:generateContent$/i.test(value)) return value;
    if (/\/models\/[^/]+$/i.test(value)) return `${value}:generateContent`;
    return `${value}/models/${encodeURIComponent(model)}:generateContent`;
  }

  function stripBearer(value) {
    return value.replace(/^Bearer\s+/i, "").trim();
  }

  function requireApiSettings() {
    const provider = getProviderConfig();
    const apiKey = $("apiKey").value.trim();
    const model = $("apiModel").value.trim();
    let endpoint = $("apiEndpoint").value.trim();

    if (!endpoint) {
      setAiStatus("請先輸入 API endpoint。", "error");
      return null;
    }
    if (!apiKey) {
      setAiStatus(`請先輸入 ${provider.label} 的 API Key。`, "error");
      $("apiKey").focus();
      return null;
    }
    if (!model) {
      setAiStatus("請先輸入模型名稱。", "error");
      $("apiModel").focus();
      return null;
    }

    if (provider.apiStyle === "responses") endpoint = normalizeResponsesEndpoint(endpoint);
    if (provider.apiStyle === "gemini") endpoint = normalizeGeminiEndpoint(endpoint, model);
    if (provider.apiStyle === "anthropic") endpoint = normalizeAnthropicEndpoint(endpoint);

    return { ...provider, endpoint, apiKey, model };
  }

  function applyProviderPreset() {
    const provider = getProviderConfig();
    $("apiEndpoint").value = provider.endpoint;
    $("apiModel").value = provider.model;
    $("apiKey").value = "";
    $("aiProviderBadge").textContent = provider.shortLabel;
    setAiStatus(`已切換為 ${provider.label}。請輸入該服務的 API Key。`, "ok");
  }

  function buildAiPrompt(formValues) {
    const focus = FOCUS_LIBRARY[formValues.focus];
    const input = {
      scenario_name: formValues.name,
      teaching_focus: focus.title,
      difficulty: DIFFICULTY[formValues.difficulty].label,
      turns: formValues.turns,
      hours_per_turn: formValues.hoursPerTurn,
      intelligence_uncertainty_1_to_5: formValues.uncertainty,
      civilian_pressure_1_to_5: formValues.civilPressure,
      us_support: amberLabel(formValues.amberSupport),
      weather: weatherLabel(formValues.weatherPreset),
      teacher_constraints: formValues.teacherConstraints || "無額外限制"
    };
    return [
      "請依下列設定建立繁體中文的課程用臺海危機想定，並只輸出符合指定 JSON schema 的物件。",
      "所有內容必須是合成、抽象、非機密的教學資料；不得提供精確座標、真實部署、現役庫存、武器弱點、射擊表、可靠實戰效能或可直接執行的作戰指令。",
      "重點是決策、不確定性、民事韌性、危機溝通、後勤及升級控制。事件數值只是 -10 到 12 間的小幅抽象指標。",
      "事件回合必須落在 1 到總回合數；區域只能使用 schema 所列的抽象 zone_id。若不納入美軍，不要把 AMBER 設為受影響角色或情報接收者。",
      "每段文字務求精簡，overview 約 100 至 180 個中文字，其他欄位每項一至兩句。",
      `課程設定：${JSON.stringify(input)}`
    ].join("\n");
  }

  function buildAiRequest(
    prompt,
    settings,
    schema = AI_SCENARIO_SCHEMA,
    schemaName = "educational_scenario",
    systemMessage = "你是課程想定設計助手。嚴格遵守安全界線，輸出繁體中文結構化 JSON。"
  ) {
    if (settings.apiStyle === "responses") {
      return {
        headers: {
          "Authorization": /^Bearer\s+/i.test(settings.apiKey) ? settings.apiKey : `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json"
        },
        body: {
          model: settings.model,
          store: false,
          instructions: systemMessage,
          input: prompt,
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              strict: true,
              schema
            }
          }
        }
      };
    }

    if (settings.apiStyle === "gemini") {
      const headers = { "x-goog-api-key": stripBearer(settings.apiKey), "Content-Type": "application/json" };
      if (/\/interactions$/i.test(settings.endpoint)) {
        return {
          headers,
          body: {
            model: settings.model,
            input: [{ type: "text", text: prompt }],
            response_format: { type: "text", mime_type: "application/json", schema },
            generation_config: { thinking_level: "minimal" }
          }
        };
      }
      return {
        headers,
        body: {
          systemInstruction: { parts: [{ text: systemMessage }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schema
          }
        }
      };
    }

    return {
      headers: {
        "x-api-key": stripBearer(settings.apiKey),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json"
      },
      body: {
        model: settings.model,
        max_tokens: 6000,
        system: `${systemMessage}\n只輸出 JSON，不要使用 Markdown code fence。`,
        messages: [{ role: "user", content: prompt }]
      }
    };
  }

  function extractModelText(responseJson) {
    if (typeof responseJson.output_text === "string") return responseJson.output_text;

    const responseChunks = [];
    for (const item of responseJson.output || []) {
      if (typeof item.text === "string") responseChunks.push(item.text);
      for (const content of item.content || []) {
        if (typeof content.text === "string") responseChunks.push(content.text);
      }
    }
    if (responseChunks.length) return responseChunks.join("\n");

    const geminiChunks = [];
    for (const candidate of responseJson.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (typeof part.text === "string") geminiChunks.push(part.text);
      }
    }
    if (geminiChunks.length) return geminiChunks.join("\n");

    const claudeChunks = (responseJson.content || [])
      .filter(item => item && typeof item.text === "string")
      .map(item => item.text);
    return claudeChunks.join("\n");
  }

  function parseModelJson(textValue) {
    const text = String(textValue || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    try {
      return JSON.parse(text);
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
      throw new Error("模型回應不是有效的 JSON。");
    }
  }

  async function requestStructuredJson(prompt, settings, schema, schemaName, systemMessage, signal) {
    const request = buildAiRequest(prompt, settings, schema, schemaName, systemMessage);
    let response;
    try {
      response = await fetch(settings.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal
      });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error(`無法連線到 ${settings.label}：${error.message || "請檢查網路、CORS 或 endpoint"}`);
    }

    const responseText = await response.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      throw new Error(`API 回應不是 JSON：${responseText.slice(0, 160)}`);
    }
    if (!response.ok) {
      const detail = responseJson.error?.message || responseJson.error?.type || responseJson.message || `HTTP ${response.status}`;
      throw new Error(String(detail));
    }

    const outputText = extractModelText(responseJson);
    if (!outputText) throw new Error("API 回應中沒有可解析的模型文字。");
    return parseModelJson(outputText);
  }

  function normalizeTextArray(value, fallback, minItems = 3, maxItems = 6) {
    const rows = Array.isArray(value)
      ? value.map(item => String(item || "").trim().slice(0, 260)).filter(Boolean).slice(0, maxItems)
      : [];
    return rows.length >= minItems ? rows : fallback;
  }

  function normalizeAiScenario(raw, formValues) {
    const base = generateScenario(formValues);
    const zones = new Set(DATA.zones.map(zone => zone.zone_id));
    const actors = new Set(["BLUE", "RED", "AMBER", "WHITE", "ALL"]);
    const intelActors = new Set(["BLUE", "RED", "AMBER"]);
    const reliabilities = new Set(["A", "B", "C", "D"]);
    const toInt = (value, min, max, fallback = 0) => clamp(Math.round(Number(value) || fallback), min, max);

    base.overview = String(raw?.overview || "").trim().slice(0, 700) || base.overview;
    base.objectives = normalizeTextArray(raw?.objectives, base.objectives, 3, 4);
    base.successCriteria = normalizeTextArray(raw?.successCriteria, base.successCriteria, 3, 4);
    const aiConstraints = normalizeTextArray(raw?.constraints, [], 3, 6);
    base.constraints = [...new Set([...aiConstraints, ...base.constraints])];

    const events = Array.isArray(raw?.events) ? raw.events.slice(0, 8).map((event, index) => ({
      event_id: `AI-EVT-${index + 1}-${formValues.seed}`,
      trigger_turn: toInt(event.trigger_turn, 1, formValues.turns, Math.min(formValues.turns, index + 2)),
      event_name: String(event.event_name || `合成事件 ${index + 1}`).trim().slice(0, 80),
      category: String(event.category || "綜合").trim().slice(0, 40),
      zone_id: zones.has(event.zone_id) ? event.zone_id : "Z-ISL",
      affected_actor: actors.has(event.affected_actor) ? event.affected_actor : "ALL",
      description: String(event.description || "白方依課堂狀況裁決影響。").trim().slice(0, 220),
      readiness_delta: toInt(event.readiness_delta, -10, 10),
      mobility_delta: 0,
      sustainment_delta: toInt(event.sustainment_delta, -10, 10),
      command_delta: toInt(event.command_delta, -10, 10),
      civilian_risk_delta: toInt(event.civilian_risk_delta, -10, 12),
      trigger_type: "AI 合成"
    })).filter(event => formValues.amberSupport !== "none" || event.affected_actor !== "AMBER") : [];
    if (events.length >= 4) base.events = events;

    const intel = Array.isArray(raw?.intel) ? raw.intel.slice(0, 8).map((report, index) => ({
      report_id: `AI-INT-${index + 1}-${formValues.seed}`,
      turn: toInt(report.turn, 1, formValues.turns, Math.min(formValues.turns, index + 1)),
      recipient_actor: intelActors.has(report.recipient_actor) ? report.recipient_actor : "BLUE",
      zone_id: zones.has(report.zone_id) ? report.zone_id : "Z-ISL",
      report_type: String(report.report_type || "綜合跡象").trim().slice(0, 60),
      report_text: String(report.report_text || "目前跡象仍有不確定性，需交叉驗證。").trim().slice(0, 240),
      source_reliability: reliabilities.has(report.source_reliability) ? report.source_reliability : "C",
      confidence_pct: toInt(report.confidence_pct, 35, 95, 60),
      assessed_level: 3,
      teacher_truth_level: 3,
      visibility: "學生可見",
      note: "AI 合成情報；僅供課程使用"
    })).filter(report => formValues.amberSupport !== "none" || report.recipient_actor !== "AMBER") : [];
    if (intel.length >= 4) base.intel = intel;

    return base;
  }

  async function generateScenarioWithAi() {
    if (state.aiBusy) return;
    const settings = requireApiSettings();
    if (!settings) return;

    state.aiBusy = true;
    $("generateAiBtn").disabled = true;
    $("generateAiBtn").textContent = "AI 生成中…";
    setAiStatus(`正在呼叫 ${settings.label}（${settings.model}）…`, "busy");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const formValues = readScenarioForm();
      const rawScenario = await requestStructuredJson(
        buildAiPrompt(formValues),
        settings,
        AI_SCENARIO_SCHEMA,
        "educational_scenario",
        "你是課程想定設計助手。嚴格遵守安全界線，輸出繁體中文結構化 JSON。",
        controller.signal
      );
      const scenario = normalizeAiScenario(rawScenario, formValues);
      scenario.aiGenerated = {
        provider: settings.shortLabel,
        model: settings.model,
        generatedAt: new Date().toISOString()
      };
      beginScenario(scenario);
      setAiStatus(`完成：已使用 ${settings.shortLabel} / ${settings.model} 生成想定。請由教師檢閱後使用。`, "ok");
    } catch (error) {
      const message = error.name === "AbortError"
        ? "API 等候超過 120 秒，已停止請求。"
        : `AI 生成失敗：${error.message || "未知錯誤"}`;
      setAiStatus(message, "error");
      toast("AI 生成失敗；離線生成器仍可正常使用。");
    } finally {
      clearTimeout(timeoutId);
      state.aiBusy = false;
      $("generateAiBtn").disabled = false;
      $("generateAiBtn").textContent = "使用 AI 生成想定";
    }
  }

  function beginScenario(scenario) {
    state.scenario = scenario;
    state.currentTurn = 1;
    state.status = initialStatus(scenario);
    state.orders = {};
    state.logs = [];
    state.revealedIntel = [];
    saveState(false);
    renderScenario();
    renderSimulation();
    renderAAR();
    toast("想定已生成，可進入回合推演。");
  }

  function renderScenario() {
    const container = $("scenarioPreview");
    if (!state.scenario) {
      container.className = "preview empty-state";
      container.textContent = "尚未生成想定。調整左側參數後按下「生成想定」。";
      return;
    }
    const s = state.scenario;
    container.className = "preview";
    container.innerHTML = `
      <div class="preview-summary">
        <div class="subheading">
          <div>
            <p class="eyebrow">${escapeHtml(s.id)} · ${escapeHtml(s.difficultyLabel)}</p>
            <h3>${escapeHtml(s.name)}</h3>
          </div>
          <span class="badge">${s.turns}回合 × ${s.hoursPerTurn}小時</span>
        </div>
        <p>${escapeHtml(s.overview)}</p>
        <div class="tag-list">
          <span class="tag">${escapeHtml(s.focusTitle)}</span>
          <span class="tag">情報不確定度 ${s.uncertainty}/5</span>
          <span class="tag">民事壓力 ${s.civilPressure}/5</span>
          <span class="tag">${amberLabel(s.amberSupport)}</span>
          <span class="tag">${weatherLabel(s.weatherPreset)}</span>
          <span class="tag">${s.aiGenerated ? `AI：${escapeHtml(s.aiGenerated.provider)} / ${escapeHtml(s.aiGenerated.model)}` : "離線規則生成"}</span>
        </div>
      </div>
      <div class="preview-grid">
        <article class="card">
          <h3>學習目標</h3>
          <ul class="compact-list">${s.objectives.map(v => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
        </article>
        <article class="card">
          <h3>成功條件</h3>
          <ul class="compact-list">${s.successCriteria.map(v => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
        </article>
        <article class="card">
          <h3>限制與規則</h3>
          <ul class="compact-list">${s.constraints.map(v => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
        </article>
      </div>
      <div class="actions" style="margin-top:1rem">
        <button class="primary" id="goSimulationBtn">開始回合推演</button>
        <button class="secondary" id="regenerateEventsBtn">以相同設定重抽事件</button>
      </div>
    `;
    $("goSimulationBtn").addEventListener("click", () => setTab("simulation"));
    $("regenerateEventsBtn").addEventListener("click", () => {
      $("scenarioSeed").value = Number($("scenarioSeed").value) + 1;
      beginScenario(generateScenario(readScenarioForm()));
    });
  }

  function amberLabel(value) {
    return ({ none: "不納入美軍", indirect: "美軍間接支援", limited: "美軍有限支援" }[value] || value);
  }

  function weatherLabel(value) {
    return ({ stable: "穩定天候", variable: "多變天候", adverse: "不利天候" }[value] || value);
  }

  function renderSimulation() {
    const hasScenario = !!state.scenario;
    $("simulationEmpty").hidden = hasScenario;
    $("simulationContent").hidden = !hasScenario;
    $("resolveTurnBtn").disabled = !hasScenario || state.currentTurn > (state.scenario?.turns || 0);
    if (!hasScenario) return;

    $("turnBadge").textContent = state.currentTurn > state.scenario.turns
      ? "推演完成"
      : `第 ${state.currentTurn} / ${state.scenario.turns} 回合（T+${(state.currentTurn - 1) * state.scenario.hoursPerTurn}h）`;

    renderStatusCards();
    renderZoneMap();
    renderOrderControls();
    renderCurrentOrders();
    renderTurnPanels();
    renderNarrative();
    updateLab();
  }

  function renderStatusCards() {
    const cards = [
      ["BLUE", "藍方準備指數"],
      ["RED", "紅方準備指數"],
      ["AMBER", "外部支援準備"],
      ["CIV", "民事風險"]
    ];
    $("statusCards").innerHTML = cards.map(([id, label]) => {
      if (id === "CIV") {
        return `<article class="metric neutral"><small>${label}</small><strong>${round1(state.status.BLUE.civilianRisk)}</strong><small>0低風險／100高風險</small></article>`;
      }
      const actor = state.status[id];
      return `<article class="metric ${id.toLowerCase()}">
        <small>${label}</small>
        <strong>${round1(actor.readiness)}</strong>
        <small>後勤 ${round1(actor.sustainment)} · 指管 ${round1(actor.command)} · 資源 ${round1(actor.resources)}</small>
      </article>`;
    }).join("");
  }

  function renderZoneMap() {
    const currentOrders = state.orders[state.currentTurn] || {};
    const currentEvent = state.scenario.events.find(e => Number(e.trigger_turn) === state.currentTurn);
    const zones = DATA.zones.filter(z => z.zone_id !== "Z-REAR" || state.scenario.amberSupport !== "none");
    $("zoneMap").innerHTML = zones.map(zone => {
      const signals = [];
      Object.values(currentOrders).forEach(order => {
        if (order.zone === zone.zone_id) signals.push(order.actor.toLowerCase());
      });
      if (currentEvent?.zone_id === zone.zone_id) signals.push("neutral");
      return `<div class="zone" data-zone="${zone.zone_id}" title="${escapeHtml(zone.teaching_note || "")}">
        <div><span class="zone-name">${escapeHtml(zone.zone_name)}</span><br><small>${escapeHtml(zone.domain)} · ${escapeHtml(zone.distance_band)}</small></div>
        <div class="zone-signals">${signals.map(s => `<i class="signal ${s}"></i>`).join("")}</div>
      </div>`;
    }).join("");
  }

  function renderOrderControls() {
    const zoneSelect = $("orderZone");
    if (!zoneSelect.options.length) {
      zoneSelect.innerHTML = DATA.zones
        .filter(z => z.zone_id !== "Z-REAR" || state.scenario.amberSupport !== "none")
        .map(z => `<option value="${z.zone_id}">${escapeHtml(z.zone_name)}</option>`).join("");
    }
    updateActionOptions();
    const finished = state.currentTurn > state.scenario.turns;
    [...$("orderForm").elements].forEach(el => el.disabled = finished);
    $("resolveTurnBtn").disabled = finished || state.turnBusy;
    renderRedReactionStatus();
  }

  function updateActionOptions() {
    const actor = $("orderActor").value;
    $("orderAction").innerHTML = ACTIONS[actor].map(([name]) => `<option>${escapeHtml(name)}</option>`).join("");
  }

  function renderCurrentOrders() {
    const current = state.orders[state.currentTurn] || {};
    const orderList = $("currentOrders");
    const values = Object.values(current);
    if (!values.length) {
      orderList.innerHTML = `<p class="muted">本回合尚未提交命令。</p>`;
      return;
    }
    orderList.innerHTML = values.map(order => `
      <div class="order-item ${order.actor}">
        <strong>${actorLabel(order.actor)}：${escapeHtml(order.action)}</strong>
        ${order.actor === "RED" && order.reactionSource ? `<span class="reaction-source">${order.reactionSource === "ai" ? `AI · ${escapeHtml(order.reactionProvider || "語言模型")}` : order.reactionSource === "rules-fallback" ? "規則備援" : "規則生成"}</span>` : ""}
        <div>${zoneName(order.zone)} · 資源 ${order.resource} · ${escapeHtml(order.rationale || "未填寫理由")}</div>
        ${order.reactionSummary ? `<div class="reaction-summary"><strong>反應摘要：</strong>${escapeHtml(order.reactionSummary)}</div>` : ""}
      </div>`).join("");
  }

  function setRedReactionStatus(message, type = "") {
    const node = $("redReactionStatus");
    node.textContent = message;
    node.className = `full reaction-status ${type}`.trim();
  }

  function renderRedReactionStatus() {
    const current = state.orders[state.currentTurn] || {};
    const button = $("redReactionBtn");
    const finished = !state.scenario || state.currentTurn > state.scenario.turns;
    button.disabled = finished || !current.BLUE || state.redReactionBusy || state.turnBusy;
    button.textContent = state.redReactionBusy
      ? "生成反應中…"
      : current.RED?.reactionSource ? "重新生成紅方反應" : "生成紅方反應";

    if (finished) return setRedReactionStatus("本次推演已完成。", "");
    if (state.redReactionBusy) return setRedReactionStatus("正在依藍方命令產生紅方反應…", "busy");
    if (!current.BLUE) return setRedReactionStatus("先提交藍方命令，即可生成紅方反應；有輸入 API Key 時會優先使用語言模型。", "");
    if (!current.RED) return setRedReactionStatus("藍方命令已提交。可生成紅方反應；未輸入 API Key 時使用規則生成。", "");
    if (current.RED.reactionSource === "ai") {
      return setRedReactionStatus(`已使用 ${current.RED.reactionProvider || "語言模型"} 生成紅方反應，可再生成或手動修改。`, "ok");
    }
    if (current.RED.reactionSource === "rules-fallback") {
      return setRedReactionStatus(`語言模型無法完成，已改用規則反應。${current.RED.reactionError || ""}`, "warn");
    }
    if (current.RED.reactionSource === "rules") {
      return setRedReactionStatus("已使用離線規則生成紅方反應，可再生成或手動修改。", "ok");
    }
    setRedReactionStatus("目前紅方命令為手動輸入；生成紅方反應會取代此命令。", "warn");
  }

  function currentIntel() {
    if (!state.scenario) return [];
    return state.scenario.intel.filter(i => Number(i.turn) === state.currentTurn);
  }

  function currentWeather() {
    if (!state.scenario) return [];
    const baseTurn = ((state.currentTurn - 1) % 12) + 1;
    const rows = DATA.weather.filter(w => Number(w.turn) === baseTurn);
    const modifier = state.scenario.weatherPreset === "adverse" ? 1 :
      state.scenario.weatherPreset === "stable" ? -1 : 0;
    return rows.map(w => ({
      ...w,
      sea_state_1_5: clamp(Number(w.sea_state_1_5) + modifier, 1, 5),
      visibility_1_5: clamp(Number(w.visibility_1_5) - modifier, 1, 5)
    }));
  }

  function renderTurnPanels() {
    const intel = currentIntel();
    $("intelPanel").innerHTML = intel.length ? intel.map(i => `
      <div class="turn-log">
        <strong>${escapeHtml(i.report_type)} · ${zoneName(i.zone_id)}</strong>
        <p>${escapeHtml(i.report_text)}</p>
        <small>來源 ${escapeHtml(i.source_reliability)} · 信心 ${i.confidence_pct}%</small>
      </div>`).join("") : `<p class="muted">本回合沒有新增情報；學生需判斷資訊缺口。</p>`;

    const weather = currentWeather();
    const worst = [...weather].sort((a, b) => Number(b.sea_state_1_5) - Number(a.sea_state_1_5))[0];
    $("weatherPanel").innerHTML = worst ? `
      <p><strong>${zoneName(worst.zone_id)}</strong>環境最不利。</p>
      <ul class="compact-list">
        <li>海象：${worst.sea_state_1_5}/5</li>
        <li>能見度：${worst.visibility_1_5}/5</li>
        <li>風速：約 ${worst.wind_kts} 節（合成）</li>
        <li>降水機率：${worst.precip_probability_pct}%（合成）</li>
      </ul>` : `<p class="muted">無資料。</p>`;

    const event = state.scenario.events.find(e => Number(e.trigger_turn) === state.currentTurn);
    $("eventPanel").innerHTML = event ? `
      <div class="turn-log">
        <strong>${escapeHtml(event.event_name)}</strong>
        <p>${escapeHtml(event.description)}</p>
        <small>${escapeHtml(event.category)} · ${zoneName(event.zone_id)}</small>
      </div>` : `<p class="muted">白方可視課堂狀況臨時加入事件。</p>`;
  }

  function submitOrder(event) {
    event.preventDefault();
    if (!state.scenario || state.currentTurn > state.scenario.turns) return;
    const actor = $("orderActor").value;
    if (actor === "AMBER" && state.scenario.amberSupport === "none") {
      toast("本想定未納入美軍支援。");
      return;
    }
    const order = {
      actor,
      action: $("orderAction").value,
      zone: $("orderZone").value,
      resource: clamp(Number($("orderResource").value) || 20, 5, 35),
      rationale: $("orderRationale").value.trim(),
      submittedAt: new Date().toISOString()
    };
    state.orders[state.currentTurn] ||= {};
    state.orders[state.currentTurn][actor] = order;
    $("orderRationale").value = "";
    saveState(false);
    renderSimulation();
    toast(`${actorLabel(actor)}命令已提交。`);
  }

  function buildRuleBasedRedReaction(blueOrder, source = "rules") {
    const mapping = {
      "強化防空警戒": ["電磁壓制", "以資訊與指揮壓力測試藍方警戒負荷。"],
      "商船護航": ["調整封控區", "改變抽象封控壓力，增加航運協調與民事決策負荷。"],
      "分散部署": ["外交訊息操作", "以公開訊息與政治壓力回應藍方分散行動。"],
      "備援通訊": ["電磁壓制", "提高抽象通訊壓力，觀察藍方備援與指揮韌性。"],
      "後勤修復": ["調整封控區", "調整區域壓力，使藍方重新分配後勤與民事資源。"],
      "情報融合": ["外交訊息操作", "製造相互競爭的公開訊號，增加判讀與溝通成本。"]
    };
    const selected = mapping[blueOrder.action] || ["增加空中施壓", "維持抽象區域壓力並觀察藍方後續決策。"];
    const validZone = blueOrder.zone !== "Z-REAR" && DATA.zones.some(zone => zone.zone_id === blueOrder.zone)
      ? blueOrder.zone
      : "Z-CW";
    const available = Number(state.status.RED?.resources ?? 100);
    const resource = available < 25 ? 10 : clamp(Math.round(14 + Number(blueOrder.resource || 20) * 0.35), 10, 28);
    return {
      actor: "RED",
      action: selected[0],
      zone: validZone,
      resource,
      rationale: `規則反應：針對藍方「${blueOrder.action}」，${selected[1]}`,
      reactionSummary: selected[1],
      reactionSource: source,
      reactionTo: { action: blueOrder.action, zone: blueOrder.zone },
      submittedAt: new Date().toISOString()
    };
  }

  function buildRedReactionPrompt(blueOrder) {
    const event = state.scenario.events.find(item => Number(item.trigger_turn) === state.currentTurn);
    const allowedActions = ACTIONS.RED.map(([name]) => name);
    const allowedZones = DATA.zones.filter(zone => zone.zone_id !== "Z-REAR").map(zone => ({ id: zone.zone_id, name: zone.zone_name }));
    const context = {
      scenario: state.scenario.name,
      turn: state.currentTurn,
      total_turns: state.scenario.turns,
      teaching_focus: state.scenario.focusTitle,
      difficulty: state.scenario.difficultyLabel,
      blue_order: {
        action: blueOrder.action,
        zone: blueOrder.zone,
        resource: blueOrder.resource,
        rationale: blueOrder.rationale || "未提供"
      },
      current_event: event ? `${event.event_name}：${event.description}` : "無預排事件",
      abstract_status: {
        red_readiness: round1(state.status.RED.readiness),
        red_sustainment: round1(state.status.RED.sustainment),
        red_resources: round1(state.status.RED.resources),
        civilian_risk: round1(state.status.BLUE.civilianRisk)
      },
      allowed_actions: allowedActions,
      allowed_zones: allowedZones
    };
    return [
      "請為課堂回合推演產生一項紅方反應，並只輸出符合 JSON schema 的物件。",
      "action 必須逐字選自 allowed_actions，zone 必須選自 allowed_zones 的 id，resource 為 5 到 35 的整數。",
      "反應需針對藍方本回合命令，兼顧資源、民事影響、情報不確定性與升級控制。",
      "內容必須是抽象、合成的教學敘事，不得提供精確座標、真實部署、現役庫存、武器弱點、射擊參數或可直接執行的作戰指令。",
      "rationale 說明選擇原因；reaction_summary 用一至兩句繁體中文描述學生可觀察的反應。",
      `回合資料：${JSON.stringify(context)}`
    ].join("\n");
  }

  function normalizeAiRedReaction(raw, blueOrder, settings) {
    const fallback = buildRuleBasedRedReaction(blueOrder);
    const allowedActions = new Set(ACTIONS.RED.map(([name]) => name));
    const allowedZones = new Set(DATA.zones.filter(zone => zone.zone_id !== "Z-REAR").map(zone => zone.zone_id));
    return {
      actor: "RED",
      action: allowedActions.has(raw?.action) ? raw.action : fallback.action,
      zone: allowedZones.has(raw?.zone) ? raw.zone : fallback.zone,
      resource: clamp(Math.round(Number(raw?.resource) || fallback.resource), 5, 35),
      rationale: String(raw?.rationale || fallback.rationale).trim().slice(0, 360),
      reactionSummary: String(raw?.reaction_summary || fallback.reactionSummary).trim().slice(0, 300),
      reactionSource: "ai",
      reactionProvider: `${settings.shortLabel} / ${settings.model}`,
      reactionTo: { action: blueOrder.action, zone: blueOrder.zone },
      submittedAt: new Date().toISOString()
    };
  }

  async function generateRedReaction(options = {}) {
    if (!state.scenario || state.currentTurn > state.scenario.turns || state.redReactionBusy) return null;
    state.orders[state.currentTurn] ||= {};
    const blueOrder = state.orders[state.currentTurn].BLUE;
    if (!blueOrder) {
      setRedReactionStatus("請先提交藍方命令，再生成紅方反應。", "warn");
      if (options.showToast !== false) toast("請先提交藍方命令。");
      return null;
    }

    state.redReactionBusy = true;
    renderRedReactionStatus();
    const hasApiKey = Boolean($("apiKey").value.trim());
    let reaction;
    let settings = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      if (hasApiKey) {
        settings = requireApiSettings();
        if (!settings) throw new Error("API 設定不完整");
        const raw = await requestStructuredJson(
          buildRedReactionPrompt(blueOrder),
          settings,
          RED_REACTION_SCHEMA,
          "red_force_reaction",
          "你是教育用回合推演的紅方反應設計助手。只可使用指定的抽象行動與區域，並嚴格遵守安全界線。",
          controller.signal
        );
        reaction = normalizeAiRedReaction(raw, blueOrder, settings);
      } else {
        reaction = buildRuleBasedRedReaction(blueOrder);
      }
    } catch (error) {
      reaction = buildRuleBasedRedReaction(blueOrder, "rules-fallback");
      reaction.reactionError = error.name === "AbortError"
        ? "API 等候超過 120 秒。"
        : `原因：${String(error.message || "未知錯誤").slice(0, 140)}`;
    } finally {
      clearTimeout(timeoutId);
      state.redReactionBusy = false;
    }

    state.orders[state.currentTurn].RED = reaction;
    saveState(false);
    if (options.render !== false) renderSimulation();
    if (options.showToast !== false) {
      toast(reaction.reactionSource === "ai" ? "已使用語言模型生成紅方反應。" : "已使用離線規則生成紅方反應。");
    }
    return reaction;
  }

  function autoFillOrders(options = {}) {
    if (!state.scenario) return;
    const rng = mulberry32(state.scenario.seed + state.currentTurn * 991);
    state.orders[state.currentTurn] ||= {};
    const actors = state.scenario.amberSupport === "none" ? ["BLUE", "RED"] : ["BLUE", "RED", "AMBER"];
    actors.forEach(actor => {
      if (options.skipRed && actor === "RED") return;
      if (state.orders[state.currentTurn][actor]) return;
      if (actor === "RED" && state.orders[state.currentTurn].BLUE) {
        state.orders[state.currentTurn].RED = buildRuleBasedRedReaction(state.orders[state.currentTurn].BLUE);
        return;
      }
      const action = pick(ACTIONS[actor], rng)[0];
      const zone = pick(DATA.zones.filter(z => z.zone_id !== "Z-REAR" || actor === "AMBER"), rng).zone_id;
      state.orders[state.currentTurn][actor] = {
        actor,
        action,
        zone,
        resource: Math.round(12 + rng() * 15),
        rationale: "系統自動產生：依本回合態勢選擇一項代表性行動。",
        submittedAt: new Date().toISOString()
      };
    });
    saveState(false);
    if (options.render !== false) renderSimulation();
    if (options.showToast !== false) toast("已自動補齊尚未提交的角色命令。");
  }

  function actionEffect(actor, actionName) {
    return ACTIONS[actor].find(([name]) => name === actionName)?.[1] || {};
  }

  function orderScore(order, status, rng) {
    if (!order) return 0;
    const effort = Math.sqrt(order.resource) * 2.3;
    const readiness = status.readiness * 0.22;
    const command = status.command * 0.16;
    const sustain = status.sustainment * 0.12;
    const riskBonus = (order.resource > 25 ? 4 : 0);
    return effort + readiness + command + sustain + riskBonus + (rng() - 0.5) * 14;
  }

  function applyOwnAction(actor, order) {
    if (!order) return;
    const effect = actionEffect(actor, order.action);
    const status = state.status[actor];
    const scale = order.resource / 20;
    status.readiness = clamp(status.readiness + (effect.readiness || 0) * scale);
    status.sustainment = clamp(status.sustainment + (effect.sustainment || 0) * scale);
    status.command = clamp(status.command + (effect.command || 0) * scale);
    status.intel = clamp(status.intel + (effect.intel || 0) * scale);
    status.resources = clamp(status.resources - order.resource * 0.72);
    if (actor === "BLUE" || actor === "RED") {
      state.status.BLUE.civilianRisk = clamp(state.status.BLUE.civilianRisk + (effect.civilian || 0) * scale);
    }
  }

  function applyEvent(event) {
    if (!event) return;
    const affected = event.affected_actor === "ALL"
      ? ["BLUE", "RED", ...(state.scenario.amberSupport === "none" ? [] : ["AMBER"])]
      : [event.affected_actor].filter(id => state.status[id]);

    affected.forEach(actor => {
      state.status[actor].readiness = clamp(state.status[actor].readiness + Number(event.readiness_delta || 0));
      state.status[actor].sustainment = clamp(state.status[actor].sustainment + Number(event.sustainment_delta || 0));
      state.status[actor].command = clamp(state.status[actor].command + Number(event.command_delta || 0));
    });
    state.status.BLUE.civilianRisk = clamp(state.status.BLUE.civilianRisk + Number(event.civilian_risk_delta || 0));
  }

  async function resolveTurn() {
    if (!state.scenario || state.currentTurn > state.scenario.turns || state.turnBusy) return;
    state.turnBusy = true;
    $("resolveTurnBtn").disabled = true;
    $("resolveTurnBtn").textContent = "結算中…";
    try {
      autoFillOrders({ skipRed: true, render: false, showToast: false });
      if (!state.orders[state.currentTurn]?.RED) {
        await generateRedReaction({ render: false, showToast: false });
      }
      autoFillOrders({ render: false, showToast: false });
    const orders = state.orders[state.currentTurn] || {};
    const rng = mulberry32(state.scenario.seed + state.currentTurn * 7919 + hashText(JSON.stringify(orders)));
    const difficulty = DIFFICULTY[state.scenario.difficulty];
    const event = state.scenario.events.find(e => Number(e.trigger_turn) === state.currentTurn) || null;
    const weather = currentWeather();
    const avgSea = weather.reduce((sum, w) => sum + Number(w.sea_state_1_5), 0) / Math.max(1, weather.length);
    const avgVisibility = weather.reduce((sum, w) => sum + Number(w.visibility_1_5), 0) / Math.max(1, weather.length);

    Object.values(orders).forEach(order => applyOwnAction(order.actor, order));
    applyEvent(event);

    const blueScore = orderScore(orders.BLUE, state.status.BLUE, rng) + state.status.BLUE.intel * 0.13;
    const redScore = orderScore(orders.RED, state.status.RED, rng) + state.status.RED.intel * 0.13;
    const amberContribution = orders.AMBER ? orderScore(orders.AMBER, state.status.AMBER, rng) * (
      state.scenario.amberSupport === "limited" ? 0.24 : 0.15
    ) : 0;
    const environmentPenalty = (avgSea - 2.5) * 1.8 + (3.5 - avgVisibility) * 1.2;
    const balance = blueScore + amberContribution - redScore - environmentPenalty * difficulty.pressure;

    const blueLoss = clamp(4.8 + difficulty.pressure * 2.2 - balance * 0.055 + rng() * 3, 1, 13);
    const redLoss = clamp(4.4 + balance * 0.05 + rng() * 3, 1, 13);
    state.status.BLUE.readiness = clamp(state.status.BLUE.readiness - blueLoss);
    state.status.RED.readiness = clamp(state.status.RED.readiness - redLoss);

    // Sustainment deterioration and limited recovery
    ["BLUE", "RED"].forEach(actor => {
      const load = (orders[actor]?.resource || 10) * 0.08;
      state.status[actor].sustainment = clamp(state.status[actor].sustainment - load - rng() * 1.5);
      state.status[actor].command = clamp(state.status[actor].command - Math.max(0, state.scenario.uncertainty - 2) * 0.5 + rng());
    });

    if (orders.AMBER && state.scenario.amberSupport !== "none") {
      state.status.BLUE.intel = clamp(state.status.BLUE.intel + (orders.AMBER.action === "提供ISR支援" ? 4 : 1));
      state.status.BLUE.sustainment = clamp(state.status.BLUE.sustainment + (orders.AMBER.action === "提升後勤準備" ? 4 : 0.8));
    }

    const outcome = balance > 12 ? "藍方在本回合取得較佳態勢，但仍須保存資源。" :
      balance < -12 ? "紅方施壓取得較明顯效果，藍方需調整部署與資訊判讀。" :
      "本回合態勢膠著，雙方均付出資源與持續性成本。";

    const log = {
      turn: state.currentTurn,
      elapsedHours: (state.currentTurn - 1) * state.scenario.hoursPerTurn,
      event: event ? event.event_name : "無預排事件",
      orders: JSON.parse(JSON.stringify(orders)),
      blueScore: round1(blueScore),
      redScore: round1(redScore),
      amberContribution: round1(amberContribution),
      environment: { avgSea: round1(avgSea), avgVisibility: round1(avgVisibility) },
      outcome,
      statusAfter: JSON.parse(JSON.stringify(state.status)),
      keyRisk: state.status.BLUE.civilianRisk > 65 ? "民事風險升高" :
        state.status.BLUE.sustainment < 50 ? "藍方持續性不足" :
        state.status.BLUE.resources < 30 ? "藍方資源接近下限" :
        state.status.BLUE.intel < 50 ? "情報品質不足" : "需持續監控"
    };
    state.logs.push(log);
    state.currentTurn += 1;
    saveState(false);
    renderSimulation();
    renderAAR();
    toast(state.currentTurn > state.scenario.turns ? "推演完成，可進行課後檢討。" : "本回合已結算。");
    } finally {
      state.turnBusy = false;
      $("resolveTurnBtn").textContent = "結算本回合";
      renderSimulation();
    }
  }

  function renderNarrative() {
    const logs = [...state.logs].reverse();
    $("turnNarrative").innerHTML = logs.length ? logs.map(log => `
      <div class="turn-log">
        <h4>第 ${log.turn} 回合 · T+${log.elapsedHours}h</h4>
        <p><strong>事件：</strong>${escapeHtml(log.event)}</p>
        <p><strong>裁決：</strong>${escapeHtml(log.outcome)}</p>
        <p><strong>關鍵風險：</strong>${escapeHtml(log.keyRisk)}</p>
        <small>藍方準備 ${round1(log.statusAfter.BLUE.readiness)} · 紅方準備 ${round1(log.statusAfter.RED.readiness)} · 民事風險 ${round1(log.statusAfter.BLUE.civilianRisk)}</small>
      </div>`).join("") : `<p class="muted">尚未結算任何回合。</p>`;
  }

  function updateLab() {
    const incoming = Number($("labIncoming").value);
    const shots = Number($("labShots").value);
    const baseP = Number($("labBaseP").value) / 100;
    const detection = Number($("labDetection").value) / 100;
    const readiness = Number($("labReadiness").value) / 100;
    const sea = Number($("labSea").value);
    const jamming = Number($("labJamming").value) / 100;

    $("labBasePValue").value = `${Math.round(baseP * 100)}%`;
    $("labDetectionValue").value = `${Math.round(detection * 100)}%`;
    $("labReadinessValue").value = `${Math.round(readiness * 100)}%`;
    $("labSeaValue").value = sea;
    $("labJammingValue").value = `${Math.round(jamming * 100)}%`;

    const adjusted = Math.min(.95, baseP * (.6 + .4 * detection) * (.75 + .25 * readiness) * (1 - .08 * (sea - 1)) * (1 - .12 * jamming));
    const atLeastOne = 1 - Math.pow(1 - adjusted, shots);
    const residual = Math.max(0, incoming * (1 - atLeastOne));
    const efficiency = atLeastOne / shots;

    $("labResults").innerHTML = `
      <article class="metric blue"><small>修正後單次機率</small><strong>${percent(adjusted)}</strong><small>僅為合成教學值</small></article>
      <article class="metric blue"><small>至少一次成功</small><strong>${percent(atLeastOne)}</strong><small>假設各次近似獨立</small></article>
      <article class="metric neutral"><small>期望剩餘目標</small><strong>${round1(residual)}</strong><small>用於方案比較</small></article>
      <article class="metric amber"><small>每次投入效率</small><strong>${percent(efficiency)}</strong><small>增加投入存在邊際效益遞減</small></article>`;
  }

  function renderAAR() {
    const hasLogs = state.logs.length > 0;
    $("aarEmpty").hidden = hasLogs;
    $("aarContent").hidden = !hasLogs;
    if (!hasLogs) return;

    const last = state.logs[state.logs.length - 1];
    const totalBlueResource = 100 - last.statusAfter.BLUE.resources;
    const totalRedResource = 100 - last.statusAfter.RED.resources;
    const maxRisk = Math.max(...state.logs.map(l => l.statusAfter.BLUE.civilianRisk));
    const lowIntelTurns = state.logs.filter(l => l.statusAfter.BLUE.intel < 55).length;

    $("aarMetrics").innerHTML = `
      <article class="metric blue"><small>藍方最終準備</small><strong>${round1(last.statusAfter.BLUE.readiness)}</strong><small>起始約 ${round1(initialStatus(state.scenario).BLUE.readiness)}</small></article>
      <article class="metric red"><small>紅方最終準備</small><strong>${round1(last.statusAfter.RED.readiness)}</strong><small>資源投入 ${round1(totalRedResource)}</small></article>
      <article class="metric neutral"><small>最高民事風險</small><strong>${round1(maxRisk)}</strong><small>高於65建議列為重大檢討</small></article>
      <article class="metric amber"><small>藍方資源投入</small><strong>${round1(totalBlueResource)}</strong><small>剩餘 ${round1(last.statusAfter.BLUE.resources)}</small></article>`;

    const insights = [];
    const biggestDrop = [...state.logs].sort((a, b) => {
      const pa = a.turn === 1 ? initialStatus(state.scenario).BLUE.readiness : state.logs[a.turn - 2].statusAfter.BLUE.readiness;
      const pb = b.turn === 1 ? initialStatus(state.scenario).BLUE.readiness : state.logs[b.turn - 2].statusAfter.BLUE.readiness;
      return (pb - b.statusAfter.BLUE.readiness) - (pa - a.statusAfter.BLUE.readiness);
    })[0];
    insights.push(`<li><strong>準備度壓力：</strong>第 ${biggestDrop.turn} 回合是藍方準備度下降最明顯的時段。</li>`);
    insights.push(`<li><strong>情報風險：</strong>共有 ${lowIntelTurns} 回合的藍方情報指數低於55，應檢查是否在證據不足時做出高風險決策。</li>`);
    insights.push(`<li><strong>資源管理：</strong>藍方累計投入約 ${round1(totalBlueResource)} 點，最終保留 ${round1(last.statusAfter.BLUE.resources)} 點。</li>`);
    insights.push(`<li><strong>民事影響：</strong>最高民事風險為 ${round1(maxRisk)}；應比較軍事效果與商運、人道、輿情成本。</li>`);
    if (state.scenario.amberSupport !== "none") {
      insights.push(`<li><strong>外部支援：</strong>檢查美軍支援是否被用於補足情報／後勤缺口，而非被當成無限制資源。</li>`);
    }
    $("aarInsights").innerHTML = `<ul class="compact-list">${insights.join("")}</ul>`;

    $("timelineBody").innerHTML = state.logs.map(log => {
      const o = log.orders || {};
      return `<tr>
        <td>${log.turn}<br><small>T+${log.elapsedHours}h</small></td>
        <td>${escapeHtml(log.event)}</td>
        <td>${formatOrder(o.BLUE)}</td>
        <td>${formatOrder(o.RED)}</td>
        <td>${formatOrder(o.AMBER)}</td>
        <td>${escapeHtml(log.outcome)}<br><small>${escapeHtml(log.keyRisk)}</small></td>
      </tr>`;
    }).join("");
  }

  function formatOrder(order) {
    if (!order) return "—";
    return `<strong>${escapeHtml(order.action)}</strong><br><small>${zoneName(order.zone)} · 資源 ${order.resource}</small>`;
  }

  function renderLibrary() {
    const query = $("librarySearch").value.trim().toLowerCase();
    const tab = state.currentLibrary;
    let headers = [];
    let rows = [];
    let rowClass = "";

    if (tab === "sources") {
      headers = ["來源", "發布者", "類別", "存取", "用途", "限制"];
      rows = DATA.publicSources.filter(row => matchesQuery(row, query)).map(row => [
        `<a href="${escapeAttr(row.url)}" target="_blank" rel="noopener">${escapeHtml(row.name)}</a>`,
        escapeHtml(row.publisher), escapeHtml(row.category), escapeHtml(row.access_type),
        escapeHtml(row.suggested_use), escapeHtml(row.limitations)
      ]);
      rowClass = "real-row";
    } else if (tab === "capabilities") {
      headers = ["能力名稱", "角色", "領域", "任務", "感測", "涵蓋", "生存", "持續", "備註"];
      rows = DATA.capabilities.filter(row => matchesQuery(row, query)).map(row => [
        escapeHtml(row.capability_name), actorLabel(row.actor_id), escapeHtml(row.domain), escapeHtml(row.role),
        row.sensor_index, row.reach_index, row.survivability_index, row.sustainment_index, escapeHtml(row.note)
      ]);
      rowClass = "synthetic-row";
    } else if (tab === "forces") {
      headers = ["兵力包", "角色", "領域", "起始區域", "準備", "效果", "生存", "後勤", "指管"];
      rows = DATA.forcePackages.filter(row => matchesQuery(row, query)).map(row => [
        escapeHtml(row.package_name), actorLabel(row.actor_id), escapeHtml(row.domain), zoneName(row.start_zone),
        row.readiness, row.combat_effect, row.survivability, row.sustainment, row.command_quality
      ]);
      rowClass = "synthetic-row";
    } else {
      headers = ["日期", "軍機", "軍艦", "公務船", "越線／進入", "摘要"];
      rows = DATA.publicActivitySample.filter(row => matchesQuery(row, query)).map(row => [
        row.report_date, row.pla_aircraft, row.plan_ships, row.official_ships, row.aircraft_cross_or_enter, escapeHtml(row.summary)
      ]);
      rowClass = "real-row";
    }

    $("libraryContent").innerHTML = `
      <div class="card table-card">
        <div class="table-wrap">
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>${rows.map(row => `<tr class="${rowClass}">${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
        <p class="footnote">共 ${rows.length} 筆。公開來源僅作為背景與來源目錄；合成資料可由教師修改。</p>
      </div>`;
  }

  function matchesQuery(row, query) {
    if (!query) return true;
    return Object.values(row).some(value => String(value ?? "").toLowerCase().includes(query));
  }

  function saveState(showToast = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        scenario: state.scenario,
        currentTurn: state.currentTurn,
        status: state.status,
        orders: state.orders,
        logs: state.logs,
        revealedIntel: state.revealedIntel
      }));
      if (showToast) toast("進度已儲存在此瀏覽器。");
      return true;
    } catch {
      if (showToast) toast("瀏覽器禁止本機儲存；請使用「匯出 JSON」保存進度。");
      return false;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed.scenario) return false;
      Object.assign(state, parsed);
      renderScenario();
      renderSimulation();
      renderAAR();
      return true;
    } catch {
      return false;
    }
  }

  function resetRun() {
    if (!state.scenario) return;
    if (!confirm("確定要清除目前回合紀錄並重新開始嗎？")) return;
    state.currentTurn = 1;
    state.status = initialStatus(state.scenario);
    state.orders = {};
    state.logs = [];
    saveState(false);
    renderSimulation();
    renderAAR();
    toast("推演已重設。");
  }

  function download(name, content, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportJSON() {
    if (!state.scenario) return toast("目前沒有可匯出的想定。");
    const payload = {
      app: "Taiwan Strait Scenario Generator",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      safetyClass: "EDUCATIONAL_SYNTHETIC",
      scenario: state.scenario,
      currentTurn: state.currentTurn,
      status: state.status,
      orders: state.orders,
      logs: state.logs
    };
    download(`${safeFileName(state.scenario.name)}.json`, JSON.stringify(payload, null, 2));
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (!payload.scenario || payload.safetyClass !== "EDUCATIONAL_SYNTHETIC") {
          throw new Error("不是本系統的教育合成資料格式");
        }
        state.scenario = payload.scenario;
        state.currentTurn = payload.currentTurn || 1;
        state.status = payload.status || initialStatus(payload.scenario);
        state.orders = payload.orders || {};
        state.logs = payload.logs || [];
        saveState(false);
        renderScenario();
        renderSimulation();
        renderAAR();
        toast("想定與推演紀錄已匯入。");
      } catch (error) {
        toast(`匯入失敗：${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  function exportCSV() {
    if (!state.logs.length) return toast("尚無回合紀錄。");
    const header = ["turn","elapsed_hours","event","blue_action","red_action","amber_action","blue_readiness","red_readiness","civilian_risk","outcome","key_risk"];
    const lines = [header.join(",")];
    state.logs.forEach(log => {
      const values = [
        log.turn, log.elapsedHours, log.event,
        log.orders.BLUE?.action || "", log.orders.RED?.action || "", log.orders.AMBER?.action || "",
        log.statusAfter.BLUE.readiness, log.statusAfter.RED.readiness, log.statusAfter.BLUE.civilianRisk,
        log.outcome, log.keyRisk
      ];
      lines.push(values.map(csvEscape).join(","));
    });
    download(`${safeFileName(state.scenario.name)}-AAR.csv`, "\ufeff" + lines.join("\n"), "text/csv;charset=utf-8");
  }

  function safeFileName(name) {
    return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function percent(v) {
    return `${Math.round(v * 1000) / 10}%`;
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => setTab(btn.dataset.tab)));
    document.querySelectorAll(".mini-tab").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll(".mini-tab").forEach(b => b.classList.toggle("active", b === btn));
      state.currentLibrary = btn.dataset.library;
      renderLibrary();
    }));

    $("scenarioForm").addEventListener("submit", event => {
      event.preventDefault();
      beginScenario(generateScenario(readScenarioForm()));
    });
    $("apiProvider").addEventListener("change", applyProviderPreset);
    $("generateAiBtn").addEventListener("click", generateScenarioWithAi);
    $("toggleApiKeyBtn").addEventListener("click", () => {
      const reveal = $("apiKey").type === "password";
      $("apiKey").type = reveal ? "text" : "password";
      $("toggleApiKeyBtn").textContent = reveal ? "隱藏 Key" : "顯示 Key";
      $("toggleApiKeyBtn").setAttribute("aria-pressed", String(reveal));
    });
    $("loadDemoBtn").addEventListener("click", () => {
      $("scenarioName").value = "海峽警戒與有限封控：72小時聯合決策演練";
      $("scenarioSeed").value = 20260727;
      $("focus").value = "joint";
      $("difficulty").value = "standard";
      $("turns").value = 12;
      $("hoursPerTurn").value = 6;
      $("uncertainty").value = 3;
      $("civilPressure").value = 3;
      $("amberSupport").value = "indirect";
      $("weatherPreset").value = "variable";
      updateRangeLabels();
      beginScenario(generateScenario(readScenarioForm()));
    });
    $("uncertainty").addEventListener("input", updateRangeLabels);
    $("civilPressure").addEventListener("input", updateRangeLabels);
    $("orderActor").addEventListener("change", updateActionOptions);
    $("orderForm").addEventListener("submit", submitOrder);
    $("redReactionBtn").addEventListener("click", () => generateRedReaction());
    $("autoOrdersBtn").addEventListener("click", () => autoFillOrders());
    $("resolveTurnBtn").addEventListener("click", resolveTurn);
    $("clearRunBtn").addEventListener("click", resetRun);
    $("saveBtn").addEventListener("click", () => saveState(true));
    $("exportBtn").addEventListener("click", exportJSON);
    $("importInput").addEventListener("change", event => importJSON(event.target.files[0]));
    $("exportCsvBtn").addEventListener("click", exportCSV);
    $("printBtn").addEventListener("click", () => window.print());
    $("librarySearch").addEventListener("input", renderLibrary);
    ["labIncoming","labShots","labBaseP","labDetection","labReadiness","labSea","labJamming"]
      .forEach(id => $(id).addEventListener("input", updateLab));
  }

  function updateRangeLabels() {
    $("uncertaintyValue").value = $("uncertainty").value;
    $("civilPressureValue").value = $("civilPressure").value;
  }

  function init() {
    bindEvents();
    updateRangeLabels();
    updateActionOptions();
    renderLibrary();
    if (!loadState()) {
      beginScenario(generateScenario(readScenarioForm()));
    }
  }

  init();
})();
