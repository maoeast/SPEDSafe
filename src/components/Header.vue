<template>
  <header class="app-header" :style="{ background: headerBackground }">
    <div class="header-content">
      <div class="logo-area">
        <img :src="logoSrc" alt="Logo" class="logo-icon" />
        <h1 class="app-title" :style="titleStyles">{{ appTitle }}</h1>
      </div>
      <div class="header-info">
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

defineEmits(["open-dashboard"]);

const appTitle = ref("特教安全教育资源仪");
const logoSrc = ref("/icons/logo.png");
const titleStyle = ref({
  fontSize: "36px",
  color: "white",
});
const headerBackground = ref(
  "linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6dd5ed 100%)"
);

// 计算标题样式
const titleStyles = computed(() => ({
  fontSize: titleStyle.value.fontSize,
  color: titleStyle.value.color,
}));

// 加载配置
const loadConfig = async () => {
  try {
    const result = await window.electronAPI.getAppConfig();
    if (result.success) {
      appTitle.value = result.config.appTitle;
      titleStyle.value = result.config.titleStyle;
      headerBackground.value = result.config.headerBackground;

      // 设置Logo
      if (window.electronAPI) {
        // 打包环境：通过HTTP服务器加载
        const logoUrl = await window.electronAPI.getCoverPath(
          "/assets/icons/logo.png"
        );
        logoSrc.value = logoUrl || "/icons/logo.png";
      } else {
        // 开发环境
        logoSrc.value = "/icons/logo.png";
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
  transition: all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  cursor: pointer;
  display: block;
}

.logo-icon:hover {
  transform: rotate(360deg) scale(1.2);
  filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1))
    drop-shadow(0 0 25px rgba(255, 215, 0, 0.8))
    drop-shadow(0 0 35px rgba(255, 215, 0, 0.6));
}

.app-title {
  /* fontSize 和 color 通过动态绑定设置 */
  font-weight: 700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3), 0 0 10px rgba(0, 0, 0, 0.2);
  letter-spacing: 3px;
  transition: all 0.3s ease;
}

.app-title:hover {
  transform: translateY(-2px);
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 0, 0, 0.3);
}

.header-info {
  display: flex;
  align-items: center;
}

.learning-center-btn {
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
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.learning-center-btn:hover {
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
</style>
