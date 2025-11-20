<template>
  <header class="app-header">
    <div class="header-content">
      <div class="logo-area">
        <img src="/icons/logo.png" alt="Logo" class="logo-icon" />
        <h1 class="app-title">特教安全教育资源仪</h1>
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
import { computed } from "vue";

const props = defineProps({
  totalResources: {
    type: Number,
    default: 0,
  },
});

defineEmits(["open-dashboard"]);
</script>

<style scoped>
.app-header {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6dd5ed 100%);
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
  width: 48px;
  height: 48px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.app-title {
  font-size: 28px;
  font-weight: 600;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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
