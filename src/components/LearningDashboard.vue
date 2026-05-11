<template>
  <div class="dashboard-container">
    <!-- 顶部数据卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-value">{{ statistics.totalViews }}</div>
        <div class="stat-label">已学习</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-value">
          {{ formatTime(statistics.totalLearningTime) }}
        </div>
        <div class="stat-label">学习时长</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⭐</div>
        <div class="stat-value">{{ achievements.length }}</div>
        <div class="stat-label">获得徽章</div>
      </div>
    </div>

    <!-- 设置弹窗 -->
    <div
      v-if="showSettings"
      class="settings-modal"
      @click.self="showSettings = false"
    >
      <div class="settings-content">
        <button class="close-btn" @click="showSettings = false">×</button>
        <AppSettings
          @close="showSettings = false"
          @updated="handleSettingsUpdated"
        />
      </div>
    </div>

    <!-- 最近学习 + 学习进度 并列显示 -->
    <div class="learning-overview">
      <!-- 最近学习 -->
      <div class="recent-section">
        <h3 class="section-title">🕐 最近学习</h3>
        <div v-if="recentRecords.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">还没有学习记录哦</div>
        </div>
        <div v-else class="recent-list">
          <div
            v-for="record in recentRecords"
            :key="record.resourceId"
            class="recent-item"
            @click="$emit('play', record.resourceId)"
          >
            <div class="recent-icon">
              {{ record.type === "video" ? "🎬" : "📄" }}
            </div>
            <div class="recent-info">
              <div class="recent-title">{{ record.title }}</div>
              <div class="recent-meta">
                {{ formatDate(record.lastViewedAt) }} · 学习{{
                  record.viewCount
                }}次
              </div>
            </div>
            <div class="recent-progress">
              <div v-if="record.type === 'video'" class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: record.lastProgress + '%' }"
                ></div>
              </div>
              <div v-else class="completion-badge">✓ 已完成</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分类进度 -->
      <div class="category-section">
        <h3 class="section-title">📈 学习进度</h3>
        <div class="category-list">
          <div
            v-for="cat in categoryProgress"
            :key="cat.id"
            class="category-item"
          >
            <div class="category-header">
              <span class="category-icon">{{ cat.icon }}</span>
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-count"
                >{{ cat.learned }}/{{ cat.total }}</span
              >
            </div>
            <div class="category-bar">
              <div
                class="category-fill"
                :style="{
                  width: cat.percent + '%',
                  background: cat.color,
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 成就徽章 -->
    <div class="achievement-section">
      <h3 class="section-title">🏆 我的成就</h3>
      <div class="achievement-list">
        <div
          v-for="achievement in allAchievements"
          :key="achievement.id"
          class="achievement-item"
          :class="{ unlocked: achievement.unlocked }"
        >
          <div class="achievement-icon">{{ achievement.icon }}</div>
          <div class="achievement-info">
            <div class="achievement-title">{{ achievement.title }}</div>
            <div class="achievement-desc">{{ achievement.desc }}</div>
          </div>
          <div v-if="achievement.unlocked" class="achievement-badge">✓</div>
        </div>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div class="action-buttons">
      <button class="settings-btn" @click="showSettings = true">
        <span class="btn-icon">⚙️</span>
        <span class="btn-text">应用设置</span>
      </button>
      <button class="clear-btn" @click="handleClearRecords">
        <span class="btn-icon">🗑️</span>
        <span class="btn-text">清除记录</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import AppSettings from "./AppSettings.vue";

const props = defineProps({
  categories: {
    type: Array,
    required: true,
  },
  allResources: {
    type: Array,
    required: true,
  },
});

defineEmits(["play"]);

const statistics = ref({
  totalViews: 0,
  totalLearningTime: 0,
  lastActiveDate: null,
});

const records = ref({});
const showSettings = ref(false);

// 处理设置更新
const handleSettingsUpdated = () => {
  showSettings.value = false;
};

// 加载学习数据
const loadLearningData = async () => {
  try {
    const [stats, allRecords] = await Promise.all([
      window.electronAPI.getLearningStatistics(),
      window.electronAPI.getAllLearningRecords(),
    ]);

    statistics.value = stats;
    records.value = allRecords;
  } catch (error) {
    console.error("加载学习数据失败:", error);
  }
};

// 最近学习记录（最多5条）
const recentRecords = computed(() => {
  return Object.values(records.value)
    .sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))
    .slice(0, 5);
});

// 分类进度
const categoryProgress = computed(() => {
  return props.categories.map((cat) => {
    const total = props.allResources.filter(
      (r) => r.category === cat.id
    ).length;
    const learned = Object.values(records.value).filter(
      (r) => r.category === cat.id
    ).length;

    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      total,
      learned,
      percent: total > 0 ? Math.round((learned / total) * 100) : 0,
    };
  });
});

// 成就系统
const achievements = computed(() => {
  const unlocked = [];
  const totalViews = statistics.value.totalViews;
  const totalTime = statistics.value.totalLearningTime;

  if (totalViews >= 5)
    unlocked.push({ id: "beginner", icon: "🥇", title: "初学者" });
  if (totalViews >= 20)
    unlocked.push({ id: "student", icon: "🥈", title: "好学生" });
  if (totalViews >= 50)
    unlocked.push({ id: "master", icon: "🥉", title: "学霸" });
  if (totalTime >= 3600)
    unlocked.push({ id: "time10h", icon: "⏰", title: "十小时达人" });

  // 检查是否完成某个分类
  categoryProgress.value.forEach((cat) => {
    if (cat.percent === 100) {
      unlocked.push({
        id: `complete_${cat.id}`,
        icon: cat.icon,
        title: `${cat.name}小卫士`,
      });
    }
  });

  return unlocked;
});

const allAchievements = computed(() => {
  const all = [
    {
      id: "beginner",
      icon: "🥇",
      title: "初学者",
      desc: "观看5个资源",
      unlocked: false,
    },
    {
      id: "student",
      icon: "🥈",
      title: "好学生",
      desc: "观看20个资源",
      unlocked: false,
    },
    {
      id: "master",
      icon: "🥉",
      title: "学霸",
      desc: "观看50个资源",
      unlocked: false,
    },
    {
      id: "time10h",
      icon: "⏰",
      title: "十小时达人",
      desc: "累计学习10小时",
      unlocked: false,
    },
  ];

  // 标记已解锁的成就
  achievements.value.forEach((unlocked) => {
    const achievement = all.find((a) => a.id === unlocked.id);
    if (achievement) achievement.unlocked = true;
  });

  return all;
});

// 格式化时间
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}小时${minutes}分`;
  }
  return `${minutes}分钟`;
};

// 格式化日期
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString("zh-CN");
};

// 清空学习记录
const handleClearRecords = async () => {
  const confirmed = confirm(
    "确定要清空所有学习记录吗？\n\n此操作将删除：\n• 所有观看历史\n• 学习时长统计\n• 已获得的成就徽章\n\n此操作不可恢复！"
  );

  if (!confirmed) return;

  try {
    await window.electronAPI.clearLearningRecords();

    // 重新加载数据
    await loadLearningData();

    alert("✅ 学习记录已清空");
  } catch (error) {
    console.error("清空记录失败:", error);
    alert("❌ 清空失败，请重试");
  }
};

onMounted(() => {
  loadLearningData();
});

// 暴露给父组件调用
defineExpose({
  loadLearningData,
});
</script>

<style scoped>
.dashboard-container {
  padding: 80px 20px 40px; /* 顶部留出返回按钮空间 */
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%; /* 确保容器至少和父元素一样高 */
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: #FFFFFF;
  color: #333;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(255,107,107,0.1);
  transition: box-shadow 0.3s ease;
  border: 1px solid rgba(255,107,107,0.08);
}

.stat-card:hover {
  box-shadow: 0 6px 20px rgba(255,107,107,0.18);
}

.stat-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #FF6B6B;
}

.stat-label {
  font-size: 14px;
  color: #999;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

/* 最近学习和学习进度并列容器 */
.learning-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.recent-section,
.category-section {
  background: white;
  padding: 24px;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(255,107,107,0.1);
}

.achievement-section {
  background: white;
  padding: 24px;
  border-radius: 14px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(255,107,107,0.1);
}

/* 响应式：小屏幕时上下排列 */
@media (max-width: 768px) {
  .learning-overview {
    grid-template-columns: 1fr;
  }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  color: #999;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #FFF8F0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recent-item:hover {
  background: #FFF0E0;
}

.recent-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.recent-info {
  flex: 1;
  min-width: 0;
}

.recent-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.recent-meta {
  font-size: 13px;
  color: #999;
}

.recent-progress {
  flex-shrink: 0;
}

.progress-bar {
  width: 100px;
  height: 8px;
  background: #FFF0E0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #FF9A56;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.completion-badge {
  font-size: 14px;
  color: #FF9A56;
  font-weight: 600;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}

.category-icon {
  font-size: 20px;
}

.category-name {
  flex: 1;
  font-weight: 600;
  color: #333;
}

.category-count {
  color: #999;
  font-size: 14px;
}

.category-bar {
  height: 12px;
  background: #FFF0E0;
  border-radius: 6px;
  overflow: hidden;
}

.category-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
}

.achievement-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.achievement-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #FFF8F0;
  border-radius: 12px;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.achievement-item.unlocked {
  opacity: 1;
  background: #FFFFFF;
  border-left: 4px solid #FF9A56;
  box-shadow: 0 2px 8px rgba(255,107,107,0.1);
}

.achievement-icon {
  font-size: 36px;
}

.achievement-info {
  flex: 1;
}

.achievement-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.achievement-desc {
  font-size: 13px;
  color: #666;
}

.achievement-badge {
  font-size: 24px;
  color: #FF9A56;
}

/* 底部操作按钮区域 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 40px 20px;
}

.settings-btn,
.clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.settings-btn {
  background: #FF9A56;
  box-shadow: 0 2px 8px rgba(255,154,86,0.3);
}

.settings-btn:hover {
  background: #E88B4A;
  box-shadow: 0 4px 12px rgba(255,154,86,0.4);
}

.clear-btn {
  background: #FF6B6B;
  box-shadow: 0 2px 8px rgba(255,107,107,0.3);
}

.clear-btn:hover {
  background: #E55A5A;
  box-shadow: 0 4px 12px rgba(255,107,107,0.4);
}

.settings-btn:active,
.clear-btn:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 18px;
}

.btn-text {
  font-size: 15px;
}

/* 设置弹窗 */
.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
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

.settings-content {
  position: relative;
  background: white;
  border-radius: 20px;
  max-width: 900px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
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

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  color: #666;
  font-size: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.15);
  color: #333;
}
</style>
