<template>
  <div class="settings-container">
    <div class="settings-header">
      <h2>⚙️ 应用设置</h2>
      <p class="settings-desc">自定义应用外观、标题与小助手配置</p>
    </div>

    <div class="settings-content">
      <!-- 密码验证 -->
      <div v-if="!isAuthenticated" class="password-section">
        <div class="password-box">
          <div class="lock-icon">🔒</div>
          <h3>需要管理员密码</h3>
          <p>请输入管理员密码以继续</p>
          <input
            v-model="password"
            type="password"
            class="password-input"
            placeholder="请输入密码"
            @keyup.enter="verifyPassword"
          />
          <div v-if="passwordError" class="error-message">
            {{ passwordError }}
          </div>
          <button class="verify-btn" @click="verifyPassword">验证</button>
        </div>
      </div>

      <!-- 设置表单 -->
      <div v-else class="settings-form">
        <!-- 应用标题设置 -->
        <div class="form-section">
          <h3 class="section-title">📝 应用标题</h3>
          <div class="form-group">
            <label>标题文字</label>
            <input
              v-model="formData.appTitle"
              type="text"
              class="form-input"
              placeholder="特教安全教育资源仪"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>字体大小</label>
              <input
                v-model="formData.titleStyle.fontSize"
                type="text"
                class="form-input"
                placeholder="36px"
              />
            </div>
            <div class="form-group">
              <label>文字颜色</label>
              <input
                v-model="formData.titleStyle.color"
                type="color"
                class="form-input color-input"
              />
              <span class="color-value">{{ formData.titleStyle.color }}</span>
            </div>
          </div>
        </div>

        <!-- Logo设置 -->
        <div class="form-section">
          <h3 class="section-title">🖼️ 应用Logo</h3>
          <div class="logo-preview">
            <img :src="logoPreview" alt="Logo预览" class="preview-image" />
          </div>
          <div class="logo-buttons">
            <button class="upload-btn" @click="selectLogo">
              <span>📤</span>
              选择图片
            </button>
            <button class="reset-btn" @click="resetLogo">
              <span>🔄</span>
              重置默认
            </button>
          </div>
          <p class="hint">支持 PNG、JPG 格式，最大 1MB</p>
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg"
            style="display: none"
            @change="handleFileChange"
          />
        </div>

        <!-- Header背景色设置 -->
        <div class="form-section">
          <h3 class="section-title">🎨 顶部背景</h3>
          <div class="form-group">
            <label>背景渐变色</label>
            <input
              v-model="formData.headerBackground"
              type="text"
              class="form-input"
              placeholder="linear-gradient(...)"
            />
            <p class="hint">
              CSS渐变语法，例如：linear-gradient(135deg, #667eea 0%, #764ba2
              100%)
            </p>
          </div>
          <div
            class="gradient-preview"
            :style="{ background: formData.headerBackground }"
          >
            预览
          </div>
        </div>

        <!-- 儿童安全小助手 -->
        <div class="form-section">
          <h3 class="section-title">🤖 儿童安全小助手</h3>
          <div class="form-group">
            <label>模型 / 推理接入点 ID</label>
            <input
              v-model="assistant.modelId"
              type="text"
              class="form-input"
              placeholder="例如 ep-2025… 或 deepseek-v4-flash-ga-260731"
            />
            <p class="hint">
              火山方舟的模型 / 推理接入点 ID（服务地址由应用固定）；改完下一条消息即生效，无需重启。
            </p>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <div class="assistant-key-row">
              <span
                class="key-status"
                :class="assistant.hasApiKey ? 'ok' : 'none'"
              >
                {{ assistant.hasApiKey ? "已配置" : "未配置" }}
              </span>
              <button
                class="clear-key-btn"
                :disabled="!assistant.hasApiKey || clearingKey"
                @click="clearAssistantKey"
              >
                清除已保存的 API Key
              </button>
            </div>
            <p class="hint">
              Key 只保存在本机安全存储中，此处不回显；如需更换，请到小助手面板重新填写。
              <span v-if="assistant.secureStorageUnavailable" class="key-warn">
                当前系统安全存储不可用，Key 无法持久保存。
              </span>
            </p>
          </div>
          <div
            v-if="assistant.message"
            class="assistant-message"
            :class="assistant.success ? 'success' : 'error'"
          >
            {{ assistant.message }}
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="form-actions">
          <button class="save-btn" @click="saveSettings" :disabled="saving">
            <span v-if="!saving">💾 保存设置</span>
            <span v-else>保存中...</span>
          </button>
          <button class="cancel-btn" @click="$emit('close')">取消</button>
        </div>

        <div
          v-if="saveMessage"
          class="save-message"
          :class="saveSuccess ? 'success' : 'error'"
        >
          {{ saveMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

defineEmits(["close", "updated"]);

const isAuthenticated = ref(false);
const password = ref("");
const passwordError = ref("");

const formData = ref({
  appTitle: "",
  titleStyle: {
    fontSize: "36px",
    color: "#ffffff",
  },
  headerBackground: "",
});

const logoPreview = ref("/icons/logo.png");
const fileInput = ref(null);
const saving = ref(false);
const saveMessage = ref("");
const saveSuccess = ref(false);

// 儿童安全小助手：模型可改，API Key 只看状态与清除（不回显）
const assistant = ref({
  modelId: "",
  hasApiKey: false,
  secureStorageUnavailable: false,
  message: "",
  success: true,
});
const clearingKey = ref(false);

// 加载小助手状态（模型接入点 + Key 是否已配置）
const loadAssistantStatus = async () => {
  try {
    const status = await window.electronAPI.childSafetyAssistant.getStatus();
    assistant.value.modelId = status?.modelId || "";
    assistant.value.hasApiKey = !!status?.hasApiKey;
    assistant.value.secureStorageUnavailable = status?.secureStorageAvailable === false;
  } catch (error) {
    console.error("加载小助手状态失败:", error);
  }
};

// 清除已保存的 API Key（二次确认）
const clearAssistantKey = async () => {
  if (
    !window.confirm("清除本机保存的 API Key？清除后需重新配置才能使用小助手。")
  ) {
    return;
  }
  clearingKey.value = true;
  assistant.value.message = "";
  try {
    const result = await window.electronAPI.childSafetyAssistant.clearApiKey();
    if (!result?.success) {
      assistant.value.success = false;
      assistant.value.message =
        result?.error?.message || "无法清除 API Key";
      return;
    }
    assistant.value.hasApiKey = !!result.hasApiKey;
    assistant.value.success = true;
    assistant.value.message = "✅ API Key 已清除";
  } catch (error) {
    assistant.value.success = false;
    assistant.value.message = error?.message || "无法清除 API Key";
  } finally {
    clearingKey.value = false;
  }
};

// 验证密码
const verifyPassword = async () => {
  passwordError.value = "";

  if (!password.value) {
    passwordError.value = "请输入密码";
    return;
  }

  try {
    const result = await window.electronAPI.verifyAdminPassword(password.value);
    if (result.success) {
      isAuthenticated.value = true;
      loadConfig();
      loadAssistantStatus();
    } else {
      passwordError.value = "密码错误，请重试";
      password.value = "";
    }
  } catch (error) {
    passwordError.value = "验证失败：" + error.message;
  }
};

// 加载配置
const loadConfig = async () => {
  try {
    const result = await window.electronAPI.getAppConfig();
    if (result.success) {
      formData.value.appTitle = result.config.appTitle;
      formData.value.titleStyle = result.config.titleStyle;
      formData.value.headerBackground = result.config.headerBackground;

      // 设置logo预览
      if (result.config.logoFullPath) {
        logoPreview.value = result.config.logoFullPath;
      }
    }
  } catch (error) {
    console.error("加载配置失败:", error);
  }
};

// 选择Logo
const selectLogo = () => {
  fileInput.value.click();
};

// 处理文件选择
const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // 检查文件类型
  if (!file.type.match(/image\/(png|jpeg)/)) {
    alert("只支持 PNG 和 JPG 格式的图片");
    return;
  }

  // 检查文件大小（1MB）
  if (file.size > 1048576) {
    alert("图片大小不能超过 1MB");
    return;
  }

  // 读取文件并预览
  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageData = e.target.result;
    logoPreview.value = imageData;

    // 上传到主进程
    try {
      const result = await window.electronAPI.uploadLogo(imageData);
      if (result.success) {
        console.log("Logo上传成功");
      } else {
        alert("上传失败：" + result.message);
      }
    } catch (error) {
      alert("上传失败：" + error.message);
    }
  };
  reader.readAsDataURL(file);
};

// 重置Logo
const resetLogo = async () => {
  if (confirm("确定要重置为默认Logo吗？")) {
    try {
      const result = await window.electronAPI.resetLogo();
      if (result.success) {
        logoPreview.value = "/icons/logo.png";
        alert("已重置为默认Logo");
      }
    } catch (error) {
      alert("重置失败：" + error.message);
    }
  }
};

// 保存设置
const saveSettings = async () => {
  saving.value = true;
  saveMessage.value = "";
  assistant.value.message = "";

  try {
    // 小助手模型先做非空前置校验，避免应用配置已写、小助手配置没写
    const modelId = assistant.value.modelId.trim();
    if (!modelId) {
      saveSuccess.value = false;
      saveMessage.value = "保存失败：请填写小助手的模型 / 推理接入点 ID";
      return;
    }

    // 创建纯对象，避免传递 ref 或 proxy 对象
    const config = {
      appTitle: formData.value.appTitle,
      titleStyle: {
        fontSize: formData.value.titleStyle.fontSize,
        color: formData.value.titleStyle.color,
      },
      headerBackground: formData.value.headerBackground,
    };

    const result = await window.electronAPI.updateAppConfig(config);

    if (!result.success) {
      saveSuccess.value = false;
      saveMessage.value = "保存失败：" + result.message;
      return;
    }

    // 小助手只提交模型（不传 apiKey ⇒ 主进程保留原 Key）
    const assistantResult =
      await window.electronAPI.childSafetyAssistant.saveConfig({ modelId });

    if (!assistantResult?.success) {
      saveSuccess.value = false;
      saveMessage.value =
        "保存失败：" + (assistantResult?.error?.message || "小助手配置未保存");
      return;
    }

    assistant.value.hasApiKey = !!assistantResult.hasApiKey;
    if (!assistant.value.hasApiKey) {
      assistant.value.success = false;
      assistant.value.message = "⚠️ 小助手尚未配置 API Key，使用前请先填写";
    }

    saveSuccess.value = true;
    saveMessage.value = "✅ 设置已保存，正在刷新...";

    // 通知父组件更新
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    saveSuccess.value = false;
    saveMessage.value = "保存失败：" + error.message;
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  // 组件加载时不自动加载配置，需要先验证密码
});
</script>

<style scoped>
.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

.settings-header {
  text-align: center;
  margin-bottom: 40px;
}

.settings-header h2 {
  font-size: 32px;
  color: #333;
  margin-bottom: 10px;
}

.settings-desc {
  color: #666;
  font-size: 16px;
}

/* 密码验证 */
.password-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.password-box {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
}

.lock-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.password-box h3 {
  font-size: 24px;
  color: #333;
  margin-bottom: 10px;
}

.password-box p {
  color: #666;
  margin-bottom: 30px;
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 10px;
  transition: all 0.3s ease;
}

.password-input:focus {
  outline: none;
  border-color: #4a90e2;
}

.error-message {
  color: #f5222d;
  font-size: 14px;
  margin-bottom: 15px;
}

.verify-btn {
  width: 100%;
  padding: 12px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.verify-btn:hover {
  background: #357abd;
}

/* 设置表单 */
.settings-form {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.form-section {
  margin-bottom: 40px;
  padding-bottom: 30px;
  border-bottom: 1px solid #e0e0e0;
}

.form-section:last-of-type {
  border-bottom: none;
}

.section-title {
  font-size: 20px;
  color: #333;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #4a90e2;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.color-input {
  width: 80px;
  height: 40px;
  padding: 4px;
  cursor: pointer;
}

.color-value {
  display: inline-block;
  margin-left: 10px;
  font-size: 14px;
  color: #666;
  font-family: monospace;
}

.hint {
  font-size: 13px;
  color: #999;
  margin-top: 8px;
}

/* 儿童安全小助手配置 */
.assistant-key-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.key-status {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  background: #f0f0f0;
  color: #666;
}

.key-status.ok {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.key-status.none {
  background: #fff7e6;
  color: #d46b08;
  border: 1px solid #ffd591;
}

.clear-key-btn {
  padding: 8px 14px;
  border: 2px solid #ffa39e;
  border-radius: 8px;
  background: white;
  color: #f5222d;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-key-btn:hover:not(:disabled) {
  background: #fff1f0;
}

.clear-key-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #e0e0e0;
  color: #999;
}

.key-warn {
  color: #d46b08;
}

.assistant-message {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.assistant-message.success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.assistant-message.error {
  background: #fff1f0;
  color: #f5222d;
  border: 1px solid #ffa39e;
}

/* Logo预览 */
.logo-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  padding: 30px;
  background: #f5f7fa;
  border-radius: 12px;
}

.preview-image {
  max-width: 120px;
  max-height: 120px;
  object-fit: contain;
}

.logo-buttons {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
}

.upload-btn,
.reset-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.upload-btn {
  background: #4a90e2;
  color: white;
}

.upload-btn:hover {
  background: #357abd;
}

.reset-btn {
  background: #f0f0f0;
  color: #666;
}

.reset-btn:hover {
  background: #e0e0e0;
}

/* 渐变预览 */
.gradient-preview {
  height: 80px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin-top: 15px;
}

/* 操作按钮 */
.form-actions {
  display: flex;
  gap: 15px;
  margin-top: 30px;
}

.save-btn,
.cancel-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.save-btn {
  background: #52c41a;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #389e0d;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: #f0f0f0;
  color: #666;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.save-message {
  margin-top: 20px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
}

.save-message.success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.save-message.error {
  background: #fff1f0;
  color: #f5222d;
  border: 1px solid #ffa39e;
}
</style>
