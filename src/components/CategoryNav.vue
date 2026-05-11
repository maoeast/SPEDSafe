<template>
  <nav class="category-nav">
    <div class="nav-content">
      <!-- 七大分类 -->
      <button
        v-for="category in categories"
        :key="category.id"
        class="category-btn"
        :class="{ active: activeCategory === category.id }"
        :style="{ '--category-color': category.color }"
        @click="$emit('select', category.id)"
      >
        <span class="category-icon">{{ category.icon }}</span>
        <span class="category-name">{{ category.name }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  categories: {
    type: Array,
    required: true,
  },
  activeCategory: {
    type: String,
    default: "school", // 默认为校园安全
  },
});

defineEmits(["select"]);
</script>

<style scoped>
.category-nav {
  background: white;
  padding: 20px 40px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.nav-content {
  display: flex;
  gap: 12px;
  max-width: 1400px;
  margin: 0 auto;
  flex-wrap: wrap;
}

.category-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #f5f7fa;
  border: 2px solid transparent;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  min-width: 140px;
  justify-content: center;
}

.category-btn:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background: white;
}

.category-btn.active {
  background: var(--category-color, #4a90e2);
  color: white;
  border-color: var(--category-color, #4a90e2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.category-icon {
  font-size: 24px;
}

.category-name {
  font-size: 16px;
  font-weight: 600;
}
</style>
