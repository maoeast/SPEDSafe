<template>
  <div class="activation-overlay" v-if="showDialog">
    <div class="activation-dialog">
      <!-- 头部 -->
      <div class="dialog-header">
        <div class="header-icon">🔐</div>
        <h2 class="dialog-title">{{ dialogTitle }}</h2>
        <p class="dialog-subtitle">{{ dialogSubtitle }}</p>
      </div>

      <!-- 主体内容 -->
      <div class="dialog-body">
        <!-- 状态信息 -->
        <div class="status-card" :class="`status-${statusType}`">
          <div class="status-icon">{{ statusIcon }}</div>
          <div class="status-text">
            <div class="status-title">{{ statusTitle }}</div>
            <div class="status-desc">{{ statusDesc }}</div>
          </div>
        </div>

        <!-- 机器码显示 -->
        <div class="machine-id-section">
          <label class="section-label">当前机器码</label>
          <div class="machine-id-display">
            <span class="machine-id-text">{{ machineId || "加载中..." }}</span>
            <button class="copy-btn" @click="copyMachineId" v-if="machineId">
              <i class="fa-solid fa-copy"></i>
              {{ copyBtnText }}
            </button>
          </div>
          <p class="section-hint">💡 激活码会绑定此机器码，请妥善保存</p>
        </div>

        <!-- 激活码输入 -->
        <div class="license-input-section">
          <label class="section-label">激活码</label>
          <input
            type="text"
            class="license-input"
            v-model="licenseKey"
            placeholder="请输入激活码，格式：SPED-XXXX-XXXX-XXXX-..."
            :disabled="activating"
            @keyup.enter="handleActivate"
          />
          <p class="section-hint" v-if="errorMessage" style="color: #f56c6c">
            ❌ {{ errorMessage }}
          </p>
        </div>

        <!-- 试用提示已移除，保持界面简洁 -->
      </div>

      <!-- 底部按钮 -->
      <div class="dialog-footer">
        <button
          class="btn-secondary"
          @click="handleSkip"
          v-if="canSkip"
          :disabled="activating"
        >
          <i class="fa-solid fa-clock"></i>
          {{ skipBtnText }}
        </button>
        <button
          class="btn-primary"
          @click="handleActivate"
          :disabled="!licenseKey || activating"
        >
          <i class="fa-solid fa-key"></i>
          {{ activating ? "验证中..." : "激活" }}
        </button>
      </div>

      <!-- 开发模式：重置按钮 -->
      <button
        class="dev-reset-btn"
        @click="handleReset"
        v-if="isDev"
        title="重置激活状态（仅开发模式）"
      >
        🔄
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  activationStatus: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["activated", "skip"]);

const showDialog = ref(false);
const machineId = ref("");
const licenseKey = ref("");
const activating = ref(false);
const errorMessage = ref("");
const copyBtnText = ref("复制");
const isDev = ref(
  !window.electronAPI || process.env.NODE_ENV === "development"
);

// 监听 props.show 的变化
watch(
  () => props.show,
  (newVal) => {
    showDialog.value = newVal;
    if (newVal) {
      loadMachineId();
    }
  },
  { immediate: true }
);

// 计算属性
const dialogTitle = computed(() => {
  if (props.activationStatus.type === "trial_expired") {
    return "试用期已结束";
  }
  if (props.activationStatus.type === "expired") {
    return "激活已过期";
  }
  return "软件激活";
});

const dialogSubtitle = computed(() => {
  return "特教安全教育资源仪 v1.0";
});

const statusType = computed(() => {
  const type = props.activationStatus.type;
  if (type === "trial") return "trial";
  if (type === "trial_expired" || type === "expired") return "expired";
  return "warning";
});

const statusIcon = computed(() => {
  const type = props.activationStatus.type;
  if (type === "trial") return "⏰";
  if (type === "trial_expired" || type === "expired") return "⚠️";
  return "🔒";
});

const statusTitle = computed(() => {
  const type = props.activationStatus.type;
  if (type === "trial") return "试用模式";
  if (type === "trial_expired") return "试用期已结束";
  if (type === "expired") return "激活已过期";
  return "未激活";
});

const statusDesc = computed(() => {
  return props.activationStatus.message || "请输入激活码以继续使用";
});

const showTrialInfo = computed(() => {
  return (
    props.activationStatus.type === "trial" &&
    props.activationStatus.daysRemaining > 0
  );
});

const trialDaysRemaining = computed(() => {
  return props.activationStatus.daysRemaining || 0;
});

const canSkip = computed(() => {
  // 试用期内可以跳过
  return (
    props.activationStatus.type === "trial" &&
    props.activationStatus.daysRemaining > 0
  );
});

const skipBtnText = computed(() => {
  if (props.activationStatus.type === "trial") {
    return `稍后激活（剩余${trialDaysRemaining.value}天）`;
  }
  return "稍后激活";
});

// 方法
const loadMachineId = async () => {
  try {
    const result = await window.electronAPI.getMachineId();
    if (result.success) {
      machineId.value = result.machineId;
    }
  } catch (error) {
    console.error("获取机器码失败:", error);
  }
};

const copyMachineId = () => {
  navigator.clipboard
    .writeText(machineId.value)
    .then(() => {
      copyBtnText.value = "已复制";
      setTimeout(() => {
        copyBtnText.value = "复制";
      }, 2000);
    })
    .catch((err) => {
      console.error("复制失败:", err);
    });
};

const handleActivate = async () => {
  if (!licenseKey.value) {
    errorMessage.value = "请输入激活码";
    return;
  }

  activating.value = true;
  errorMessage.value = "";

  try {
    const result = await window.electronAPI.verifyLicense(
      licenseKey.value.trim()
    );

    if (result.success) {
      // 激活成功
      showDialog.value = false;
      emit("activated", result.data);

      // 显示成功提示
      setTimeout(() => {
        alert(
          `🎉 激活成功！\n\n类型: ${
            result.data.type === "trial" ? "试用版" : "正式版"
          }\n${
            result.data.isPermanent
              ? "有效期: 永久"
              : "有效期: " +
                Math.ceil(
                  (result.data.expireAt - Date.now()) / (24 * 60 * 60 * 1000)
                ) +
                "天"
          }`
        );
      }, 100);
    } else {
      // 激活失败
      errorMessage.value = result.message || "激活失败";
      if (result.details) {
        console.error("激活详情:", result.details);
      }
    }
  } catch (error) {
    errorMessage.value = "激活失败: " + error.message;
    console.error("激活错误:", error);
  } finally {
    activating.value = false;
  }
};

const handleSkip = () => {
  showDialog.value = false;
  emit("skip");
};

const handleReset = async () => {
  if (confirm("确定要重置激活状态吗？（仅开发模式）")) {
    try {
      const result = await window.electronAPI.resetActivation();
      if (result.success) {
        alert("激活状态已重置，请重启应用");
        location.reload();
      }
    } catch (error) {
      console.error("重置失败:", error);
    }
  }
};

// 监听 props.show 变化
onMounted(() => {
  showDialog.value = props.show;
  loadMachineId();
});

// 暴露方法供父组件调用
defineExpose({
  show: () => {
    showDialog.value = true;
    loadMachineId();
  },
  hide: () => {
    showDialog.value = false;
  },
});
</script>

<style scoped>
.activation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.activation-dialog {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.4s ease;
  position: relative;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 头部 */
.dialog-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  text-align: center;
  border-radius: 16px 16px 0 0;
}

.header-icon {
  font-size: 48px;
  margin-bottom: 12px;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.dialog-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.dialog-subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

/* 主体 */
.dialog-body {
  padding: 30px;
}

/* 状态卡片 */
.status-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  border-left: 4px solid;
}

.status-card.status-trial {
  background: #e3f2fd;
  border-color: #2196f3;
}

.status-card.status-expired {
  background: #ffebee;
  border-color: #f44336;
}

.status-card.status-warning {
  background: #fff3e0;
  border-color: #ff9800;
}

.status-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.status-text {
  flex: 1;
}

.status-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.status-desc {
  font-size: 14px;
  color: #666;
}

/* 区块 */
.machine-id-section,
.license-input-section {
  margin-bottom: 24px;
}

.section-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.machine-id-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.machine-id-text {
  flex: 1;
  font-family: "Consolas", "Monaco", monospace;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  letter-spacing: 1px;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.license-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: "Consolas", "Monaco", monospace;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.license-input:focus {
  outline: none;
  border-color: #667eea;
}

.license-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.section-hint {
  font-size: 13px;
  color: #999;
  margin: 8px 0 0 0;
}

/* 试用信息 */
.trial-info {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-top: 20px;
}

.trial-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.trial-text {
  flex: 1;
}

.trial-text strong {
  display: block;
  font-size: 15px;
  color: #333;
  margin-bottom: 8px;
}

.trial-text p {
  font-size: 14px;
  color: #666;
  margin: 0;
  line-height: 1.6;
}

.highlight {
  color: #2196f3;
  font-weight: 600;
}

/* 底部 */
.dialog-footer {
  display: flex;
  gap: 12px;
  padding: 20px 30px 30px;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #666;
  border: 2px solid #e0e0e0;
}

.btn-secondary:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 开发模式重置按钮 */
.dev-reset-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s ease;
}

.dev-reset-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(180deg);
}
</style>
