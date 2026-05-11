<template>
  <div class="resource-grid-container" ref="containerRef">
    <div class="grid-content">
      <div v-if="resources.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">暂无资源</div>
      </div>

      <div v-else class="resource-grid">
        <div
          v-for="resource in resources"
          :key="resource.id"
          class="resource-card"
          @click="$emit('play', resource)"
        >
          <div class="card-cover">
            <img
              v-if="resource.coverUrl"
              :src="coverImages[resource.id] || getImagePath(resource.coverUrl)"
              :alt="resource.title"
              class="cover-image"
            />
            <div v-else class="cover-placeholder">
              <span class="placeholder-icon">{{
                resource.type === "video" ? "🎬" : "📄"
              }}</span>
            </div>

            <!-- 类型标签 -->
            <div class="type-badge" :class="resource.type">
              {{ resource.type === "video" ? "视频" : "H5" }}
            </div>

            <!-- 播放图标 -->
            <div class="play-overlay">
              <div class="play-button">
                <span class="play-icon">▶</span>
              </div>
            </div>
          </div>

          <div class="card-info">
            <h3 class="resource-title">{{ resource.title }}</h3>
            <p class="resource-desc">{{ resource.description }}</p>
            <div class="card-meta">
              <span
                v-if="resource.type === 'video' && resource.duration"
                class="meta-item"
              >
                ⏱️ {{ formatDuration(resource.duration) }}
              </span>
              <span class="meta-item">
                👁️ {{ getViewCount(resource.id) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";

const props = defineProps({
  resources: {
    type: Array,
    default: () => [],
  },
});

defineEmits(["play"]);

const learningRecords = ref({});
const containerRef = ref(null);
const coverImages = ref({});

// 加载封面图片路径
const loadCoverImages = async () => {
  if (window.electronAPI && props.resources) {
    for (const resource of props.resources) {
      if (resource.coverUrl) {
        try {
          const coverPath = await window.electronAPI.getCoverPath(
            resource.coverUrl
          );
          if (coverPath) {
            coverImages.value[resource.id] = coverPath;
          }
        } catch (error) {
          console.error("获取封面路径失败:", error);
        }
      }
    }
  }
};

// 监听 resources 变化
watch(
  () => props.resources,
  () => {
    loadCoverImages();
  },
  { immediate: true }
);

// 获取滚动位置
const getScrollPosition = () => {
  if (containerRef.value) {
    return containerRef.value.scrollTop;
  }
  return 0;
};

// 设置滚动位置
const setScrollPosition = (position) => {
  if (containerRef.value) {
    containerRef.value.scrollTop = position;
  }
};

// 加载学习记录
const loadLearningRecords = async () => {
  try {
    const records = await window.electronAPI.getAllLearningRecords();
    learningRecords.value = records;
  } catch (error) {
    console.error("加载学习记录失败:", error);
  }
};

// 获取观看次数
const getViewCount = (resourceId) => {
  const record = learningRecords.value[resourceId];
  return record ? record.viewCount : 0;
};

// 获取图片路径（开发环境）
const getImagePath = (coverUrl) => {
  // 开发环境直接使用相对路径
  if (!window.electronAPI) {
    return coverUrl.replace("/assets/", "/src/assets/");
  }
  // 打包环境由 coverImages 提供完整路径
  return "";
};

// 格式化时长
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

onMounted(() => {
  loadLearningRecords();
});

// 暴露给父组件调用
defineExpose({
  loadLearningRecords,
  getScrollPosition,
  setScrollPosition,
});
</script>

<style scoped>
.resource-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 30px 40px;
  background: #FFF8F0;
}

.grid-content {
  max-width: 1400px;
  margin: 0 auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-text {
  font-size: 20px;
  color: #999;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.resource-card {
  background: white;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.1);
}

.resource-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.18);
}

.card-cover {
  position: relative;
  width: 100%;
  padding-top: 66.67%; /* 3:2 比例 */
  background: #F5F5F5;
  overflow: hidden;
}

.cover-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 64px;
  opacity: 0.5;
}

.type-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.type-badge.video {
  background: rgba(74, 144, 226, 0.9);
  color: white;
}

.type-badge.h5 {
  background: rgba(126, 211, 33, 0.9);
  color: white;
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
}

.resource-card:hover .play-overlay {
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.play-button {
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: scale(0.8);
  transition: all 0.3s ease;
}

.resource-card:hover .play-button {
  transform: scale(1);
}

.play-icon {
  color: #4a90e2;
  font-size: 24px;
  margin-left: 4px;
}

.card-info {
  padding: 16px;
}

.resource-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-desc {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 42px;
}

.card-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #999;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
