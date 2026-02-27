<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-gray-800">数据总览</h2>
      <p class="text-gray-400 text-sm mt-0.5">{{ today }}</p>
    </div>

    <el-skeleton :loading="loading" animated :rows="8">
      <template #default>
        <!-- 统计卡片 -->
        <el-row :gutter="16" class="mb-5">
          <el-col v-for="card in statCards" :key="card.title" :xs="24" :sm="12" :lg="6">
            <div
              class="bg-white rounded-xl p-5 shadow-sm flex justify-between items-start hover:-translate-y-1 transition-transform duration-200 cursor-default"
            >
              <div>
                <p class="text-gray-400 text-sm mb-2">{{ card.title }}</p>
                <p class="text-2xl font-bold" :class="card.textClass">
                  {{ card.prefix }}{{ card.formatted }}{{ card.suffix }}
                </p>
              </div>
              <div class="w-13 h-13 rounded-xl flex items-center justify-center" :class="card.bgClass">
                <el-icon :size="28" :class="card.textClass">
                  <component :is="card.icon" />
                </el-icon>
              </div>
            </div>
          </el-col>
        </el-row>

        <!-- 概览数字 -->
        <el-row :gutter="16" class="mb-5">
          <el-col :xs="24" :sm="8">
            <div class="bg-white rounded-xl p-5 shadow-sm text-center">
              <p class="text-gray-400 text-sm mb-1">累计总收款</p>
              <p class="text-2xl font-bold text-blue-500">¥{{ fmt(overview?.revenue.total) }}</p>
            </div>
          </el-col>
          <el-col :xs="24" :sm="8">
            <div class="bg-white rounded-xl p-5 shadow-sm text-center">
              <p class="text-gray-400 text-sm mb-1">累计成功订单</p>
              <p class="text-2xl font-bold text-green-500">{{ overview?.orders.paid }} 笔</p>
            </div>
          </el-col>
          <el-col :xs="24" :sm="8">
            <div class="bg-white rounded-xl p-5 shadow-sm text-center">
              <p class="text-gray-400 text-sm mb-1">待处理提现</p>
              <p class="text-2xl font-bold" :class="(overview?.withdrawals.pending ?? 0) > 0 ? 'text-orange-500' : 'text-green-500'">
                {{ overview?.withdrawals.pending }} 笔
              </p>
            </div>
          </el-col>
        </el-row>

        <!-- 趋势图（纯 SVG，无需额外图表库） -->
        <el-row :gutter="16">
          <el-col :xs="24" :lg="16">
            <div class="bg-white rounded-xl p-5 shadow-sm">
              <p class="text-gray-700 font-medium mb-4">近 7 日收款趋势</p>
              <div class="overflow-x-auto">
                <svg width="100%" :viewBox="`0 0 560 200`" class="min-w-[400px]">
                  <!-- 网格 -->
                  <line v-for="i in 4" :key="i" :x1="60" :y1="i*40" :x2="540" :y2="i*40" stroke="#f0f0f0" stroke-width="1"/>
                  <!-- 折线 -->
                  <polyline
                    :points="revenuePoints"
                    fill="none"
                    stroke="#409eff"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                  <!-- 渐变面积 -->
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#409eff" stop-opacity="0.18"/>
                      <stop offset="100%" stop-color="#409eff" stop-opacity="0"/>
                    </linearGradient>
                  </defs>
                  <polygon :points="revenueArea" fill="url(#areaGrad)" />
                  <!-- 数据点 -->
                  <circle
                    v-for="(pt, i) in revenueCoords"
                    :key="i"
                    :cx="pt.x"
                    :cy="pt.y"
                    r="4"
                    fill="#409eff"
                    stroke="white"
                    stroke-width="2"
                  />
                  <!-- X轴标签 -->
                  <text
                    v-for="(d, i) in trend"
                    :key="i"
                    :x="60 + i * (480 / Math.max(trend.length - 1, 1))"
                    y="195"
                    text-anchor="middle"
                    font-size="10"
                    fill="#9ca3af"
                  >
                    {{ d.date.slice(5) }}
                  </text>
                </svg>
              </div>
            </div>
          </el-col>

          <el-col :xs="24" :lg="8">
            <div class="bg-white rounded-xl p-5 shadow-sm h-full">
              <p class="text-gray-700 font-medium mb-4">7 日订单量</p>
              <div class="flex items-end gap-2 h-44 pb-6 relative">
                <div
                  v-for="(d, i) in trend"
                  :key="i"
                  class="flex-1 flex flex-col items-center justify-end gap-1"
                >
                  <span class="text-[10px] text-gray-400">{{ d.orders }}</span>
                  <div
                    class="w-full rounded-t-md bg-blue-400 transition-all duration-500 hover:bg-blue-500 bar-col"
                    :style="`--bar-h: ${barHeight(d.orders)}%`"
                  />
                  <span class="text-[10px] text-gray-400 rotate-45 origin-left">{{ d.date.slice(5) }}</span>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import request from '@/utils/request';

interface Overview {
  orders:      { total: number; paid: number; today: number; thisMonth: number };
  merchants:   { total: number; active: number };
  withdrawals: { pending: number };
  revenue:     { total: number; today: number; thisMonth: number };
}
interface Trend { date: string; orders: number; revenue: number }

const loading  = ref(true);
const overview = ref<Overview | null>(null);
const trend    = ref<Trend[]>([]);
const today    = dayjs().format('YYYY年MM月DD日');

onMounted(async () => {
  try {
    const [ovRes, trdRes]: any[] = await Promise.all([
      request.get('/stats/overview'),
      request.get('/stats/trend?days=7'),
    ]);
    overview.value = ovRes.data;
    trend.value    = trdRes.data;
  } finally {
    loading.value = false;
  }
});

const fmt = (v?: number) => Number(v ?? 0).toFixed(2);

const statCards = computed(() => {
  if (!overview.value) return [];
  const o = overview.value;
  return [
    { title: '今日收款',  value: o.revenue.today,      prefix: '¥', suffix: '',   formatted: fmt(o.revenue.today),        textClass: 'text-blue-500',   bgClass: 'bg-blue-50',   icon: 'TrendCharts' },
    { title: '本月收款',  value: o.revenue.thisMonth,  prefix: '¥', suffix: '',   formatted: fmt(o.revenue.thisMonth),    textClass: 'text-green-500',  bgClass: 'bg-green-50',  icon: 'ArrowUpBold' },
    { title: '今日订单',  value: o.orders.today,       prefix: '',  suffix: '笔', formatted: String(o.orders.today),      textClass: 'text-purple-500', bgClass: 'bg-purple-50', icon: 'ShoppingCart' },
    { title: '活跃商户',  value: o.merchants.active,   prefix: '',  suffix: '家', formatted: String(o.merchants.active),  textClass: 'text-orange-500', bgClass: 'bg-orange-50', icon: 'Shop' },
  ];
});

// SVG 折线图坐标
const revenueCoords = computed(() => {
  if (!trend.value.length) return [];
  const values = trend.value.map((d) => Number(d.revenue));
  const max = Math.max(...values, 1);
  const n = trend.value.length;
  return values.map((v, i) => ({
    x: 60 + i * (480 / Math.max(n - 1, 1)),
    y: 170 - (v / max) * 150,
  }));
});
const revenuePoints = computed(() =>
  revenueCoords.value.map((p) => `${p.x},${p.y}`).join(' ')
);
const revenueArea = computed(() => {
  const pts = revenueCoords.value;
  if (!pts.length) return '';
  return [
    `${pts[0].x},170`,
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},170`,
  ].join(' ');
});

const barHeight = (v: number) => {
  const max = Math.max(...trend.value.map((d) => d.orders), 1);
  return Math.max((v / max) * 100, 4);
};
</script>

<style scoped>
.bar-col {
  height: var(--bar-h);
}
</style>
