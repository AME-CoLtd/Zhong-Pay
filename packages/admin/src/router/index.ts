import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/admin/login',
      name: 'Login',
      component: () => import('@/pages/Login.vue'),
    },
    {
      path: '/admin/forgot-password',
      name: 'ForgotPassword',
      component: () => import('@/pages/ForgotPassword.vue'),
    },
    { path: '/login', redirect: '/admin/login' },
    { path: '/forgot-password', redirect: '/admin/forgot-password' },
    {
      path: '/store',
      name: 'StoreHome',
      component: () => import('@/pages/StoreHome.vue'),
    },
    {
      path: '/store/cart',
      name: 'StoreCart',
      component: () => import('@/pages/StoreCart.vue'),
      meta: { requiresCustomerAuth: true },
    },
    {
      path: '/store/me',
      name: 'StoreUserCenter',
      component: () => import('@/pages/StoreUserCenter.vue'),
      meta: { requiresCustomerAuth: true },
    },
    {
      path: '/store/login',
      name: 'StoreLogin',
      component: () => import('@/pages/StoreLogin.vue'),
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
        { path: 'products',    name: 'Products',    component: () => import('@/pages/Products.vue'), meta: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
        { path: 'config',      name: 'Config',      component: () => import('@/pages/Config.vue'), meta: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
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
    return '/admin/login';
  }

  if (to.meta.requiresCustomerAuth && !localStorage.getItem('zp_customer_token')) {
    return '/store/login';
  }

  const roles = to.meta.roles as string[] | undefined;
  if (roles?.length) {
    const currentRole = auth.admin?.role || '';
    if (!roles.includes(currentRole)) {
      return '/dashboard';
    }
  }
});

router.afterEach((to) => {
  if (to.path.startsWith('/store')) {
    document.title = '众支付 - 商城';
  } else {
    document.title = '众支付 - 管理后台';
  }
});

export default router;
