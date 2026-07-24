<template>
  <aside v-if="open" class="assistant-layer" aria-label="儿童安全小助手">
    <button class="assistant-scrim" type="button" aria-label="关闭儿童安全小助手" @click="close"></button>
    <section class="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="child-safety-title">
      <header class="assistant-header">
        <div class="assistant-heading">
          <span class="assistant-mark" aria-hidden="true"><i class="fa-solid fa-shield-heart"></i></span>
          <div>
            <h2 id="child-safety-title">儿童安全小助手</h2>
            <p>{{ statusLine }}</p>
          </div>
        </div>
        <div class="assistant-header-actions">
          <button class="icon-button" type="button" title="配置方舟" aria-label="配置方舟" @click="openSettings">
            <i class="fa-solid fa-sliders"></i>
          </button>
          <button class="icon-button" type="button" title="关闭" aria-label="关闭儿童安全小助手" @click="close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

      <div class="assistant-body">
        <aside class="session-rail" aria-label="会话列表">
          <div class="rail-topline">
            <span>会话</span>
            <button class="rail-action" type="button" title="新建会话" aria-label="新建会话" :disabled="isGenerating" @click="createNewSession">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
          <button class="new-session-button" type="button" :disabled="isGenerating" @click="createNewSession">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>新建会话</span>
          </button>
          <div class="session-list">
            <button
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === currentSessionId }"
              type="button"
              :disabled="isGenerating && session.id !== currentSessionId"
              @click="switchSession(session.id)"
            >
              <span class="session-item-copy">
                <strong>{{ session.title || "新对话" }}</strong>
                <small>{{ formatSessionTime(session.updatedAt) }}</small>
              </span>
              <span v-if="session.isStreaming" class="session-live" aria-label="正在生成"></span>
              <span
                class="session-delete"
                role="button"
                tabindex="0"
                title="删除会话"
                aria-label="删除会话"
                @click.stop="deleteSession(session.id)"
                @keydown.enter.stop="deleteSession(session.id)"
              >
                <i class="fa-solid fa-trash-can"></i>
              </span>
            </button>
          </div>
          <button v-if="sessions.length" class="clear-history-button" type="button" :disabled="isGenerating" @click="clearHistory">
            <i class="fa-solid fa-broom"></i>
            <span>清空历史</span>
          </button>
        </aside>

        <main class="assistant-main">
          <div v-if="!status.hasApiKey || !status.modelId" class="setup-strip">
            <div class="setup-icon" aria-hidden="true"><i class="fa-solid fa-key"></i></div>
            <div class="setup-copy">
              <strong>完成方舟配置后开始对话</strong>
              <span>API Key 只保存在本机安全存储中。</span>
            </div>
            <button type="button" class="setup-button" @click="openSettings">去配置</button>
          </div>

          <div v-if="errorMessage" class="assistant-error" role="alert">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            <span>{{ errorMessage }}</span>
            <button type="button" title="关闭错误" aria-label="关闭错误" @click="errorMessage = ''">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div ref="messagesRef" class="message-scroll">
            <div v-if="!currentSession || currentSession.messages.length === 0" class="empty-chat">
              <div class="empty-mark" aria-hidden="true"><i class="fa-solid fa-shield-heart"></i></div>
              <h3>先从一个安全问题开始</h3>
              <p>可以从居家、校园、出行或融合活动适配开始。</p>
              <div class="starter-list">
                <button v-for="starter in starters" :key="starter" type="button" :disabled="isGenerating" @click="useStarter(starter)">
                  {{ starter }}
                </button>
              </div>
            </div>

            <article
              v-for="(message, index) in currentSession?.messages || []"
              :key="message.id"
              class="message-row"
              :class="message.role === 'user' ? 'from-user' : 'from-assistant'"
            >
              <div class="message-avatar" aria-hidden="true">
                <i v-if="message.role === 'user'" class="fa-solid fa-user"></i>
                <i v-else class="fa-solid fa-shield-heart"></i>
              </div>
              <div class="message-column">
                <div class="message-meta">
                  <span>{{ message.role === "user" ? "你" : "儿童安全小助手" }}</span>
                  <span v-if="message.status === 'stopped'" class="message-status">已停止</span>
                  <span v-if="message.status === 'error'" class="message-status error">未完成</span>
                </div>
                <div v-if="editingMessageId !== message.id" class="message-bubble">
                  <div class="message-text">{{ message.content || (message.status === "streaming" ? "正在生成..." : "") }}</div>
                  <div v-if="message.error" class="message-inline-error">{{ message.error.message }}</div>
                </div>
                <div v-else class="message-edit-box">
                  <textarea v-model="editDraft" rows="4" maxlength="12000" aria-label="编辑消息" @keydown.enter.exact.prevent="submitEdit(message)"></textarea>
                  <div class="message-edit-actions">
                    <button type="button" class="quiet-button" @click="cancelEdit">取消</button>
                    <button type="button" class="primary-button" :disabled="!editDraft.trim()" @click="submitEdit(message)">
                      <i class="fa-solid fa-paper-plane"></i>
                      <span>编辑并重发</span>
                    </button>
                  </div>
                </div>
                <div v-if="canEdit(message, index)" class="message-actions">
                  <button type="button" title="编辑并重发" @click="startEdit(message)">
                    <i class="fa-solid fa-pen"></i><span>编辑并重发</span>
                  </button>
                </div>
                <div v-if="canRegenerate(message, index)" class="message-actions">
                  <button type="button" title="重新生成" @click="regenerate(message)">
                    <i class="fa-solid fa-rotate-right"></i><span>重新生成</span>
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div class="composer-area">
            <div v-if="isGenerating" class="generation-status">
              <span class="pulse-dot" aria-hidden="true"></span>
              <span>正在生成回答</span>
              <button type="button" class="stop-button" @click="stopGeneration">
                <i class="fa-solid fa-stop"></i><span>停止生成</span>
              </button>
            </div>
            <form class="composer" @submit.prevent="sendMessage">
              <textarea
                v-model="draft"
                rows="3"
                maxlength="12000"
                :disabled="isGenerating"
                placeholder="描述一个安全问题，或输入想检查的场景"
                aria-label="输入安全问题"
                @keydown.enter.exact.prevent="sendMessage"
              ></textarea>
              <button class="send-button" type="submit" title="发送" aria-label="发送" :disabled="isGenerating || !draft.trim()">
                <i class="fa-solid fa-arrow-up"></i>
              </button>
            </form>
            <p class="composer-note">安全建议不能替代成年人现场监护或紧急救援。</p>
          </div>
        </main>
      </div>

      <div v-if="settingsOpen" class="settings-overlay">
        <form class="settings-panel" @submit.prevent="saveSettings">
          <div class="settings-heading">
            <div><span class="eyebrow">本机配置</span><h3>连接火山方舟</h3></div>
            <button type="button" class="icon-button" title="关闭配置" aria-label="关闭配置" @click="settingsOpen = false">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <label class="field-label" for="ark-model-id">模型 / 推理接入点 ID</label>
          <input id="ark-model-id" v-model="configForm.modelId" autocomplete="off" placeholder="例如 ep-..." />
          <label class="field-label" for="ark-api-key">API Key</label>
          <input id="ark-api-key" v-model="configForm.apiKey" type="password" autocomplete="new-password" placeholder="已配置时留空即可保留" />
          <p class="field-help">Base URL 固定由应用管理。API Key 不会回显，也不会交给页面脚本。</p>
          <p v-if="!status.secureStorageAvailable" class="field-warning" role="alert">
            当前系统安全存储不可用，无法保存 API Key；会话仅保留在本次运行内存中。
          </p>
          <p v-if="settingsError" class="field-error" role="alert">{{ settingsError }}</p>
          <div class="settings-actions">
            <button type="button" class="quiet-button" :disabled="settingsSaving" @click="settingsOpen = false">取消</button>
            <button type="submit" class="primary-button" :disabled="settingsSaving || !configForm.modelId.trim()">
              <i class="fa-solid fa-floppy-disk"></i><span>{{ settingsSaving ? "保存中..." : "保存配置" }}</span>
            </button>
          </div>
          <button v-if="status.hasApiKey" type="button" class="clear-key-button" :disabled="settingsSaving" @click="clearApiKey">
            <i class="fa-solid fa-key"></i><span>清除已保存的 API Key</span>
          </button>
        </form>
      </div>
    </section>
  </aside>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close"]);
const api = typeof window !== "undefined" ? window.electronAPI?.childSafetyAssistant : null;
const status = ref({
  hasApiKey: false,
  modelId: "",
  secureStorageAvailable: false,
  memoryOnly: true,
});
const sessions = ref([]);
const currentSessionId = ref("");
const currentSession = ref(null);
const draft = ref("");
const errorMessage = ref("");
const settingsError = ref("");
const messagesRef = ref(null);
const generatingRequestId = ref("");
const editingMessageId = ref("");
const editDraft = ref("");
const settingsOpen = ref(false);
const settingsSaving = ref(false);
const configForm = ref({ apiKey: "", modelId: "" });

const starters = [
  "帮我检查家里的儿童安全隐患",
  "怎么给幼儿园孩子讲不能碰插座",
  "特教孩子喜欢突然跑出教室，怎么防止？",
];

const isGenerating = computed(() => Boolean(generatingRequestId.value));
const statusLine = computed(() => {
  if (!status.value.secureStorageAvailable) return "仅本次运行保存";
  if (!status.value.hasApiKey || !status.value.modelId) return "等待完成配置";
  return "已连接本机方舟配置";
});

function makeRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "request-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function formatSessionTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

async function loadStatus() {
  if (!api) return;
  const result = await api.getStatus();
  if (result?.success) {
    status.value = result;
    configForm.value.modelId = result.modelId || "";
  } else if (result?.error?.message) {
    errorMessage.value = result.error.message;
  }
}

async function loadSessions(preferredId = "") {
  if (!api) return;
  const result = await api.listSessions();
  if (!result?.success) {
    errorMessage.value = result?.error?.message || "无法加载会话历史";
    return;
  }
  sessions.value = result.sessions || [];
  if (!sessions.value.length) {
    const created = await api.createSession();
    if (created?.success) {
      sessions.value = [{ ...created.session, messageCount: 0, isStreaming: false }];
      currentSessionId.value = created.session.id;
      currentSession.value = created.session;
    }
    return;
  }
  const nextId = preferredId && sessions.value.some((session) => session.id === preferredId)
    ? preferredId
    : (currentSessionId.value && sessions.value.some((session) => session.id === currentSessionId.value)
      ? currentSessionId.value
      : sessions.value[0].id);
  await switchSession(nextId, true);
}

async function loadSession(sessionId) {
  if (!api || !sessionId) return;
  const result = await api.getSession(sessionId);
  if (result?.success) {
    currentSession.value = result.session;
    await scrollToBottom();
  } else if (result?.error?.message) {
    errorMessage.value = result.error.message;
  }
}

async function switchSession(sessionId, silent = false) {
  if (isGenerating.value && sessionId !== currentSessionId.value) return;
  currentSessionId.value = sessionId;
  await loadSession(sessionId);
  if (!silent) errorMessage.value = "";
}

async function createNewSession() {
  if (!api || isGenerating.value) return;
  const result = await api.createSession();
  if (!result?.success) {
    errorMessage.value = result?.error?.message || "无法新建会话";
    return;
  }
  sessions.value.unshift({ ...result.session, messageCount: 0, isStreaming: false });
  currentSessionId.value = result.session.id;
  currentSession.value = result.session;
  draft.value = "";
  errorMessage.value = "";
}

async function deleteSession(sessionId) {
  if (!api || isGenerating.value || !window.confirm("删除这个会话？删除后无法恢复。")) return;
  const result = await api.deleteSession(sessionId);
  if (!result?.success) {
    errorMessage.value = result?.error?.message || "无法删除会话";
    return;
  }
  sessions.value = sessions.value.filter((session) => session.id !== sessionId);
  if (currentSessionId.value === sessionId) {
    currentSessionId.value = "";
    currentSession.value = null;
    await loadSessions();
  }
}

async function clearHistory() {
  if (!api || isGenerating.value || !window.confirm("清空全部会话历史？清空后无法恢复。")) return;
  const result = await api.clearHistory();
  if (!result?.success) {
    errorMessage.value = result?.error?.message || "无法清空历史";
    return;
  }
  sessions.value = [];
  currentSessionId.value = "";
  currentSession.value = null;
  await loadSessions();
}

async function runGeneration(action) {
  if (!api || isGenerating.value) return;
  errorMessage.value = "";
  const requestId = makeRequestId();
  generatingRequestId.value = requestId;
  try {
    const result = await action(requestId);
    if (result?.success === false && result?.error?.message) {
      errorMessage.value = result.error.message;
    }
    if (generatingRequestId.value === requestId) {
      generatingRequestId.value = "";
    }
    if (result?.success === false && !result?.stopped) {
      await loadSession(currentSessionId.value);
      await loadSessions(currentSessionId.value);
    }
  } catch (error) {
    errorMessage.value = error?.message || "请求失败，请重试";
    generatingRequestId.value = "";
  }
}

async function sendMessage() {
  const content = draft.value.trim();
  if (!content || !currentSessionId.value || isGenerating.value) return;
  draft.value = "";
  await runGeneration((requestId) => api.sendMessage({
    sessionId: currentSessionId.value,
    content,
    requestId,
  }));
}

function useStarter(starter) {
  draft.value = starter;
  nextTick(() => sendMessage());
}

async function stopGeneration() {
  if (!api || !generatingRequestId.value) return;
  const result = await api.stopGeneration(generatingRequestId.value);
  if (result?.success === false && result?.error?.message) {
    errorMessage.value = result.error.message;
  }
}

function startEdit(message) {
  if (isGenerating.value) return;
  editingMessageId.value = message.id;
  editDraft.value = message.content;
  nextTick(() => document.querySelector(".message-edit-box textarea")?.focus());
}

function cancelEdit() {
  editingMessageId.value = "";
  editDraft.value = "";
}

async function submitEdit(message) {
  const content = editDraft.value.trim();
  if (!content || !currentSessionId.value || isGenerating.value) return;
  cancelEdit();
  await runGeneration((requestId) => api.editAndResend({
    sessionId: currentSessionId.value,
    messageId: message.id,
    content,
    requestId,
  }));
}

async function regenerate(message) {
  if (!currentSessionId.value || isGenerating.value) return;
  await runGeneration((requestId) => api.regenerate({
    sessionId: currentSessionId.value,
    messageId: message.id,
    requestId,
  }));
}

function canEdit(message, index) {
  if (isGenerating.value || message.role !== "user" || !currentSession.value) return false;
  const messages = currentSession.value.messages || [];
  const lastUserIndex = messages.reduce((last, item, itemIndex) => item.role === "user" ? itemIndex : last, -1);
  return index === lastUserIndex && editingMessageId.value !== message.id;
}

function canRegenerate(message, index) {
  if (isGenerating.value || message.role !== "assistant" || !currentSession.value) return false;
  const messages = currentSession.value.messages || [];
  return index === messages.length - 1 && message.status !== "streaming";
}

async function saveSettings() {
  if (!api || !configForm.value.modelId.trim()) return;
  settingsSaving.value = true;
  settingsError.value = "";
  try {
    const result = await api.saveConfig({
      apiKey: configForm.value.apiKey,
      modelId: configForm.value.modelId.trim(),
    });
    if (!result?.success) {
      settingsError.value = result?.error?.message || "配置保存失败";
      return;
    }
    configForm.value.apiKey = "";
    status.value = result;
    settingsOpen.value = false;
  } catch (error) {
    settingsError.value = error?.message || "配置保存失败";
  } finally {
    settingsSaving.value = false;
  }
}

async function clearApiKey() {
  if (!api || !window.confirm("清除本机保存的 API Key？")) return;
  const result = await api.clearApiKey();
  if (!result?.success) {
    settingsError.value = result?.error?.message || "无法清除 API Key";
    return;
  }
  status.value = result;
  configForm.value.apiKey = "";
}

function openSettings() {
  settingsError.value = "";
  configForm.value.apiKey = "";
  configForm.value.modelId = status.value.modelId || "";
  settingsOpen.value = true;
}

function close() {
  if (isGenerating.value) {
    errorMessage.value = "请先停止生成，再关闭工作区";
    return;
  }
  emit("close");
}

async function scrollToBottom() {
  await nextTick();
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
}

function handleEvent(event) {
  if (!event || event.sessionId !== currentSessionId.value) return;
  if (event.type === "start") {
    generatingRequestId.value = event.requestId;
    if (event.session) currentSession.value = event.session;
    void loadSessions(currentSessionId.value);
    void scrollToBottom();
    return;
  }
  if (event.type === "chunk") {
    const message = currentSession.value?.messages?.find((item) => item.id === event.messageId);
    if (message) {
      message.content += event.delta || "";
      message.status = "streaming";
      void scrollToBottom();
    }
    return;
  }
  if (event.type === "done" || event.type === "stopped" || event.type === "error") {
    if (event.type === "error") errorMessage.value = event.error?.message || "生成失败，请重试";
    generatingRequestId.value = "";
    if (event.session) currentSession.value = event.session;
    void loadSession(currentSessionId.value);
    void loadSessions(currentSessionId.value);
  }
}

function attachEvents() {
  api?.onEvent(handleEvent);
}

function detachEvents() {
  api?.offEvent(handleEvent);
}

async function openAssistant() {
  attachEvents();
  await loadStatus();
  await loadSessions();
}

watch(() => props.open, (open) => {
  if (open) void openAssistant();
  else detachEvents();
});

onBeforeUnmount(() => detachEvents());
</script>

<style scoped>
.assistant-layer {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  justify-content: flex-end;
  background: rgba(30, 39, 42, 0.32);
}

.assistant-scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: default;
}

.assistant-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(960px, 100%);
  height: 100%;
  background: #f7fbfa;
  color: #263338;
  box-shadow: -10px 0 32px rgba(24, 46, 48, 0.2);
}

.assistant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  min-height: 78px;
  padding: 14px 24px;
  background: #164e52;
  color: #fff;
}

.assistant-heading,
.assistant-header-actions,
.rail-topline,
.generation-status,
.message-meta,
.message-actions,
.message-edit-actions,
.settings-heading,
.settings-actions {
  display: flex;
  align-items: center;
}

.assistant-heading {
  gap: 12px;
}

.assistant-heading h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
}

.assistant-heading p {
  margin: 4px 0 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: 12px;
}

.assistant-mark,
.empty-mark,
.setup-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: #f08a63;
  color: #fff;
  font-size: 20px;
}

.assistant-header-actions {
  gap: 6px;
}

.icon-button,
.rail-action,
.message-actions button,
.assistant-error button {
  display: inline-grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.icon-button {
  width: 36px;
  height: 36px;
  border-radius: 7px;
  color: #fff;
  font-size: 16px;
}

.icon-button:hover {
  background: rgba(255, 255, 255, 0.14);
}

.assistant-body {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
}

.session-rail {
  display: flex;
  flex: 0 0 220px;
  flex-direction: column;
  min-height: 0;
  padding: 18px 14px;
  border-right: 1px solid #dce9e6;
  background: #edf6f3;
}

.rail-topline {
  justify-content: space-between;
  padding: 0 4px 12px;
  color: #476264;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.rail-action {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  color: #166166;
  font-size: 14px;
}

.rail-action:hover {
  background: #d9ece8;
}

.new-session-button,
.clear-history-button,
.setup-button,
.primary-button,
.quiet-button,
.clear-key-button,
.stop-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.new-session-button {
  width: 100%;
  border-color: #b9d9d4;
  background: #fff;
  color: #145c5e;
  font-weight: 700;
}

.new-session-button:hover {
  border-color: #78b7ae;
  background: #f7fffd;
}

.session-list {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  margin-top: 16px;
}

.session-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 58px;
  margin-bottom: 5px;
  padding: 8px 8px 8px 11px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #3c5354;
  text-align: left;
  cursor: pointer;
}

.session-item:hover {
  background: #e0f0ed;
}

.session-item.active {
  border-color: #a7d0ca;
  background: #d8ebe7;
  color: #164e52;
}

.session-item-copy {
  min-width: 0;
  flex: 1;
}

.session-item-copy strong,
.session-item-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item-copy strong {
  font-size: 13px;
  font-weight: 700;
}

.session-item-copy small {
  margin-top: 4px;
  color: #748a8b;
  font-size: 11px;
}

.session-live {
  width: 7px;
  height: 7px;
  margin: 0 6px;
  border-radius: 50%;
  background: #f08a63;
}

.session-delete {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: #789090;
  font-size: 12px;
}

.session-delete:hover {
  background: #f9d8cd;
  color: #a33f2c;
}

.clear-history-button {
  width: 100%;
  margin-top: 12px;
  border-color: #d2e3df;
  background: transparent;
  color: #6b7f80;
}

.clear-history-button:hover {
  background: #fff;
  color: #a33f2c;
}

.assistant-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  background: #fff;
}

.setup-strip {
  display: flex;
  align-items: center;
  gap: 11px;
  flex: 0 0 auto;
  margin: 16px 20px 0;
  padding: 11px 12px;
  border: 1px solid #f2d4c9;
  border-radius: 8px;
  background: #fff8f5;
}

.setup-icon {
  width: 30px;
  height: 30px;
  font-size: 14px;
}

.setup-copy {
  min-width: 0;
  flex: 1;
}

.setup-copy strong,
.setup-copy span {
  display: block;
}

.setup-copy strong {
  color: #74402f;
  font-size: 13px;
}

.setup-copy span {
  margin-top: 3px;
  color: #977466;
  font-size: 11px;
}

.setup-button,
.primary-button {
  background: #166166;
  color: #fff;
}

.setup-button:hover,
.primary-button:hover {
  background: #0f5053;
}

.assistant-error {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  margin: 12px 20px 0;
  padding: 9px 11px;
  border: 1px solid #efc0b3;
  border-radius: 7px;
  background: #fff4f1;
  color: #9c3d2b;
  font-size: 12px;
}

.assistant-error span {
  min-width: 0;
  flex: 1;
}

.assistant-error button {
  width: 24px;
  height: 24px;
  color: #9c3d2b;
}

.message-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 24px 28px 18px;
}

.empty-chat {
  max-width: 560px;
  margin: 12vh auto 0;
  color: #647778;
  text-align: center;
}

.empty-mark {
  width: 58px;
  height: 58px;
  margin: 0 auto 14px;
  font-size: 27px;
}

.empty-chat h3 {
  margin: 0;
  color: #294c4e;
  font-size: 20px;
}

.empty-chat p {
  margin: 8px 0 18px;
  font-size: 13px;
}

.starter-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.starter-list button {
  padding: 8px 11px;
  border: 1px solid #c6dfda;
  border-radius: 7px;
  background: #f5fbf9;
  color: #326466;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.starter-list button:hover {
  border-color: #76b5ae;
  background: #eaf6f3;
}

.message-row {
  display: flex;
  gap: 10px;
  max-width: 760px;
  margin: 0 auto 22px;
}

.message-row.from-user {
  flex-direction: row-reverse;
}

.message-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: #dcece9;
  color: #216467;
  font-size: 13px;
}

.from-user .message-avatar {
  background: #f7ded5;
  color: #a9533c;
}

.message-column {
  min-width: 0;
  max-width: calc(100% - 40px);
}

.from-user .message-column {
  text-align: right;
}

.message-meta {
  gap: 8px;
  margin-bottom: 5px;
  color: #758687;
  font-size: 11px;
}

.from-user .message-meta {
  justify-content: flex-end;
}

.message-status {
  color: #a66a4d;
}

.message-status.error {
  color: #a33f2c;
}

.message-bubble {
  padding: 11px 13px;
  border: 1px solid #dce9e6;
  border-radius: 8px;
  background: #f8fcfb;
  text-align: left;
}

.from-user .message-bubble {
  border-color: #f0d4ca;
  background: #fff7f4;
}

.message-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.65;
}

.message-inline-error {
  margin-top: 7px;
  color: #a33f2c;
  font-size: 12px;
}

.message-actions {
  gap: 7px;
  margin-top: 5px;
}

.from-user .message-actions {
  justify-content: flex-end;
}

.message-actions button {
  gap: 5px;
  padding: 3px 0;
  color: #638081;
  font: inherit;
  font-size: 11px;
}

.message-actions button:hover {
  color: #166166;
}

.message-edit-box textarea,
.composer textarea,
.settings-panel input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #bad7d2;
  border-radius: 8px;
  background: #fff;
  color: #263338;
  font: inherit;
  outline: none;
}

.message-edit-box textarea:focus,
.composer textarea:focus,
.settings-panel input:focus {
  border-color: #3b8984;
  box-shadow: 0 0 0 3px rgba(59, 137, 132, 0.14);
}

.message-edit-box textarea {
  min-height: 94px;
  padding: 10px;
  resize: vertical;
  font-size: 13px;
  line-height: 1.5;
}

.message-edit-actions {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.quiet-button {
  border-color: #d2e3df;
  background: #fff;
  color: #536a6b;
}

.quiet-button:hover {
  background: #f1f8f6;
}

.composer-area {
  flex: 0 0 auto;
  padding: 0 28px 18px;
  border-top: 1px solid #e2edeb;
  background: #fff;
}

.generation-status {
  gap: 8px;
  min-height: 38px;
  color: #547071;
  font-size: 12px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f08a63;
  box-shadow: 0 0 0 4px rgba(240, 138, 99, 0.16);
}

.stop-button {
  margin-left: auto;
  border-color: #efc0b3;
  background: #fff6f3;
  color: #9c3d2b;
}

.stop-button:hover {
  background: #ffe9e2;
}

.composer {
  position: relative;
  display: flex;
  align-items: flex-end;
}

.composer textarea {
  min-height: 72px;
  padding: 11px 52px 11px 12px;
  resize: vertical;
  font-size: 13px;
  line-height: 1.5;
}

.send-button {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 8px;
  background: #166166;
  color: #fff;
  cursor: pointer;
}

.send-button:hover {
  background: #0f5053;
}

.send-button:disabled {
  background: #b9cfcc;
  cursor: not-allowed;
}

.composer-note {
  margin: 7px 0 0;
  color: #839394;
  font-size: 11px;
  text-align: center;
}

.settings-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(25, 51, 52, 0.35);
}

.settings-panel {
  box-sizing: border-box;
  width: min(420px, 100%);
  padding: 22px;
  border: 1px solid #d2e3df;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(26, 59, 60, 0.2);
}

.settings-heading {
  justify-content: space-between;
  margin-bottom: 20px;
}

.settings-heading h3 {
  margin: 4px 0 0;
  color: #164e52;
  font-size: 18px;
}

.eyebrow {
  color: #718788;
  font-size: 11px;
  letter-spacing: 0;
}

.settings-heading .icon-button {
  color: #5c7273;
}

.settings-heading .icon-button:hover {
  background: #edf6f3;
}

.field-label {
  display: block;
  margin: 13px 0 6px;
  color: #425e5f;
  font-size: 12px;
  font-weight: 700;
}

.settings-panel input {
  height: 38px;
  padding: 8px 10px;
  font-size: 13px;
}

.field-help,
.field-warning,
.field-error {
  margin: 8px 0;
  font-size: 11px;
  line-height: 1.5;
}

.field-help {
  color: #718788;
}

.field-warning,
.field-error {
  color: #a33f2c;
}

.settings-actions {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.clear-key-button {
  width: 100%;
  margin-top: 12px;
  border-color: #efc0b3;
  background: #fff8f5;
  color: #9c3d2b;
}

.clear-key-button:hover {
  background: #ffe9e2;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .assistant-header {
    min-height: 68px;
    padding: 12px 16px;
  }

  .assistant-heading p {
    display: none;
  }

  .assistant-body {
    flex-direction: column;
  }

  .session-rail {
    flex: 0 0 auto;
    width: auto;
    max-height: 150px;
    padding: 9px 12px;
    border-right: 0;
    border-bottom: 1px solid #dce9e6;
  }

  .rail-topline,
  .new-session-button,
  .clear-history-button {
    display: none;
  }

  .session-list {
    display: flex;
    gap: 7px;
    margin-top: 0;
    overflow-x: auto;
  }

  .session-item {
    flex: 0 0 165px;
    margin: 0;
    min-height: 50px;
  }

  .assistant-main {
    min-height: 0;
  }

  .message-scroll {
    padding: 20px 14px 14px;
  }

  .composer-area {
    padding: 0 14px 14px;
  }

  .setup-strip,
  .assistant-error {
    margin-left: 14px;
    margin-right: 14px;
  }

  .setup-copy span {
    display: none;
  }

  .message-row {
    gap: 7px;
    margin-bottom: 18px;
  }

  .message-column {
    max-width: calc(100% - 37px);
  }

  .empty-chat {
    margin-top: 6vh;
  }

  .settings-overlay {
    padding: 14px;
  }
}
</style>
