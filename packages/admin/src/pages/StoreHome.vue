<template>
  <div class="min-h-screen bg-gray-50">
    <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">商城</h1>
      <el-dropdown @command="handleCommand" placement="bottom-end" class="mr-3">
        <span class="el-dropdown-link text-sm text-gray-600 cursor-pointer">
          {{ customer ? (customer.nickname || customer.username) : '菜单' }}
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="home">首页</el-dropdown-item>
            <el-dropdown-item command="cart">购物车</el-dropdown-item>
            <el-dropdown-item command="me">用户中心</el-dropdown-item>
            <el-dropdown-item v-if="!customer" command="login">登录</el-dropdown-item>
            <el-dropdown-item v-else divided command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="max-w-6xl mx-auto p-6">
      <div class="mb-4">
        <el-input v-model="keyword" placeholder="搜索商品" clearable class="max-w-sm" @keyup.enter="fetchProducts">
          <template #append><el-button @click="fetchProducts">搜索</el-button></template>
        </el-input>
      </div>

      <el-row :gutter="16">
        <el-col v-for="item in products" :key="item.id" :xs="24" :sm="12" :md="8" :lg="6" class="mb-4">
          <el-card shadow="hover" class="h-full">
            <img v-if="item.cover" :src="item.cover" class="w-full h-36 object-cover rounded-md mb-3" />
            <div class="font-medium text-gray-800 line-clamp-1">{{ item.name }}</div>
            <div class="text-xs text-gray-400 mt-1 line-clamp-2">{{ item.description || '暂无描述' }}</div>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-red-500 font-semibold">¥{{ Number(item.price).toFixed(2) }}</span>
              <el-button type="primary" size="small" @click="addToCart(item)">加入购物车</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import storeRequest from '@/utils/storeRequest';

const router = useRouter();

const products = ref<any[]>([]);
const keyword = ref('');
const customer = ref<any>(JSON.parse(localStorage.getItem('zp_customer_info') || 'null'));

async function fetchProducts() {
  const res: any = await storeRequest.get('/products', { params: { keyword: keyword.value, page: 1, pageSize: 100 } });
  products.value = res.data.list;
}

async function addToCart(item: any) {
  if (!localStorage.getItem('zp_customer_token')) {
    ElMessage.warning('请先登录后再加入购物车');
    return;
  }
  await storeRequest.post('/cart/items', { productId: item.id, quantity: 1 });
  ElMessage.success('已加入购物车');
}

function handleCommand(cmd: string) {
  if (cmd === 'home') router.push('/store');
  else if (cmd === 'cart') router.push('/store/cart');
  else if (cmd === 'me') router.push('/store/me');
  else if (cmd === 'login') router.push('/store/login');
  else if (cmd === 'logout') {
    localStorage.removeItem('zp_customer_token');
    localStorage.removeItem('zp_customer_info');
    customer.value = null;
    router.push('/store/login');
  }
}

fetchProducts();
</script>