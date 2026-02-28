<template>
  <div class="min-h-screen bg-gray-50">
    <div class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">购物车</h1>
      <div class="flex items-center gap-4 text-sm">
        <router-link to="/store">首页</router-link>
        <router-link to="/store/cart" class="text-blue-600">购物车</router-link>
        <router-link to="/store/me">用户中心</router-link>
      </div>
    </div>

    <div class="max-w-5xl mx-auto p-6">
      <el-card>
        <el-table :data="list" v-loading="loading">
          <el-table-column label="商品" min-width="220">
            <template #default="{ row }">
              <div class="flex items-center gap-3">
                <img v-if="row.cover" :src="row.cover" class="w-12 h-12 object-cover rounded" />
                <div>{{ row.name }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="单价" width="120">
            <template #default="{ row }">¥{{ Number(row.priceSnapshot).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="数量" width="160">
            <template #default="{ row }">
              <el-input-number :model-value="row.quantity" :min="1" :max="row.stock || 999" @change="(v:number)=>updateQty(row, v)" />
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120">
            <template #default="{ row }">¥{{ Number(row.amount).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="90">
            <template #default="{ row }"><el-button type="danger" link @click="removeItem(row)">删除</el-button></template>
          </el-table-column>
        </el-table>

        <div class="mt-4 flex items-center justify-between">
          <div class="text-gray-500">共 {{ list.length }} 件商品</div>
          <div class="flex items-center gap-4">
            <div class="text-lg font-semibold">合计：<span class="text-red-500">¥{{ Number(totalAmount).toFixed(2) }}</span></div>
            <el-button type="primary" :disabled="!list.length" @click="checkout">提交订单</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import storeRequest from '@/utils/storeRequest';

const loading = ref(false);
const list = ref<any[]>([]);
const totalAmount = ref(0);

async function fetchCart() {
  loading.value = true;
  try {
    const res: any = await storeRequest.get('/cart');
    list.value = res.data.list;
    totalAmount.value = res.data.totalAmount;
  } finally {
    loading.value = false;
  }
}

async function updateQty(row: any, qty: number) {
  await storeRequest.put(`/cart/items/${row.id}`, { quantity: qty });
  fetchCart();
}

async function removeItem(row: any) {
  await storeRequest.delete(`/cart/items/${row.id}`);
  ElMessage.success('已删除');
  fetchCart();
}

async function checkout() {
  const res: any = await storeRequest.post('/orders/checkout');
  ElMessage.success(`下单成功，订单号：${res.data.orderNo}`);
  fetchCart();
}

fetchCart();
</script>