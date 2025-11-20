<template>
  <div class="player-container">
    <!-- 视频播放器 -->
    <div v-if="resource.type === 'video'" class="video-player">
      <button class="back-button" @click="$emit('back')">
        <i class="fa-solid fa-home back-icon"></i>
        <span class="back-text">返回</span>
      </button>

      <div class="video-wrapper">
        <video
          ref="videoEl"
          class="video-element"
          :src="videoSrc"
          controls
          controlsList="nodownload"
          @contextmenu.prevent
          @loadedmetadata="handleVideoLoaded"
          @timeupdate="handleVideoProgress"
          @error="handleVideoError"
        ></video>
      </div>
    </div>

    <!-- H5播放器 -->
    <div v-else-if="resource.type === 'h5'" class="h5-player">
      <button class="back-button" @click="$emit('back')">
        <i class="fa-solid fa-home back-icon"></i>
        <span class="back-text">返回</span>
      </button>

      <div class="h5-wrapper">
        <iframe
          ref="iframeEl"
          class="h5-iframe"
          :src="h5Src"
          frameborder="0"
          allowfullscreen
          @load="handleH5Loaded"
        ></iframe>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="player-loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="player-error">
      <div class="error-icon">⚠️</div>
      <div class="error-text">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
  resource: {
    type: Object,
    required: true,
  },
});

defineEmits(["back"]);

const videoEl = ref(null);
const iframeEl = ref(null);
const videoSrc = ref("");
const h5Src = ref("");
const loading = ref(true);
const error = ref("");
const startTime = ref(Date.now());
const lastProgress = ref(0);

// 加载视频
const loadVideo = async () => {
  try {
    loading.value = true;
    error.value = "";

    // 获取视频文件路径
    const filePath = props.resource.filePath;
    const fullPath = await window.electronAPI.getVideoPath(filePath);

    if (!fullPath) {
      throw new Error("无法获取视频路径");
    }

    // 使用local协议加载视频
    videoSrc.value = `local://${fullPath}`;

    // 立即记录一次（观看次数+1）
    saveInitialRecord();
  } catch (err) {
    console.error("加载视频失败:", err);
    error.value = "视频加载失败，请重试";
    loading.value = false;
  }
};

// 加载H5资源
const loadH5 = async () => {
  try {
    loading.value = true;
    error.value = "";

    const filePath = props.resource.filePath;
    const fullPath = await window.electronAPI.getH5Path(filePath);

    if (!fullPath) {
      throw new Error("无法获取H5资源路径");
    }

    // 使用local协议加载H5资源
    h5Src.value = fullPath.replace("file://", "local://");

    // 立即记录一次（观看次数+1）
    saveInitialRecord();
  } catch (err) {
    console.error("加载H5资源失败:", err);
    error.value = "H5资源加载失败，请重试";
    loading.value = false;
  }
};

// 视频加载完成
const handleVideoLoaded = () => {
  loading.value = false;
  // 自动播放
  if (videoEl.value) {
    videoEl.value.play().catch((err) => {
      console.log("自动播放失败:", err);
    });
  }

  // 记录开始观看
  startTime.value = Date.now();
};

// 视频进度更新
const handleVideoProgress = () => {
  if (videoEl.value) {
    const progress = (videoEl.value.currentTime / videoEl.value.duration) * 100;
    lastProgress.value = Math.round(progress);
  }
};

// 视频加载错误
const handleVideoError = (e) => {
  console.error("视频播放错误:", e);
  error.value = "视频格式不支持或文件损坏";
  loading.value = false;
};

// H5加载完成
const handleH5Loaded = () => {
  loading.value = false;
};

// 初始记录（立即保存，增加观看次数）
const saveInitialRecord = async () => {
  try {
    await window.electronAPI.saveLearningRecord({
      resourceId: props.resource.id,
      title: props.resource.title,
      type: props.resource.type,
      category: props.resource.category,
      duration: 0,
      progress: 0,
    });
    console.log("✅ 学习记录已保存");
  } catch (error) {
    console.error("保存初始记录失败:", error);
  }
};

// 保存学习记录（退出时更新时长和进度）
const saveLearningRecord = async (progress = 0) => {
  try {
    const duration = Math.floor((Date.now() - startTime.value) / 1000);

    // 只有观看时间超过3秒才更新时长
    if (duration < 3) {
      return;
    }

    await window.electronAPI.saveLearningRecord({
      resourceId: props.resource.id,
      title: props.resource.title,
      type: props.resource.type,
      category: props.resource.category,
      duration,
      progress,
      isUpdate: true, // 标记这是更新操作，不增加观看次数
    });
    console.log(`✅ 更新学习时长: ${duration}秒, 进度: ${progress}%`);
  } catch (error) {
    console.error("保存学习记录失败:", error);
  }
};

// 禁用快捷键
const handleKeyDown = (e) => {
  // 禁止F12、Ctrl+Shift+I等开发者工具快捷键
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && e.key === "I") ||
    (e.ctrlKey && e.shiftKey && e.key === "J") ||
    (e.ctrlKey && e.key === "U")
  ) {
    e.preventDefault();
    return false;
  }
};

onMounted(() => {
  if (props.resource.type === "video") {
    loadVideo();
  } else if (props.resource.type === "h5") {
    loadH5();
  }

  // 添加键盘事件监听
  document.addEventListener("keydown", handleKeyDown);

  // 记录开始时间
  startTime.value = Date.now();
});

onUnmounted(() => {
  // 保存学习记录
  if (props.resource.type === "video") {
    saveLearningRecord(lastProgress.value);
  }

  // 清理
  if (videoEl.value) {
    videoEl.value.pause();
    videoEl.value.src = "";
  }

  document.removeEventListener("keydown", handleKeyDown);
});
</script>

<style scoped>
.player-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  flex-direction: column;
}

.back-button {
  position: absolute;
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

.back-button:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateX(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.back-button:active {
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

.video-player,
.h5-player {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.video-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.video-element {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.h5-wrapper {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  background: #000;
}

.h5-iframe {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background: #000;
  border: none;
}

.player-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
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
  font-weight: 500;
}

.player-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.error-icon {
  font-size: 64px;
}

.error-text {
  color: white;
  font-size: 18px;
  text-align: center;
}
</style>
