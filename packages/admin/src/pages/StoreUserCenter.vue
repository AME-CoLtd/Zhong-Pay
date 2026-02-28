<template>
  <div class="min-h-screen bg-gray-50">
    <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">用户中心</h1>
      <div class="flex items-center gap-4 text-sm">
        <router-link to="/store">首页</router-link>
        <router-link to="/store/cart">购物车</router-link>
        <router-link to="/store/me" class="text-blue-600">用户中心</router-link>
      </div>
    </div>

    <div class="max-w-5xl mx-auto p-6 space-y-4">
      <el-card>
        <template #header><span class="font-medium">个人资料</span></template>
        <el-form :model="form" label-width="90px" class="max-w-lg">
          <el-form-item label="用户名"><el-input :model-value="form.username" disabled /></el-form-item>
          <el-form-item label="昵称"><el-input v-model="form.nickname" /></el-form-item>
          <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
          <el-form-item label="手机号"><el-input v-model="form.phone" /></el-form-item>
          <el-form-item><el-button type="primary" @click="saveProfile">保存资料</el-button></el-form-item>
        </el-form>
      </el-card>

      <el-card>
        <template #header><span class="font-medium">我的订单</span></template>
        <el-empty v-if="!orders.length" description="暂无订单" />
        <div v-else class="space-y-4">
          <div v-for="order in orders" :key="order.id" class="border border-gray-100 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2 text-sm">
              <span>订单号：{{ order.orderNo }}</span>
              <el-tag size="small" type="warning">{{ order.status }}</el-tag>
            </div>
            <div class="text-xs text-gray-400 mb-2">{{ order.createdAt }}</div>
            <div v-for="it in order.items" :key="`${order.id}-${it.product_name}`" class="flex justify-between text-sm py-1">
              <span>{{ it.product_name }} × {{ it.quantity }}</span>
              <span>¥{{ Number(it.amount).toFixed(2) }}</span>
            </div>
            <div class="text-right font-semibold mt-2">合计：¥{{ Number(order.totalAmount).toFixed(2) }}</div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import storeRequest from '@/utils/storeRequest';

const form = reactive<any>({ username: '', nickname: '', email: '', phone: '' });
const orders = ref<any[]>([]);

async function fetchProfile() {
  const res: any = await storeRequest.get('/me');
  Object.assign(form, {
    username: res.data.username || '',
    nickname: res.data.nickname || '',
    email: res.data.email || '',
    phone: res.data.phone || '',
  });
}

async function saveProfile() {
  await storeRequest.put('/me', {
    nickname: form.nickname || null,
    email: form.email || null,
    phone: form.phone || null,
  });
  ElMessage.success('保存成功');
}

async function fetchOrders() {
  const res: any = await storeRequest.get('/orders');
  orders.value = res.data;
}

fetchProfile();
fetchOrders();
</script>