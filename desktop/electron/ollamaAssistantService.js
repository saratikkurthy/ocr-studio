import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import crypto from "crypto";
import { searchManuscriptPassages } from "./manuscriptIndexService.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:3b";

function safeReadJson(filePath, fallback) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : fallback;
  } catch {
    return fallback;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function storagePath(workspacePath) {
  return path.join(workspacePath, ".ocr-studio", "assistant-conversations.json");
}

function settingsPath(workspacePath) {
  return path.join(workspacePath, ".ocr-studio", "assistant-settings.json");
}

function loadStore(workspacePath) {
  const value = safeReadJson(storagePath(workspacePath), { version: 1, conversations: [] });
  return { version: 1, conversations: Array.isArray(value?.conversations) ? value.conversations : [] };
}

function saveStore(workspacePath, store) {
  const target = storagePath(workspacePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, JSON.stringify(store, null, 2), "utf-8");
}

function loadSettings(workspacePath) {
  return {
    endpoint: DEFAULT_ENDPOINT,
    model: DEFAULT_MODEL,
    temperature: 0.2,
    evidenceLimit: 8,
    ...safeReadJson(settingsPath(workspacePath), {}),
  };
}

function saveSettings(workspacePath, settings) {
  const target = settingsPath(workspacePath);
  ensureDir(path.dirname(target));
  const normalized = {
    endpoint: String(settings?.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, ""),
    model: String(settings?.model || DEFAULT_MODEL),
    temperature: Math.min(Math.max(Number(settings?.temperature) || 0, 0), 2),
    evidenceLimit: Math.min(Math.max(Number(settings?.evidenceLimit) || 8, 3), 20),
  };
  fs.writeFileSync(target, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

function requestJson(urlString, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlString); } catch { reject(new Error("Invalid Ollama endpoint.")); return; }
    const transport = url.protocol === "https:" ? https : http;
    const payload = body == null ? null : JSON.stringify(body);
    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: options.method || (payload ? "POST" : "GET"),
      timeout: options.timeout || 120000,
      headers: {
        Accept: "application/json",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    }, (response) => {
      let raw = "";
      response.setEncoding("utf-8");
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        if ((response.statusCode || 500) >= 400) {
          reject(new Error(`Ollama returned HTTP ${response.statusCode}: ${raw.slice(0, 300)}`));
          return;
        }
        try { resolve(raw ? JSON.parse(raw) : {}); }
        catch { reject(new Error("Ollama returned an invalid JSON response.")); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Ollama request timed out.")));
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

const DEFAULT_REQUEST_TIMEOUT_MS = 300000;
const DEFAULT_MAX_EVIDENCE_ITEMS = 4;
const DEFAULT_MAX_EVIDENCE_CHARS = 7000;
const DEFAULT_MAX_SNIPPET_CHARS = 1400;

function compactWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildEvidenceBundle(results, options = {}) {
  const maxItems = Math.min(
    Math.max(Number(options.maxItems) || DEFAULT_MAX_EVIDENCE_ITEMS, 1),
    8
  );
  const maxChars = Math.min(
    Math.max(Number(options.maxChars) || DEFAULT_MAX_EVIDENCE_CHARS, 2000),
    16000
  );
  const maxSnippetChars = Math.min(
    Math.max(Number(options.maxSnippetChars) || DEFAULT_MAX_SNIPPET_CHARS, 400),
    3000
  );

  const selected = [];
  const sections = [];
  let usedChars = 0;

  for (const item of results.slice(0, maxItems)) {
    const citation =
      `[${selected.length + 1}] ${item.projectName} > ${item.documentName} > Page ${item.pageNumber}`;
    const snippet = compactWhitespace(item.snippet).slice(0, maxSnippetChars);
    if (!snippet) continue;

    const section = `${citation}\n${snippet}`;
    const separatorSize = sections.length ? 2 : 0;

    if (sections.length && usedChars + separatorSize + section.length > maxChars) {
      break;
    }

    sections.push(section);
    selected.push(item);
    usedChars += separatorSize + section.length;
  }

  return {
    text: sections.join("\n\n"),
    evidence: selected,
    characterCount: usedChars,
  };
}

function conversationSummary(conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: messages.length,
    lastMessage: messages.at(-1)?.content?.slice(0, 120) || "",
  };
}

function makeTitle(question) {
  const compact = String(question || "New conversation").replace(/\s+/g, " ").trim();
  return compact.length > 58 ? `${compact.slice(0, 58)}…` : compact;
}

export function registerOllamaAssistantIpc(ipcMain) {
  ipcMain.handle("assistant:getSettings", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    return { success: true, settings: loadSettings(workspacePath) };
  });

  ipcMain.handle("assistant:saveSettings", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    if (!workspacePath) return { success: false, message: "Workspace path is required." };
    const settings = saveSettings(workspacePath, data?.settings || {});
    return { success: true, message: "Assistant settings saved.", settings };
  });

  ipcMain.handle("assistant:checkOllama", async (_event, data) => {
    const endpoint = String(data?.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "");
    try {
      const response = await requestJson(`${endpoint}/api/tags`, { timeout: 8000 });
      const models = (response.models || []).map((model) => ({
        name: model.name,
        size: Number(model.size || 0),
        modifiedAt: model.modified_at || null,
      }));
      return { success: true, message: models.length ? `Ollama is ready with ${models.length} local model(s).` : "Ollama is running, but no models are installed.", models };
    } catch (error) {
      return { success: false, message: `Cannot connect to Ollama. ${error instanceof Error ? error.message : String(error)}`, models: [] };
    }
  });

  ipcMain.handle("assistant:listConversations", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    const store = loadStore(workspacePath);
    return { success: true, conversations: store.conversations.map(conversationSummary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) };
  });

  ipcMain.handle("assistant:getConversation", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    const conversationId = String(data?.conversationId || "");
    const conversation = loadStore(workspacePath).conversations.find((item) => item.id === conversationId) || null;
    return { success: Boolean(conversation), conversation };
  });

  ipcMain.handle("assistant:deleteConversation", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    const conversationId = String(data?.conversationId || "");
    const store = loadStore(workspacePath);
    store.conversations = store.conversations.filter((item) => item.id !== conversationId);
    saveStore(workspacePath, store);
    return { success: true, message: "Conversation deleted." };
  });

  ipcMain.handle("assistant:ask", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    const question = String(data?.question || "").trim();
    if (!workspacePath || !question) return { success: false, message: "Workspace and question are required." };

    const settings = { ...loadSettings(workspacePath), ...(data?.settings || {}) };
    const search = searchManuscriptPassages({
      workspacePath,
      collectionId: data?.collectionId ? String(data.collectionId) : null,
      query: question,
      limit: Math.min(Math.max(Number(settings.evidenceLimit) || 8, 3), 20),
    });
    if (!search.success) return search;
    if (!search.results.length) return { success: false, message: "No relevant manuscript evidence was found. Try another question or rebuild the index.", evidence: [] };

    const store = loadStore(workspacePath);
    let conversation = store.conversations.find((item) => item.id === data?.conversationId);
    const now = new Date().toISOString();
    if (!conversation) {
      conversation = { id: crypto.randomUUID(), title: makeTitle(question), createdAt: now, updatedAt: now, messages: [] };
      store.conversations.push(conversation);
    }

    const recentHistory = conversation.messages
      .slice(-4)
      .map((message) => ({
        role: message.role,
        content: compactWhitespace(message.content).slice(0, 1200),
      }));

    const systemPrompt =
      `You are OCR Studio's private manuscript research assistant. ` +
      `Answer only from the supplied manuscript evidence. ` +
      `Cite claims using bracketed source numbers such as [1] or [2]. ` +
      `Never invent a citation. If the evidence is insufficient, say so clearly. ` +
      `Distinguish direct textual evidence from interpretation. ` +
      `Keep original-language terms intact. Give a focused answer followed by a short Sources section.`;

    const requestTimeoutMs = Math.min(
      Math.max(Number(settings.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS, 60000),
      600000
    );

    const askOllama = async (evidenceBundle, history) => {
      const userPrompt =
        `Research question:\n${question}\n\n` +
        `Manuscript evidence:\n${evidenceBundle.text}\n\n` +
        `Compose a grounded answer with inline citations.`;

      const startedAt = Date.now();
      const response = await requestJson(
        `${String(settings.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "")}/api/chat`,
        { timeout: requestTimeoutMs },
        {
          model: settings.model || DEFAULT_MODEL,
          stream: false,
          keep_alive: "10m",
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: userPrompt },
          ],
          options: {
            temperature: Number(settings.temperature ?? 0.2),
            num_ctx: 4096,
            num_predict: 700,
          },
        }
      );

      return {
        answer: String(response?.message?.content || "").trim(),
        elapsedMs: Date.now() - startedAt,
        promptCharacters: userPrompt.length + systemPrompt.length,
      };
    };

    let evidenceBundle = buildEvidenceBundle(search.results);

    if (!evidenceBundle.evidence.length) {
      return {
        success: false,
        message: "Relevant search results were found, but they contained no usable OCR text.",
        evidence: [],
      };
    }

    try {
      let result;

      try {
        result = await askOllama(evidenceBundle, recentHistory);
      } catch (firstError) {
        if (!/timed out/i.test(firstError instanceof Error ? firstError.message : String(firstError))) {
          throw firstError;
        }

        evidenceBundle = buildEvidenceBundle(search.results, {
          maxItems: 2,
          maxChars: 3500,
          maxSnippetChars: 1000,
        });

        result = await askOllama(evidenceBundle, []);
      }

      if (!result.answer) {
        throw new Error("The selected model returned an empty answer.");
      }

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        createdAt: now,
      };

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        createdAt: new Date().toISOString(),
        model: settings.model,
        evidence: evidenceBundle.evidence,
        diagnostics: {
          elapsedMs: result.elapsedMs,
          promptCharacters: result.promptCharacters,
          evidenceCharacters: evidenceBundle.characterCount,
          evidenceCount: evidenceBundle.evidence.length,
          timeoutMs: requestTimeoutMs,
        },
      };

      conversation.messages.push(userMessage, assistantMessage);
      conversation.updatedAt = assistantMessage.createdAt;
      saveStore(workspacePath, store);

      return {
        success: true,
        message:
          `Answered using ${evidenceBundle.evidence.length} cited passage(s) ` +
          `in ${Math.round(result.elapsedMs / 1000)} seconds.`,
        conversationId: conversation.id,
        answer: result.answer,
        evidence: evidenceBundle.evidence,
        diagnostics: assistantMessage.diagnostics,
        conversation,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const timeoutHint = /timed out/i.test(detail)
        ? " The model did not finish within five minutes. Keep Ollama running, retry after the model is loaded, or use a smaller model."
        : "";

      return {
        success: false,
        message: `Ollama could not compose the answer. ${detail}${timeoutHint}`,
        evidence: evidenceBundle.evidence,
        diagnostics: {
          evidenceCharacters: evidenceBundle.characterCount,
          evidenceCount: evidenceBundle.evidence.length,
          timeoutMs: requestTimeoutMs,
        },
      };
    }
  });
}
