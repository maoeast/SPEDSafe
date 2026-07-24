<template>
  <header class="app-header" :style="{ background: headerBackground }">
    <div class="header-content">
      <div class="logo-area">
        <img :src="logoSrc" alt="Logo" class="logo-icon" />
        <h1 class="app-title" :style="titleStyles">{{ appTitle }}</h1>
      </div>
      <div class="header-info">
        <button class="assistant-entry-btn" @click="$emit('open-assistant')">
          <i class="fa-solid fa-shield-heart btn-icon" aria-hidden="true"></i>
          <span class="btn-text">儿童安全小助手</span>
        </button>
        <button class="learning-center-btn" @click="$emit('open-dashboard')">
          <span class="btn-icon">📚</span>
          <span class="btn-text">学习中心</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

const props = defineProps({
  totalResources: {
    type: Number,
    default: 0,
  },
});

defineEmits(["open-dashboard", "open-assistant"]);

const appTitle = ref("特教安全教育资源仪");
const logoSrc = ref("");
const titleStyle = ref({
  fontSize: "36px",
  color: "white",
});
const headerBackground = ref(
  "linear-gradient(135deg, #FF9A56 0%, #FF6B6B 100%)"
);

// 计算标题样式
const titleStyles = computed(() => ({
  fontSize: titleStyle.value.fontSize,
  color: titleStyle.value.color,
}));

// 加载配置
const loadConfig = async () => {
  try {
    // 先加载Logo
    if (window.electronAPI) {
      try {
        const logoUrl = await window.electronAPI.getCoverPath(
          "/assets/icons/logo.png"
        );
        if (logoUrl) {
          logoSrc.value = logoUrl;
        }
      } catch (e) {
        console.warn("Logo加载失败，使用占位:", e);
      }
    }

    const result = await window.electronAPI.getAppConfig();
    if (result.success) {
      appTitle.value = result.config.appTitle;
      titleStyle.value = result.config.titleStyle;
      headerBackground.value = result.config.headerBackground;

      // 自定义logo：使用 data URI（避免 file:// 安全限制）
      if (result.config.logoDataUri) {
        logoSrc.value = result.config.logoDataUri;
      }
    }
  } catch (error) {
    console.error("加载应用配置失败:", error);
  }
};

onMounted(() => {
  loadConfig();
});
</script>

<style scoped>
.app-header {
  /* background 通过动态绑定设置 */
  padding: 20px 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 15px;
}

.logo-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  transition: all 0.2s ease;
  cursor: pointer;
  display: block;
}

.logo-icon:hover {
  transform: scale(1.05);
}

.app-title {
  /* fontSize 和 color 通过动态绑定设置 */
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  letter-spacing: 0;
  transition: all 0.2s ease;
}

.app-title:hover {
  /* 无位移，保持静态 */
}

.header-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.learning-center-btn,
.assistant-entry-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: rgba(255, 255, 255, 0.2);
  padding: 10px 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.learning-center-btn:hover,
.assistant-entry-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-icon {
  font-size: 20px;
}

.btn-text {
  font-size: 16px;
}

.assistant-entry-btn {
  background: rgba(20, 78, 82, 0.38);
}

@media (max-width: 980px) {
  .app-header {
    padding: 16px 22px;
  }

  .logo-area {
    min-width: 0;
  }

  .logo-icon {
    width: 52px;
    height: 52px;
  }

  .app-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .learning-center-btn,
  .assistant-entry-btn {
    padding: 9px 12px;
  }
}

@media (max-width: 760px) {
  .btn-text {
    display: none;
  }

  .learning-center-btn,
  .assistant-entry-btn {
    width: 42px;
    height: 42px;
    justify-content: center;
    padding: 0;
    border-radius: 8px;
  }
}
</style>
