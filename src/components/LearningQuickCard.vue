<template>
  <div class="quick-card" @click="$emit('open-dashboard')">
    <div class="card-header">
      <h3 class="card-title">📚 今日学习</h3>
      <span class="view-all">查看全部 →</span>
    </div>

    <div class="card-stats">
      <div class="stat-item">
        <span class="stat-label">已学习</span>
        <span class="stat-value">{{ statistics.totalViews }}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">学习时长</span>
        <span class="stat-value">{{
          formatTime(statistics.totalLearningTime)
        }}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">获得徽章</span>
        <span class="stat-value">{{ achievementCount }}</span>
      </div>
    </div>

    <div v-if="lastRecord" class="last-learning">
      <div class="last-label">继续学习</div>
      <div
        class="last-resource"
        @click.stop="$emit('continue-learning', lastRecord.resourceId)"
      >
        <span class="last-icon">{{
          lastRecord.type === "video" ? "🎬" : "📄"
        }}</span>
        <span class="last-title">{{ lastRecord.title }}</span>
        <span class="last-time">{{ formatDate(lastRecord.lastViewedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

defineEmits(["open-dashboard", "continue-learning"]);

const statistics = ref({
  totalViews: 0,
  totalLearningTime: 0,
});

const lastRecord = ref(null);

const achievementCount = computed(() => {
  let count = 0;
  const views = statistics.value.totalViews;
  const time = statistics.value.totalLearningTime;

  if (views >= 5) count++;
  if (views >= 20) count++;
  if (views >= 50) count++;
  if (time >= 3600) count++;

  return count;
});

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;

  return "昨天";
};

const loadData = async () => {
  try {
    const [stats, records] = await Promise.all([
      window.electronAPI.getLearningStatistics(),
      window.electronAPI.getAllLearningRecords(),
    ]);

    statistics.value = stats;

    // 获取最后学习的资源
    const recordsList = Object.values(records);
    if (recordsList.length > 0) {
      lastRecord.value = recordsList.sort(
        (a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt)
      )[0];
    }
  } catch (error) {
    console.error("加载学习数据失败:", error);
  }
};

onMounted(() => {
  loadData();
});

// 暴露给父组件调用
defineExpose({
  loadData,
});
</script>

<style scoped>
.quick-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.quick-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: white;
  margin: 0;
}

.view-all {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.card-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: rgba(255, 255, 255, 0.15);
  padding: 16px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.3);
}

.last-learning {
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.last-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 8px;
}

.last-resource {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.last-resource:hover {
  background: rgba(255, 255, 255, 0.25);
}

.last-icon {
  font-size: 20px;
}

.last-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.last-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}
</style>
