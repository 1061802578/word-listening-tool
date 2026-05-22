const STORAGE_KEY = "word-listening-tool-state-v1";
const DEFAULT_DEEPSEEK_API_KEY = "";
const DEFAULT_DEEPSEEK_ENDPOINT = "/api/deepseek";
const debugMessages = [];

const state = {
  words: [],
  sets: [],
  imageFile: null,
  imageDataUrl: "",
  deepseekApiKey: DEFAULT_DEEPSEEK_API_KEY,
  deepseekModel: "deepseek-v4-flash",
  deepseekEndpoint: DEFAULT_DEEPSEEK_ENDPOINT,
  languageMode: "auto",
  ocrEngine: "tesseract",
  ocrEnhanceMode: "strong",
  filterPrefix: "",
  config: {
    englishRepeatCount: 3,
    chineseRepeatCount: 1,
    includePhonetic: false,
    speed: 1,
    pauseBetweenItemsMs: 450,
    englishVoiceURI: "",
    chineseVoiceURI: "",
    japaneseVoiceURI: "",
  },
  queue: [],
  playback: {
    currentIndex: 0,
    currentMs: 0,
    totalMs: 0,
    isPlaying: false,
    isPaused: false,
    segmentStartMs: 0,
    segmentStartedAt: 0,
    timerId: null,
  },
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  restoreState();
  bindEvents();
  populateVoices();
  renderAll();
});

function bindElements() {
  [
    "playPauseBtn",
    "playPauseIcon",
    "stopBtn",
    "timeline",
    "currentTime",
    "activeSegment",
    "totalTime",
    "speedSelect",
    "recognitionStatus",
    "dropZone",
    "imageInput",
    "imagePreview",
    "extractBtn",
    "extractMessage",
    "debugLog",
    "rawTextInput",
    "importTextBtn",
    "deepseekOrganizeBtn",
    "languageModeSelect",
    "ocrEngineSelect",
    "ocrEnhanceSelect",
    "deepseekModelSelect",
    "deepseekEndpointInput",
    "englishRepeatInput",
    "chineseRepeatInput",
    "pauseInput",
    "includePhoneticInput",
    "englishVoiceSelect",
    "chineseVoiceSelect",
    "japaneseVoiceSelect",
    "setNameInput",
    "saveSetBtn",
    "setsList",
    "wordCountText",
    "prefixFilterInput",
    "selectAllBtn",
    "invertSelectBtn",
    "deleteSelectedBtn",
    "addWordBtn",
    "wordTableBody",
    "wordRowTemplate",
    "scriptPreview",
    "queueSummary",
    "rebuildQueueBtn",
    "copyScriptBtn",
    "loadDemoBtn",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  bindGlobalDiagnostics();

  els.imageInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) setImageFile(file);
  });

  ["dragenter", "dragover"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dragging");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) setImageFile(file);
  });

  els.extractBtn.addEventListener("click", extractWordsFromImage);
  els.importTextBtn.addEventListener("click", importWordsFromRawText);
  els.deepseekOrganizeBtn.addEventListener("click", organizeWordsWithDeepSeek);

  els.deepseekModelSelect.addEventListener("change", () => {
    state.deepseekModel = els.deepseekModelSelect.value;
    persistState();
  });

  els.languageModeSelect.addEventListener("change", () => {
    state.languageMode = els.languageModeSelect.value;
    persistState();
    rebuildQueue();
  });

  els.ocrEngineSelect.addEventListener("change", () => {
    state.ocrEngine = els.ocrEngineSelect.value;
    persistState();
    renderRecognitionStatus();
  });

  els.ocrEnhanceSelect.addEventListener("change", () => {
    state.ocrEnhanceMode = els.ocrEnhanceSelect.value;
    persistState();
  });

  els.deepseekEndpointInput.addEventListener("input", () => {
    state.deepseekEndpoint = els.deepseekEndpointInput.value.trim() || DEFAULT_DEEPSEEK_ENDPOINT;
    persistState();
  });

  els.wordTableBody.addEventListener("input", handleWordTableInput);
  els.wordTableBody.addEventListener("change", handleWordTableInput);

  els.prefixFilterInput.addEventListener("input", () => {
    state.filterPrefix = normalizeWord(els.prefixFilterInput.value);
    renderWords();
    persistState();
  });

  els.selectAllBtn.addEventListener("click", () => {
    getVisibleWords().forEach((word) => {
      word.selected = true;
    });
    updateAfterWordChange();
  });

  els.invertSelectBtn.addEventListener("click", () => {
    getVisibleWords().forEach((word) => {
      word.selected = !word.selected;
    });
    updateAfterWordChange();
  });

  els.deleteSelectedBtn.addEventListener("click", () => {
    stopPlayback();
    state.words = state.words.filter((word) => !word.selected);
    updateAfterWordChange();
  });

  els.addWordBtn.addEventListener("click", () => {
    state.words.unshift(createWordItem({ word: "", meaning: "", source: "manual", selected: true }));
    renderAll();
    persistState();
    requestAnimationFrame(() => {
      const firstInput = els.wordTableBody.querySelector(".word-input");
      firstInput?.focus();
    });
  });

  els.saveSetBtn.addEventListener("click", saveCurrentSet);
  els.setsList.addEventListener("click", handleSetAction);

  ["englishRepeatInput", "chineseRepeatInput", "pauseInput", "includePhoneticInput"].forEach((id) => {
    els[id].addEventListener("input", () => {
      syncConfigFromControls();
      rebuildQueue();
      persistState();
    });
  });

  els.speedSelect.addEventListener("change", () => {
    state.config.speed = Number(els.speedSelect.value);
    if (state.playback.isPlaying) {
      const targetMs = Number(els.timeline.value) || state.playback.currentMs;
      playFromMs(targetMs);
    }
    rebuildQueue();
    persistState();
  });

  els.englishVoiceSelect.addEventListener("change", () => {
    state.config.englishVoiceURI = els.englishVoiceSelect.value;
    persistState();
  });

  els.chineseVoiceSelect.addEventListener("change", () => {
    state.config.chineseVoiceURI = els.chineseVoiceSelect.value;
    persistState();
  });

  els.japaneseVoiceSelect.addEventListener("change", () => {
    state.config.japaneseVoiceURI = els.japaneseVoiceSelect.value;
    persistState();
  });

  els.rebuildQueueBtn.addEventListener("click", rebuildQueue);
  els.copyScriptBtn.addEventListener("click", copyScript);
  els.loadDemoBtn.addEventListener("click", loadDemoWords);

  els.playPauseBtn.addEventListener("click", togglePlayback);
  els.stopBtn.addEventListener("click", stopPlayback);
  els.timeline.addEventListener("input", () => {
    state.playback.currentMs = Number(els.timeline.value);
    updateTimelineUI();
  });
  els.timeline.addEventListener("change", () => {
    const targetMs = Number(els.timeline.value);
    if (state.playback.isPlaying) playFromMs(targetMs);
    else {
      state.playback.currentMs = targetMs;
      state.playback.currentIndex = findQueueIndexByMs(targetMs);
      renderScriptPreview();
      updateTimelineUI();
    }
  });

  getSpeechSynthesis()?.addEventListener?.("voiceschanged", populateVoices);
  window.addEventListener("beforeunload", () => getSpeechSynthesis()?.cancel());
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.words = Array.isArray(saved.words) ? saved.words : [];
    state.sets = Array.isArray(saved.sets) ? saved.sets : [];
    state.deepseekApiKey = saved.deepseekApiKey || DEFAULT_DEEPSEEK_API_KEY;
    state.deepseekModel = saved.deepseekModel || "deepseek-v4-flash";
    state.deepseekEndpoint = saved.deepseekEndpoint || DEFAULT_DEEPSEEK_ENDPOINT;
    state.languageMode = saved.languageMode || "auto";
    state.ocrEngine = saved.ocrEngine || "tesseract";
    state.ocrEnhanceMode = saved.ocrEnhanceMode || "strong";
    state.filterPrefix = saved.filterPrefix || "";
    state.config = { ...state.config, ...(saved.config || {}) };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  if (!["deepseek-v4-flash", "deepseek-v4-pro"].includes(state.deepseekModel)) {
    state.deepseekModel = "deepseek-v4-flash";
  }
  els.deepseekModelSelect.value = state.deepseekModel;
  els.deepseekEndpointInput.value = state.deepseekEndpoint;
  els.languageModeSelect.value = state.languageMode;
  els.ocrEngineSelect.value = state.ocrEngine;
  els.ocrEnhanceSelect.value = state.ocrEnhanceMode;
  els.prefixFilterInput.value = state.filterPrefix;
  els.englishRepeatInput.value = state.config.englishRepeatCount;
  els.chineseRepeatInput.value = state.config.chineseRepeatCount;
  els.pauseInput.value = state.config.pauseBetweenItemsMs;
  els.includePhoneticInput.checked = state.config.includePhonetic;
  els.speedSelect.value = String(state.config.speed);
}

function persistState() {
  const payload = {
    words: state.words,
    sets: state.sets,
    deepseekApiKey: state.deepseekApiKey,
    deepseekModel: state.deepseekModel,
    deepseekEndpoint: state.deepseekEndpoint,
    languageMode: state.languageMode,
    ocrEngine: state.ocrEngine,
    ocrEnhanceMode: state.ocrEnhanceMode,
    filterPrefix: state.filterPrefix,
    config: state.config,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function renderAll() {
  renderRecognitionStatus();
  renderWords();
  renderSets();
  rebuildQueue();
}

function renderRecognitionStatus() {
  if (!getSpeechSynthesis()) {
    logDebug("当前浏览器不支持 speechSynthesis，朗读功能会受限，但 OCR 可继续使用。");
  }
  if (state.ocrEngine === "tesseract" && "Tesseract" in window) {
    els.recognitionStatus.textContent = "Tesseract";
    els.recognitionStatus.className = "status-chip ready";
  } else if (state.ocrEngine === "browser" && "TextDetector" in window) {
    els.recognitionStatus.textContent = "自带可用";
    els.recognitionStatus.className = "status-chip ready";
  } else if ("Tesseract" in window) {
    els.recognitionStatus.textContent = "Tesseract";
    els.recognitionStatus.className = "status-chip ready";
  } else if ("TextDetector" in window) {
    els.recognitionStatus.textContent = "自带可用";
    els.recognitionStatus.className = "status-chip ready";
  } else {
    els.recognitionStatus.textContent = "需粘贴";
    els.recognitionStatus.className = "status-chip";
  }
}

function renderWords() {
  const visibleWords = getVisibleWords();
  els.wordTableBody.innerHTML = "";
  els.wordCountText.textContent = `${state.words.length} 个词条，当前显示 ${visibleWords.length} 个`;

  if (!state.words.length) {
    els.wordTableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">还没有词条。可以先上传图片识别，或手动新增。</div></td></tr>`;
    return;
  }

  visibleWords.forEach((word) => {
    const row = els.wordRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = word.id;
    row.classList.toggle("low-confidence", Number(word.confidence || 1) < 0.75);
    row.classList.toggle("active", state.queue[state.playback.currentIndex]?.wordId === word.id && state.playback.isPlaying);
    row.querySelector(".word-selected").checked = word.selected;
    row.querySelector(".word-input").value = word.word;
    row.querySelector(".phonetic-input").value = word.phonetic || "";
    row.querySelector(".meaning-input").value = word.meaning || "";
    const sourceText = word.confidence ? `${formatSource(word.source)} ${Math.round(word.confidence * 100)}%` : formatSource(word.source);
    row.querySelector(".source-pill").textContent = sourceText;
    els.wordTableBody.appendChild(row);
  });
}

function renderSets() {
  if (!state.sets.length) {
    els.setsList.innerHTML = `<div class="empty-state">保存后的词条集合会显示在这里。</div>`;
    return;
  }

  els.setsList.innerHTML = state.sets
    .map(
      (set) => `
        <div class="set-item" data-id="${escapeHtml(set.id)}">
          <div>
            <div class="set-title">${escapeHtml(set.name)}</div>
            <div class="set-meta">${set.words.length} 个词 · ${formatDate(set.updatedAt)}</div>
          </div>
          <button class="button small" data-action="load" type="button">载入</button>
          <button class="button small danger" data-action="delete" type="button">删除</button>
        </div>
      `
    )
    .join("");
}

function renderScriptPreview() {
  if (!state.queue.length) {
    els.scriptPreview.innerHTML = `<div class="empty-state">选择词条后，这里会生成类似 example / example / example / 例子的朗读稿。</div>`;
    els.queueSummary.textContent = "选择词条后自动生成";
    return;
  }

  const selectedCount = state.words.filter((word) => word.selected).length;
  els.queueSummary.textContent = `${selectedCount} 个选中词条，${state.queue.length} 条朗读片段`;
  els.scriptPreview.innerHTML = state.queue
    .map((item, index) => {
      const active = index === state.playback.currentIndex && state.playback.isPlaying ? " active" : "";
      return `
        <div class="script-line${active}" data-index="${index}">
          <span class="script-index">${index + 1}</span>
          <span class="script-text">${escapeHtml(item.text)}</span>
          <span class="script-type">${item.typeLabel}</span>
        </div>
      `;
    })
    .join("");
}

function renderPlaybackState() {
  els.playPauseIcon.textContent = state.playback.isPlaying && !state.playback.isPaused ? "Ⅱ" : "▶";
  els.playPauseBtn.setAttribute("aria-label", state.playback.isPlaying ? "暂停" : "播放");
  renderWords();
  renderScriptPreview();
  updateTimelineUI();
}

function updateTimelineUI() {
  els.timeline.max = String(Math.max(0, state.playback.totalMs));
  els.timeline.value = String(Math.min(state.playback.currentMs, state.playback.totalMs));
  els.currentTime.textContent = formatTime(state.playback.currentMs);
  els.totalTime.textContent = formatTime(state.playback.totalMs);
  const item = state.queue[state.playback.currentIndex];
  els.activeSegment.textContent = item ? `${item.typeLabel}: ${item.text}` : "等待生成朗读队列";
}

function getVisibleWords() {
  if (!state.filterPrefix) return state.words;
  return state.words.filter((word) => normalizeWord(word.word).startsWith(state.filterPrefix));
}

function handleWordTableInput(event) {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const word = state.words.find((item) => item.id === row.dataset.id);
  if (!word) return;

  if (event.target.classList.contains("word-selected")) word.selected = event.target.checked;
  if (event.target.classList.contains("word-input")) word.word = event.target.value.trim();
  if (event.target.classList.contains("phonetic-input")) word.phonetic = event.target.value.trim();
  if (event.target.classList.contains("meaning-input")) word.meaning = event.target.value.trim();
  word.source = "manual";

  updateAfterWordChange();
}

function updateAfterWordChange() {
  rebuildQueue();
  renderWords();
  persistState();
}

async function setImageFile(file) {
  state.imageFile = file;
  logDebug(`已选择图片：${file.name || "未命名"}，${Math.round(file.size / 1024)}KB，${file.type || "未知类型"}`);
  state.imageDataUrl = await fileToDataUrl(file);
  els.imagePreview.src = state.imageDataUrl;
  els.imagePreview.hidden = false;
  els.extractMessage.textContent = `已选择：${file.name}`;
}

async function extractWordsFromImage() {
  logDebug("点击识别按钮");
  if (!state.imageFile) {
    setMessage("请先选择一张图片。", "error");
    return;
  }

  if (window.__tesseractLoadError) {
    logDebug("Tesseract CDN 加载失败");
  }

  if (!getAvailableOcrEngines().length) {
    setMessage("当前浏览器没有加载到可用 OCR。请刷新页面；若仍失败，可能是手机网络无法加载 Tesseract CDN。", "error");
    renderRecognitionStatus();
    return;
  }

  stopPlayback();
  els.extractBtn.disabled = true;
  setMessage("正在识别图片文字...");

  try {
    const detectedText = await detectTextFromImage(state.imageFile);
    els.rawTextInput.value = detectedText;
    setMessage("图片文字已识别到文本框。文本乱时建议直接点 DeepSeek 整理导入，避免 OCR 猜错的词条混入列表。");
  } catch (error) {
    console.error(error);
    setMessage(`识别失败：${error.message || "可以先用系统 OCR 识别后粘贴导入。"}`, "error");
  } finally {
    els.extractBtn.disabled = false;
  }
}

async function detectTextFromImage(file) {
  logDebug(`识别引擎：${state.ocrEngine}`);

  if (state.ocrEngine === "browser") {
    if (!("TextDetector" in window)) {
      throw new Error("当前浏览器没有开放自带文字识别。请切换到 Tesseract 完整识别。");
    }
    setMessage("正在用浏览器自带识别...");
    return detectTextWithBrowser(file);
  }

  if (state.ocrEngine === "tesseract") {
    if (!("Tesseract" in window)) {
      throw new Error("Tesseract 没有加载成功。请刷新页面，或检查手机网络是否能访问 cdnjs。");
    }
    return detectTextWithTesseract(file, state.languageMode);
  }

  if ("Tesseract" in window) {
    return detectTextWithTesseract(file, state.languageMode);
  }

  if ("TextDetector" in window) {
    setMessage("Tesseract 不可用，正在用浏览器自带识别...");
    return detectTextWithBrowser(file);
  }

  throw new Error("没有可用的本地 OCR。");
}

function getAvailableOcrEngines() {
  const engines = [];
  if ("Tesseract" in window) engines.push("tesseract");
  if ("TextDetector" in window) engines.push("browser");
  return engines;
}

async function detectTextWithBrowser(file) {
  const Detector = window.TextDetector;
  const detector = new Detector();
  const bitmap = await decodeImageBitmap(file);
  const results = await detector.detect(bitmap.image || bitmap);
  bitmap.close?.();
  const text = results
    .map((item) => item.rawValue || item.detectedText || item.text || "")
    .filter(Boolean)
    .join("\n");
  if (!text.trim()) throw new Error("浏览器没有从图片中检测到文字。");
  return text;
}

async function detectTextWithTesseract(file, languageMode = "auto") {
  setMessage("正在用 Tesseract 识别，手机上可能需要几十秒...");
  const ocrLanguage = languageMode === "ja" ? "jpn" : languageMode === "en" ? "eng" : "eng+jpn";
  const logger = (message) => {
    if (message.status === "recognizing text") {
      const percent = Math.round((message.progress || 0) * 100);
      setMessage(`正在用 Tesseract 识别：${percent}%`);
    } else if (message.status) {
      setMessage(`Tesseract：${message.status}`);
    }
  };

  const result = state.ocrEnhanceMode === "strong"
    ? await recognizeWithOriginalAndEnhanced(file, ocrLanguage, logger)
    : await runTesseract(file, ocrLanguage, logger);

  const text = result?.data?.text || "";
  if (!text.trim()) throw new Error("Tesseract 没有识别到文字。");
  return text;
}

async function recognizeWithOriginalAndEnhanced(file, ocrLanguage, logger) {
  setMessage("正在用原图识别...");
  const originalResult = await runTesseract(file, ocrLanguage, logger);
  const originalText = originalResult?.data?.text || "";
  logDebug(`原图 OCR 字符数：${originalText.length}`);

  try {
    const enhancedImage = await enhanceImageForOcr(file);
    setMessage("正在用增强图识别...");
    const enhancedResult = await runTesseract(enhancedImage, ocrLanguage, logger);
    const enhancedText = enhancedResult?.data?.text || "";
    logDebug(`增强图 OCR 字符数：${enhancedText.length}`);

    if (enhancedText.length > originalText.length * 1.15) {
      return enhancedResult;
    }
    if (originalText.length > enhancedText.length * 1.15) {
      return originalResult;
    }

    return {
      data: {
        text: mergeOcrText(originalText, enhancedText),
      },
    };
  } catch (error) {
    logDebug(`增强识别失败，保留原图结果：${error.message || error}`);
    return originalResult;
  }
}

function mergeOcrText(first, second) {
  const seen = new Set();
  return [first, second]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      const key = line.replace(/\s+/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

async function runTesseract(imageSource, ocrLanguage, logger) {
  if (typeof Tesseract.createWorker === "function") {
    const worker = await Tesseract.createWorker(ocrLanguage, 1, { logger });
    if (typeof worker.setParameters === "function") {
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      });
    }
    const result = await worker.recognize(imageSource);
    await worker.terminate();
    return result;
  }

  if (typeof Tesseract.recognize === "function") {
    return Tesseract.recognize(imageSource, ocrLanguage, {
      logger,
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });
  }

  throw new Error("Tesseract 加载成功，但没有可用识别方法。");
}

async function enhanceImageForOcr(file) {
  setMessage("正在增强图片：放大、提对比、二值化...");
  const bitmap = await decodeImageBitmap(file);
  const maxSide = 2800;
  const baseScale = Math.max(2, Math.min(3, 1800 / Math.max(bitmap.width, bitmap.height)));
  const scale = Math.min(baseScale, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap.image || bitmap, 0, 0, width, height);
  bitmap.close?.();

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    total += gray;
  }
  const average = total / (data.length / 4);
  const threshold = Math.max(135, Math.min(205, average - 18));

  for (let i = 0; i < data.length; i += 4) {
    let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    gray = (gray - 128) * 1.45 + 128;
    const value = gray < threshold ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

async function decodeImageBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch (error) {
      logDebug(`createImageBitmap 失败：${error.message || error}`);
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => {},
        image,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("手机浏览器无法解码这张图片。请换成截图、JPG 或 PNG 后再试。"));
    };
    image.src = url;
  });
}

function importWordsFromRawText() {
  const text = els.rawTextInput.value.trim();
  if (!text) {
    setMessage("请先粘贴一段包含英语或日语词条的文字。", "error");
    return;
  }
  stopPlayback();
  const words = parseWordsFromText(text, "manual", state.languageMode);
  if (!words.length) {
    setMessage("文本里没有找到有效词条。", "error");
    return;
  }
  mergeWords(words);
  setMessage(`导入完成：新增/更新 ${words.length} 个词条。`);
  renderAll();
  persistState();
}

async function organizeWordsWithDeepSeek() {
  const text = els.rawTextInput.value.trim();
  if (!text) {
    setMessage("请先粘贴或识别出一段文字。", "error");
    return;
  }
  if (!state.deepseekApiKey && isExternalDeepSeekEndpoint(state.deepseekEndpoint)) {
    setMessage("直连 DeepSeek 时需要前端 API Key；部署版建议接口地址保持 /api/deepseek。", "error");
    return;
  }

  stopPlayback();
  els.deepseekOrganizeBtn.disabled = true;
  els.importTextBtn.disabled = true;
  setMessage("正在让 DeepSeek 整理词表、补中文释义和读音...");

  try {
    const words = await callDeepSeekOrganizer(text);
    if (!words.length) {
      setMessage("DeepSeek 没有整理出有效词条，可以先试普通导入。", "error");
      return;
    }
    state.words = state.words.filter((word) => word.source !== "ocr");
    mergeWords(words);
    setMessage(`DeepSeek 整理完成：新增/更新 ${words.length} 个词条。`);
    renderAll();
    persistState();
  } catch (error) {
    console.error(error);
    setMessage(`DeepSeek 整理失败：${error.message || "请检查 API Key、模型或网络连接。"}`, "error");
  } finally {
    els.deepseekOrganizeBtn.disabled = false;
    els.importTextBtn.disabled = false;
  }
}

async function callDeepSeekOrganizer(text) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (state.deepseekApiKey) {
    headers.Authorization = `Bearer ${state.deepseekApiKey}`;
  }

  const response = await fetch(state.deepseekEndpoint || "https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: state.deepseekModel,
      thinking: { type: "disabled" },
      messages: [
        {
          role: "system",
          content:
            "你是一个多语言词表整理助手，支持英语和日语。你必须只返回 JSON，不要 Markdown，不要解释。JSON 形状必须是 {\"words\":[{\"term\":\"example\",\"reading\":\"/ɪɡˈzɑːmpəl/\",\"meaning\":\"例子\",\"language\":\"en\",\"confidence\":0.95}]}。",
        },
        {
          role: "user",
          content: [
            `语言模式：${formatLanguageInstruction(state.languageMode)}`,
            "请从下面 OCR 或手动粘贴文本中提取适合背诵的词条，整理成 JSON。",
            "要求：",
            "1. 英语提取英文单词/短语，term 放单词，reading 放音标，meaning 放中文释义，language 放 en。",
            "2. 日语提取日语词条，term 放汉字/假名原词，reading 放假名读音，meaning 放中文释义，language 放 ja。",
            "3. 音标、假名读音、中文释义、页码、题号、标题、班级姓名、乱码不能作为独立词条。",
            "4. 如果原文有释义，优先使用原文释义；没有释义时补一个简洁自然的中文释义。",
            "5. 英语单词尽量用词典原形；日语动词尽量用辞书形。",
            "6. 日语 OCR 中常见的圈号、词性标记、假名注音、换行错位要合并到同一个词条，不要单独输出。",
            "7. 明显 OCR 错字、残片、单个假名、符号串、意义不明的拉丁字母片段不要输出。",
            "8. confidence 用 0 到 1 表示你对该条整理结果的把握。",
            "",
            "OCR 文本：",
            text,
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `HTTP ${response.status}`);
  }

  const content = payload.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new Error("DeepSeek 没有返回内容。");
  const parsed = parseJsonLoose(content);
  return cleanStructuredWords(parsed.words || [], "deepseek");
}

function parseJsonLoose(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("模型返回内容不是有效 JSON。");
  }
}

function cleanStructuredWords(words, source) {
  const seen = new Set();
  return words
    .map((item) => ({
      word: String(item.term || item.word || "").trim(),
      phonetic: String(item.reading || item.phonetic || "").trim(),
      meaning: String(item.meaning || "").trim(),
      language: normalizeLanguage(item.language),
      confidence: Number(item.confidence || 0.9),
      source,
      selected: true,
    }))
    .filter((item) => {
      const normalized = normalizeWord(item.word);
      const valid = isValidTerm(item.word, item.language) && !isLikelyNoise(normalized);
      if (!valid || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map(createWordItem);
}

function parseWordsFromText(text, source, languageMode = "auto") {
  const seen = new Set();
  const rows = String(text)
    .split(/\r?\n|[;；]/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = [];

  rows.forEach((line) => {
    const strippedLine = stripReadings(line);
    const meaningText = extractMeaning(line, languageMode);
    const japaneseReading = extractJapaneseReading(line);

    if (languageMode !== "en") {
      const japaneseMatches = strippedLine.match(/[\u3040-\u30ff\u3400-\u9fff々ー]{2,}/g) || [];
      japaneseMatches.forEach((match) => {
        if (/^[\u4e00-\u9fa5，,、；;（）() ]+$/.test(match)) return;
        candidates.push({
          word: match.trim(),
          phonetic: japaneseReading,
          meaning: meaningText,
          language: "ja",
          confidence: source === "ocr" ? 0.78 : undefined,
          source,
          selected: true,
        });
      });
    }

    if (languageMode !== "ja") {
      const englishMatches = strippedLine.match(/[A-Za-z][A-Za-z'’-]{1,}(?:\s+[A-Za-z][A-Za-z'’-]{1,})?/g) || [];
      englishMatches.forEach((match) => {
        const word = match.replace(/[’]/g, "'").trim();
        candidates.push({
          word,
          phonetic: "",
          meaning: meaningText,
          language: "en",
          confidence: source === "ocr" ? 0.82 : undefined,
          source,
          selected: true,
        });
      });
    }
  });

  if (!candidates.length) {
    const cleanText = stripReadings(text);
    const matches = languageMode === "ja"
      ? cleanText.match(/[\u3040-\u30ff\u3400-\u9fff々ー]{2,}/g) || []
      : cleanText.match(/[A-Za-z][A-Za-z'’-]{1,}/g) || [];
    matches.forEach((match) => {
      candidates.push({
        word: match.replace(/[’]/g, "'").trim(),
        phonetic: "",
        meaning: "",
        language: languageMode === "ja" ? "ja" : "en",
        confidence: source === "ocr" ? 0.75 : undefined,
        source,
        selected: true,
      });
    });
  }

  return candidates
    .filter((item) => {
      const normalized = normalizeWord(item.word);
      const valid = isValidTerm(item.word, item.language) && !isLikelyNoise(normalized);
      if (!valid || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map(createWordItem);
}

function mergeWords(newWords) {
  newWords.forEach((incoming) => {
    const normalized = normalizeWord(incoming.word);
    const existing = state.words.find((word) => normalizeWord(word.word) === normalized);
    if (existing) {
      existing.meaning = incoming.meaning || existing.meaning;
      existing.phonetic = incoming.phonetic || existing.phonetic;
      existing.language = incoming.language || existing.language;
      existing.confidence = Math.max(Number(existing.confidence || 0), Number(incoming.confidence || 0));
      existing.selected = true;
      existing.source = incoming.source || existing.source;
    } else {
      state.words.push(incoming);
    }
  });
}

function createWordItem(input) {
  return {
    id: input.id || crypto.randomUUID(),
    word: input.word || "",
    phonetic: input.phonetic || "",
    meaning: input.meaning || "",
    language: input.language || inferLanguage(input.word),
    selected: input.selected ?? true,
    source: input.source || "manual",
    confidence: input.confidence,
  };
}

function syncConfigFromControls() {
  state.config.englishRepeatCount = clampInt(els.englishRepeatInput.value, 1, 10, 3);
  state.config.chineseRepeatCount = clampInt(els.chineseRepeatInput.value, 0, 5, 1);
  state.config.pauseBetweenItemsMs = clampInt(els.pauseInput.value, 0, 5000, 450);
  state.config.includePhonetic = els.includePhoneticInput.checked;
  state.config.speed = Number(els.speedSelect.value) || 1;
}

function rebuildQueue() {
  const previousIndex = state.playback.currentIndex;
  const selectedWords = state.words.filter((word) => word.selected && word.word.trim());
  const queue = [];

  selectedWords.forEach((word) => {
    for (let i = 0; i < state.config.englishRepeatCount; i += 1) {
      queue.push(createQueueItem(word, word.word, getSpeechLang(word), getTermLabel(word)));
    }
    if (state.config.includePhonetic && word.phonetic) {
      queue.push(createQueueItem(word, word.phonetic, word.language === "ja" ? "ja-JP" : "zh-CN", "读音"));
    }
    for (let i = 0; i < state.config.chineseRepeatCount; i += 1) {
      if (word.meaning) queue.push(createQueueItem(word, word.meaning, "zh-CN", "中文"));
    }
  });

  let startMs = 0;
  queue.forEach((item) => {
    item.startMs = startMs;
    item.durationMs = estimateDuration(item);
    startMs += item.durationMs;
  });

  state.queue = queue;
  state.playback.totalMs = startMs;
  state.playback.currentIndex = Math.min(previousIndex, Math.max(0, queue.length - 1));
  state.playback.currentMs = Math.min(state.playback.currentMs, state.playback.totalMs);
  renderScriptPreview();
  updateTimelineUI();
}

function createQueueItem(word, text, lang, typeLabel) {
  return {
    wordId: word.id,
    text: String(text || "").trim(),
    lang,
    typeLabel,
    startMs: 0,
    durationMs: 0,
  };
}

function estimateDuration(item) {
  const baseSeconds = item.lang.startsWith("en")
    ? Math.max(0.85, item.text.length / 7)
    : item.lang.startsWith("ja")
      ? Math.max(0.9, item.text.length / 4)
    : Math.max(0.9, item.text.length / 3.5);
  return Math.round((baseSeconds / state.config.speed) * 1000 + state.config.pauseBetweenItemsMs);
}

function togglePlayback() {
  if (!state.queue.length) rebuildQueue();
  if (!state.queue.length) {
    setMessage("请先选择至少一个词条。", "error");
    return;
  }

  if (state.playback.isPlaying && !state.playback.isPaused) {
    pausePlayback();
    return;
  }

  if (state.playback.isPaused) {
    resumePlayback();
    return;
  }

  playFromMs(state.playback.currentMs || 0);
}

function playFromMs(ms) {
  const speech = getSpeechSynthesis();
  if (!speech) {
    setMessage("当前浏览器不支持系统朗读，可以复制语音稿后换浏览器播放。", "error");
    return;
  }
  speech.cancel();
  clearPlaybackTimer();

  const index = findQueueIndexByMs(ms);
  state.playback.currentIndex = index;
  state.playback.currentMs = Math.min(ms, state.playback.totalMs);
  state.playback.isPlaying = true;
  state.playback.isPaused = false;
  playCurrentSegment();
}

function playCurrentSegment() {
  const speech = getSpeechSynthesis();
  if (!speech) {
    stopPlayback(false);
    setMessage("当前浏览器不支持系统朗读，可以复制语音稿后换浏览器播放。", "error");
    return;
  }
  const item = state.queue[state.playback.currentIndex];
  if (!item) {
    stopPlayback(false);
    return;
  }

  state.playback.segmentStartMs = item.startMs;
  state.playback.currentMs = item.startMs;
  state.playback.segmentStartedAt = performance.now();

  const utterance = new SpeechSynthesisUtterance(item.text);
  utterance.lang = item.lang;
  utterance.rate = state.config.speed;
  utterance.voice = getSelectedVoice(item.lang);
  utterance.onend = () => {
    if (!state.playback.isPlaying || state.playback.isPaused) return;
    window.setTimeout(() => {
      state.playback.currentIndex += 1;
      playCurrentSegment();
    }, state.config.pauseBetweenItemsMs);
  };
  utterance.onerror = () => {
    state.playback.currentIndex += 1;
    playCurrentSegment();
  };

  speech.speak(utterance);
  startPlaybackTimer();
  renderPlaybackState();
}

function pausePlayback() {
  getSpeechSynthesis()?.pause();
  state.playback.isPaused = true;
  clearPlaybackTimer();
  renderPlaybackState();
}

function resumePlayback() {
  getSpeechSynthesis()?.resume();
  state.playback.isPaused = false;
  state.playback.segmentStartedAt = performance.now() - (state.playback.currentMs - state.playback.segmentStartMs);
  startPlaybackTimer();
  renderPlaybackState();
}

function stopPlayback(resetPosition = true) {
  getSpeechSynthesis()?.cancel();
  clearPlaybackTimer();
  state.playback.isPlaying = false;
  state.playback.isPaused = false;
  state.playback.currentIndex = 0;
  if (resetPosition) state.playback.currentMs = 0;
  renderPlaybackState();
}

function startPlaybackTimer() {
  clearPlaybackTimer();
  state.playback.timerId = window.setInterval(() => {
    const item = state.queue[state.playback.currentIndex];
    if (!item) return;
    const elapsed = performance.now() - state.playback.segmentStartedAt;
    state.playback.currentMs = Math.min(item.startMs + elapsed, item.startMs + item.durationMs, state.playback.totalMs);
    updateTimelineUI();
  }, 120);
}

function clearPlaybackTimer() {
  if (state.playback.timerId) {
    window.clearInterval(state.playback.timerId);
    state.playback.timerId = null;
  }
}

function findQueueIndexByMs(ms) {
  if (!state.queue.length) return 0;
  const index = state.queue.findIndex((item) => ms >= item.startMs && ms < item.startMs + item.durationMs);
  return index === -1 ? Math.max(0, state.queue.length - 1) : index;
}

function saveCurrentSet() {
  const name = els.setNameInput.value.trim() || `词条集合 ${state.sets.length + 1}`;
  const visible = getVisibleWords();
  const selectedVisible = visible.filter((word) => word.selected);
  const wordsToSave = (selectedVisible.length ? selectedVisible : visible).map((word) => ({ ...word }));
  if (!wordsToSave.length) return;

  const now = new Date().toISOString();
  const set = {
    id: crypto.randomUUID(),
    name,
    words: wordsToSave,
    createdAt: now,
    updatedAt: now,
  };
  state.sets.unshift(set);
  els.setNameInput.value = "";
  renderSets();
  persistState();
}

function handleSetAction(event) {
  const button = event.target.closest("button[data-action]");
  const item = event.target.closest(".set-item");
  if (!button || !item) return;
  const set = state.sets.find((entry) => entry.id === item.dataset.id);
  if (!set) return;

  if (button.dataset.action === "load") {
    stopPlayback();
    state.words = set.words.map((word) => createWordItem({ ...word, id: crypto.randomUUID() }));
    renderAll();
    persistState();
  }

  if (button.dataset.action === "delete") {
    state.sets = state.sets.filter((entry) => entry.id !== set.id);
    renderSets();
    persistState();
  }
}

async function copyScript() {
  const text = state.queue.map((item) => item.text).join("\n");
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyScriptBtn.textContent = "已复制";
  window.setTimeout(() => {
    els.copyScriptBtn.textContent = "复制语音稿";
  }, 1200);
}

function loadDemoWords() {
  stopPlayback();
  state.words = [
    createWordItem({ word: "achieve", phonetic: "/əˈtʃiːv/", meaning: "实现，达到", language: "en", source: "manual", selected: true }),
    createWordItem({ word: "benefit", phonetic: "/ˈbenɪfɪt/", meaning: "好处，受益", language: "en", source: "manual", selected: true }),
    createWordItem({ word: "concentrate", phonetic: "/ˈkɒnsntreɪt/", meaning: "集中注意力", language: "en", source: "manual", selected: true }),
    createWordItem({ word: "食べる", phonetic: "たべる", meaning: "吃", language: "ja", source: "manual", selected: true }),
    createWordItem({ word: "静か", phonetic: "しずか", meaning: "安静的", language: "ja", source: "manual", selected: true }),
  ];
  renderAll();
  persistState();
}

function populateVoices() {
  const voices = getSpeechSynthesis()?.getVoices?.() || [];
  populateVoiceSelect(els.englishVoiceSelect, voices, "en", state.config.englishVoiceURI);
  populateVoiceSelect(els.chineseVoiceSelect, voices, "zh", state.config.chineseVoiceURI);
  populateVoiceSelect(els.japaneseVoiceSelect, voices, "ja", state.config.japaneseVoiceURI);
}

function populateVoiceSelect(select, voices, langPrefix, selectedURI) {
  const filtered = voices.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
  const options = filtered.length ? filtered : voices;
  select.innerHTML = [
    `<option value="">浏览器默认</option>`,
    ...options.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}">${escapeHtml(voice.name)} · ${escapeHtml(voice.lang)}</option>`),
  ].join("");
  select.value = selectedURI || "";
}

function getSelectedVoice(lang) {
  const voices = getSpeechSynthesis()?.getVoices?.() || [];
  if (lang.startsWith("ja")) {
    const japaneseUri = state.config.japaneseVoiceURI;
    if (japaneseUri) return voices.find((voice) => voice.voiceURI === japaneseUri) || null;
    return voices.find((voice) => voice.lang.toLowerCase().startsWith("ja")) || null;
  }
  const uri = lang.startsWith("en") ? state.config.englishVoiceURI : state.config.chineseVoiceURI;
  if (uri) return voices.find((voice) => voice.voiceURI === uri) || null;
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2))) || null;
}

function setMessage(text, type = "info") {
  els.extractMessage.textContent = text;
  els.recognitionStatus.classList.toggle("error", type === "error");
}

function getSpeechSynthesis() {
  return window.speechSynthesis || null;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()[\]{}（）【】「」『』/\\]/g, "")
    .replace(/[^A-Za-z\u3040-\u30ff\u3400-\u9fff々ー'-]/g, "");
}

function isLikelyNoise(value) {
  const noise = new Set(["unit", "page", "lesson", "word", "words", "name", "class", "date", "score", "ɪ", "ə", "ɑ", "ɔ", "ʃ", "ʒ", "θ", "ð"]);
  return noise.has(value);
}

function stripReadings(text) {
  return String(text || "")
    .replace(/\/[^/\n]{1,80}\//g, " ")
    .replace(/\[[^\]\n]{1,80}\]/g, " ")
    .replace(/（[ぁ-んァ-ンー\s]+）/g, " ")
    .replace(/\([ぁ-んァ-ンー\s]+\)/g, " ");
}

function extractMeaning(line, languageMode) {
  const text = String(line || "");
  let cleaned = stripReadings(text);
  cleaned = cleaned.replace(/[A-Za-z][A-Za-z'’-]{1,}(?:\s+[A-Za-z][A-Za-z'’-]{1,})?/g, " ");
  if (languageMode !== "en") {
    cleaned = cleaned.replace(/[\u3040-\u30ff々ー]{1,}/g, " ");
    cleaned = cleaned.replace(/[\u3400-\u9fff]{1,6}[ぁ-んァ-ンー]*/g, " ");
  }
  const matches = cleaned.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5，,、；;（）() ]*/g) || [];
  return matches
    .map((value) => value.replace(/[，,、；;（）() ]+$/g, "").trim())
    .filter((value) => value.length >= 1)
    .join("，");
}

function extractJapaneseReading(text) {
  const match = String(text || "").match(/[（(]([ぁ-んァ-ンー\s]+)[）)]/);
  return match ? match[1].trim() : "";
}

function isValidTerm(term, language) {
  const value = String(term || "").trim();
  if (!value || value.length > 60) return false;
  if (/^\/.*\/$/.test(value) || /^\[.*\]$/.test(value)) return false;
  if (language === "ja") return /[\u3040-\u30ff\u3400-\u9fff々ー]/.test(value);
  if (language === "en") return /^[a-z][a-z.' -]{1,58}$/i.test(value);
  return /[a-z\u3040-\u30ff\u3400-\u9fff々ー]/i.test(value);
}

function inferLanguage(term) {
  return /[\u3040-\u30ff\u3400-\u9fff々ー]/.test(String(term || "")) ? "ja" : "en";
}

function normalizeLanguage(value) {
  const text = String(value || "").toLowerCase();
  if (text.startsWith("ja") || text.includes("日")) return "ja";
  if (text.startsWith("en") || text.includes("英")) return "en";
  return "";
}

function getSpeechLang(word) {
  return word.language === "ja" ? "ja-JP" : "en-US";
}

function getTermLabel(word) {
  return word.language === "ja" ? "日语" : "英文";
}

function formatLanguageInstruction(mode) {
  if (mode === "en") return "只整理英语词条";
  if (mode === "ja") return "只整理日语词条";
  return "自动判断英语和日语，二者都可以整理";
}

function isExternalDeepSeekEndpoint(endpoint) {
  return /^https?:\/\/api\.deepseek\.com/i.test(String(endpoint || ""));
}

function formatSource(source) {
  const labels = {
    browser: "浏览器",
    ocr: "OCR",
    deepseek: "DeepSeek",
    dictionary: "词典",
    manual: "手动",
  };
  return labels[source] || source || "手动";
}

function bindGlobalDiagnostics() {
  window.addEventListener("error", (event) => {
    const message = event.message || event.error?.message || "未知脚本错误";
    logDebug(`脚本错误：${message}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || event.reason || "未知异步错误";
    logDebug(`异步错误：${reason}`);
  });
  if (window.__tesseractLoadError) {
    logDebug("Tesseract 脚本加载失败。手机网络可能无法访问 cdnjs。");
  }
}

function logDebug(message) {
  if (!message) return;
  const text = `[${new Date().toLocaleTimeString()}] ${message}`;
  debugMessages.push(text);
  if (debugMessages.length > 8) debugMessages.shift();
  if (els.debugLog) {
    els.debugLog.hidden = false;
    els.debugLog.textContent = debugMessages.join("\n");
  }
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
