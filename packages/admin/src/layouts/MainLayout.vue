<template>
  <el-container class="h-screen">
    <!-- 侧边栏 -->
    <el-aside
      :width="collapsed ? '64px' : '220px'"
      class="sidebar transition-all duration-300 flex flex-col"
    >
      <!-- Logo -->
      <div
        class="flex items-center justify-center h-16 border-b border-white/10 flex-shrink-0 overflow-hidden px-3"
      >
        <!-- 折叠：方形高清图标 -->
        <img
          v-if="collapsed"
          src="/logo-icon.png"
          alt="众支付"
          style="width:36px;height:36px;object-fit:contain"
          class="transition-all duration-300"
        />
        <!-- 展开：横版 logo -->
        <img
          v-else
          src="/bt-logo-white.png"
          alt="众支付"
          style="max-width:160px;height:36px;object-fit:contain;image-rendering:-webkit-optimize-contrast"
          class="transition-all duration-300"
        />
      </div>

      <!-- 菜单 -->
      <el-menu
        :default-active="route.path"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        background-color="transparent"
        text-color="rgba(255,255,255,0.75)"
        active-text-color="#ffffff"
        class="flex-1 border-none mt-2"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.label }}</template>
        </el-menu-item>
      </el-menu>

      <!-- 折叠按钮 -->
      <div
        class="flex items-center justify-center h-12 cursor-pointer text-white/40 hover:text-white/80 border-t border-white/10 transition-colors flex-shrink-0"
        @click="collapsed = !collapsed"
      >
        <el-icon :size="16"><component :is="collapsed ? 'Expand' : 'Fold'" /></el-icon>
      </div>
    </el-aside>

    <el-container class="flex flex-col overflow-hidden">
      <!-- 顶栏 -->
      <el-header
        height="56px"
        class="topbar flex items-center justify-between bg-white shadow-sm px-6 flex-shrink-0"
      >
        <!-- 面包屑 -->
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>{{ currentPageName }}</el-breadcrumb-item>
        </el-breadcrumb>

        <!-- 用户信息 -->
        <el-dropdown @command="handleCommand">
          <div class="flex items-center gap-2 cursor-pointer px-3 py-1 rounded-lg hover:bg-gray-50 transition-colors">
            <el-avatar :size="30" class="user-avatar">
              {{ auth.admin?.username?.charAt(0).toUpperCase() }}
            </el-avatar>
            <span class="text-sm font-medium text-gray-700">{{ auth.admin?.username }}</span>
            <el-tag size="small" type="primary" effect="light">{{ roleText }}</el-tag>
            <el-icon class="text-gray-400"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon> 个人设置
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <el-icon><SwitchButton /></el-icon>
                <span class="text-red-500">退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <!-- 内容区 -->
      <el-main class="overflow-auto bg-gray-50 p-6">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route  = useRoute();
const router = useRouter();
const auth   = useAuthStore();

const collapsed = ref(false);

const menuItems = [
  { path: '/dashboard',   label: '数据总览',  icon: 'DataAnalysis' },
  { path: '/orders',      label: '订单管理',  icon: 'ShoppingCart' },
  { path: '/merchants',   label: '商户管理',  icon: 'Shop' },
  { path: '/withdrawals', label: '提现管理',  icon: 'Wallet' },
  { path: '/config',      label: '系统配置',  icon: 'Setting' },
];

const pageNameMap: Record<string, string> = {
  '/dashboard':   '数据总览',
  '/orders':      '订单管理',
  '/merchants':   '商户管理',
  '/withdrawals': '提现管理',
  '/config':      '系统配置',
  '/profile':     '个人设置',
};

const currentPageName = computed(() => pageNameMap[route.path] ?? '');

const roleText = computed(() => {
  const r = auth.admin?.role;
  if (r === 'SUPER_ADMIN') return '超级管理员';
  if (r === 'ADMIN') return '管理员';
  return '员工';
});

function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  } else if (cmd === 'profile') {
    router.push('/profile');
  }
}
</script>

<style scoped>
.sidebar {
  background: linear-gradient(180deg, #001529 0%, #002140 100%);
  overflow: hidden;
}

.topbar {
  border-bottom: 1px solid #f0f0f0;
}

.user-avatar {
  background-color: #409eff;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 菜单项：图标严格居中，悬停/激活样式 */
:deep(.el-menu-item) {
  border-radius: 6px;
  margin: 2px 8px;
  height: 44px;
  display: flex;
  align-items: center;
  cursor: pointer;
}
:deep(.el-menu--collapse .el-menu-item) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  margin: 2px 4px !important;
  width: calc(100% - 8px) !important;
}
:deep(.el-menu--collapse .el-menu-item .el-icon) {
  margin: 0 !important;
  width: 20px !important;
  height: 20px !important;
}
:deep(.el-menu-item.is-active) {
  background-color: #409eff !important;
}
:deep(.el-menu-item:hover) {
  background-color: rgba(255,255,255,0.10) !important;
}
/* 移除 collapse tooltip 的黑色边框 */
:deep(.el-menu--collapse .el-tooltip__trigger) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
}
</style>
