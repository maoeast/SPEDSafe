<template>
  <div class="app-container">
    <!-- 激活对话框 -->
    <ActivationDialog
      :show="showActivationDialog"
      :activationStatus="activationStatus"
      @activated="handleActivated"
      @skip="handleSkipActivation"
      ref="activationDialogRef"
    />

    <!-- 主页面 -->
    <div v-if="currentView === 'home'" class="home-view">
      <Header
        :totalResources="resources.length"
        @open-dashboard="openDashboard"
      />

      <CategoryNav
        :categories="categories"
        :activeCategory="activeCategory"
        @select="handleCategorySelect"
      />
      <ResourceGrid
        :resources="filteredResources"
        @play="handlePlay"
        ref="resourceGridRef"
      />
    </div>

    <!-- 学习中心页面 -->
    <div v-else-if="currentView === 'dashboard'" class="dashboard-view">
      <button class="dashboard-back-btn" @click="closeDashboard">
        <i class="fa-solid fa-home back-icon"></i>
        <span class="back-text">返回</span>
      </button>
      <LearningDashboard
        ref="dashboardRef"
        :categories="categories"
        :allResources="resources"
        @play="handlePlay"
      />
    </div>

    <!-- 播放器页面 -->
    <div v-else-if="currentView === 'player'" class="player-view">
      <Player :resource="currentResource" @back="handleBack" />
    </div>

    <!-- 加载提示 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import Header from "./components/Header.vue";
import CategoryNav from "./components/CategoryNav.vue";
import ResourceGrid from "./components/ResourceGrid.vue";
import Player from "./components/Player.vue";
import LearningDashboard from "./components/LearningDashboard.vue";
import ActivationDialog from "./components/ActivationDialog.vue";

// 七大分类配置
const categories = [
  { id: "school", name: "校园安全", icon: "🏫", color: "#4A90E2" },
  { id: "home", name: "居家安全", icon: "🏠", color: "#FF9500" },
  { id: "community", name: "社区安全", icon: "🏘️", color: "#7ED321" },
  { id: "personal", name: "个人安全", icon: "👤", color: "#9013FE" },
  { id: "drill", name: "安全演习", icon: "🚨", color: "#F5222D" },
  { id: "course", name: "安全课程", icon: "📖", color: "#FAAD14" },
  { id: "soft", name: "安全互动", icon: "🎮", color: "#EB2F96" },
];

const currentView = ref("home");
const activeCategory = ref("school"); // 默认为校园安全
const resources = ref([]);
const currentResource = ref(null);
const loading = ref(false);
const dashboardRef = ref(null);
const resourceGridRef = ref(null);

// 保存每个分类的滚动位置
const scrollPositions = ref({});

// 激活相关
const showActivationDialog = ref(false);
const activationStatus = ref({});
const activationDialogRef = ref(null);

// 过滤后的资源
const filteredResources = computed(() => {
  return resources.value.filter((r) => r.category === activeCategory.value);
});

// 加载资源列表
const loadResources = async () => {
  loading.value = true;
  try {
    const data = await window.electronAPI.loadResources();
    resources.value = data;
  } catch (error) {
    console.error("加载资源失败:", error);
  } finally {
    loading.value = false;
  }
};

// 选择分类
const handleCategorySelect = (categoryId) => {
  // 保存当前分类的滚动位置
  if (resourceGridRef.value) {
    scrollPositions.value[activeCategory.value] =
      resourceGridRef.value.getScrollPosition();
  }

  // 切换分类
  activeCategory.value = categoryId;

  // 恢复新分类的滚动位置
  setTimeout(() => {
    if (resourceGridRef.value) {
      const savedPosition = scrollPositions.value[categoryId];
      if (savedPosition !== undefined) {
        resourceGridRef.value.setScrollPosition(savedPosition);
      } else {
        // 如果没有保存的位置，滚动到顶部
        resourceGridRef.value.setScrollPosition(0);
      }
    }
  }, 50);
};

// 播放资源
const handlePlay = (resourceOrId) => {
  // 保存当前分类的滚动位置
  if (resourceGridRef.value) {
    scrollPositions.value[activeCategory.value] =
      resourceGridRef.value.getScrollPosition();
  }

  // 如果传入的是字符串ID，则查找对应的资源对象
  if (typeof resourceOrId === "string") {
    const resource = resources.value.find((r) => r.id === resourceOrId);
    if (resource) {
      currentResource.value = resource;
      currentView.value = "player";
    } else {
      console.error("未找到资源ID:", resourceOrId);
    }
  } else {
    // 如果传入的是资源对象，直接使用
    currentResource.value = resourceOrId;
    currentView.value = "player";
  }
};

// 打开学习中心
const openDashboard = () => {
  currentView.value = "dashboard";
  // 刷新学习中心数据
  setTimeout(() => {
    if (dashboardRef.value) {
      dashboardRef.value.loadLearningData();
    }
  }, 100);
};

// 关闭学习中心
const closeDashboard = () => {
  currentView.value = "home";
};

// 继续学习
const continueLearning = (resourceId) => {
  const resource = resources.value.find((r) => r.id === resourceId);
  if (resource) {
    handlePlay(resource);
  }
};

// 返回主页
const handleBack = () => {
  currentView.value = "home";
  currentResource.value = null;

  // 刷新资源网格数据并恢复滚动位置
  setTimeout(() => {
    if (resourceGridRef.value) {
      resourceGridRef.value.loadLearningRecords();
      // 恢复当前分类的滚动位置
      const savedPosition = scrollPositions.value[activeCategory.value];
      if (savedPosition !== undefined) {
        resourceGridRef.value.setScrollPosition(savedPosition);
      }
    }
  }, 100);
};

onMounted(() => {
  loadResources();
  checkActivationStatus();
});

// ===== 激活系统 =====

// 检查激活状态
const checkActivationStatus = async () => {
  try {
    const status = await window.electronAPI.getActivationStatus();
    activationStatus.value = status;

    console.log("🔐 激活状态:", status);

    // 如果未激活且试用期已结束，强制显示激活对话框
    if (!status.activated && status.type === "trial_expired") {
      setTimeout(() => {
        showActivationDialog.value = true;
      }, 500);
    }
    // 如果在试用期，提示但不强制
    else if (!status.activated && status.type === "trial") {
      setTimeout(() => {
        showActivationDialog.value = true;
      }, 500);
    }
  } catch (error) {
    console.error("检查激活状态失败:", error);
  }
};

// 激活成功
const handleActivated = async (data) => {
  console.log("✅ 激活成功:", data);
  showActivationDialog.value = false;
  // 重新检查激活状态
  await checkActivationStatus();
};

// 跳过激活（试用期内）
const handleSkipActivation = () => {
  console.log("⏸️ 跳过激活，继续试用");
  showActivationDialog.value = false;
};
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.home-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.player-view,
.dashboard-view {
  width: 100%;
  height: 100%;
  overflow-y: auto; /* 允许垂直滚动 */
  background: #f5f7fa; /* 背景颜色 */
}

.dashboard-back-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.dashboard-back-btn:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateX(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dashboard-back-btn:active {
  background: #ffa726;
  transform: translateX(-3px) scale(0.98);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.back-icon {
  font-size: 16px;
}

.back-text {
  font-size: 13px;
  font-weight: 500;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4a90e2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: white;
  font-size: 18px;
  margin-top: 20px;
  font-weight: 500;
}
</style>
