import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/pages/Login.vue'),
    },
    {
      path: '/forgot-password',
      name: 'ForgotPassword',
      component: () => import('@/pages/ForgotPassword.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard',   name: 'Dashboard',   component: () => import('@/pages/Dashboard.vue') },
        { path: 'orders',      name: 'Orders',      component: () => import('@/pages/Orders.vue') },
        { path: 'merchants',   name: 'Merchants',   component: () => import('@/pages/Merchants.vue') },
        { path: 'withdrawals', name: 'Withdrawals', component: () => import('@/pages/Withdrawals.vue') },
        { path: 'config',      name: 'Config',      component: () => import('@/pages/Config.vue') },
        { path: 'admins',      name: 'Admins',      component: () => import('@/pages/AdminUsers.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'profile',     name: 'Profile',     component: () => import('@/pages/Profile.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.token) {
    return '/login';
  }

  const roles = to.meta.roles as string[] | undefined;
  if (roles?.length) {
    const currentRole = auth.admin?.role || '';
    if (!roles.includes(currentRole)) {
      return '/dashboard';
    }
  }
});

export default router;
