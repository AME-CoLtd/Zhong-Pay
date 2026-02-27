<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">订单管理</h2>
    </div>

    <!-- 搜索栏 -->
    <div class="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索订单号 / 商品名"
        :prefix-icon="Search"
        clearable
        class="!w-56"
        @clear="fetchOrders"
        @keyup.enter="fetchOrders"
      />
      <el-select v-model="filters.payType" placeholder="支付方式" clearable class="!w-32" @change="fetchOrders">
        <el-option label="支付宝" value="ALIPAY" />
        <el-option label="微信支付" value="WECHAT" />
      </el-select>
      <el-select v-model="filters.status" placeholder="订单状态" clearable class="!w-32" @change="fetchOrders">
        <el-option v-for="(v, k) in ORDER_STATUS_MAP" :key="k" :label="v.label" :value="k" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        class="!w-64"
        @change="fetchOrders"
      />
      <el-button :icon="Refresh" @click="fetchOrders">刷新</el-button>
    </div>

    <!-- 表格 -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data" v-loading="loading" stripe>
        <el-table-column label="订单号" prop="orderNo" width="185">
          <template #default="{ row }">
            <span class="font-mono text-xs text-gray-600">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="商户" prop="merchant.name" width="120" />
        <el-table-column label="商品名称" prop="subject" min-width="140" show-overflow-tooltip />
        <el-table-column label="金额" prop="amount" width="110">
          <template #default="{ row }">
            <span class="font-semibold text-blue-500">¥{{ Number(row.amount).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" prop="payType" width="100">
          <template #default="{ row }">
            <el-tag :color="PAY_TYPE_MAP[row.payType]?.color" effect="light" size="small">
              {{ PAY_TYPE_MAP[row.payType]?.label || row.payType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" width="90">
          <template #default="{ row }">
            <el-tag :type="ORDER_STATUS_MAP[row.status]?.type" size="small">
              {{ ORDER_STATUS_MAP[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" width="168">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="showDetail(row.id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end p-4">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="fetchOrders"
        />
      </div>
    </div>

    <!-- 订单详情 -->
    <el-drawer v-model="detailVisible" title="订单详情" size="480px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="平台订单号" :span="2">
          <span class="font-mono text-xs">{{ detail.orderNo }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="商户订单号" :span="2">
          <span class="font-mono text-xs">{{ detail.outTradeNo }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="商户">{{ detail.merchant?.name }}</el-descriptions-item>
        <el-descriptions-item label="商品名称">{{ detail.subject }}</el-descriptions-item>
        <el-descriptions-item label="订单金额">
          <span class="font-semibold text-blue-500">¥{{ Number(detail.amount).toFixed(2) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="实际金额">
          {{ detail.actualAmount ? `¥${Number(detail.actualAmount).toFixed(2)}` : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="手续费">
          {{ detail.feeAmount ? `¥${Number(detail.feeAmount).toFixed(2)}` : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="支付方式">
          <el-tag :color="PAY_TYPE_MAP[detail.payType]?.color" effect="light" size="small">
            {{ PAY_TYPE_MAP[detail.payType]?.label || detail.payType }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="ORDER_STATUS_MAP[detail.status]?.type" size="small">
            {{ ORDER_STATUS_MAP[detail.status]?.label || detail.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="第三方单号">{{ detail.thirdTradeNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ detail.paidAt ? dayjs(detail.paidAt).format('YYYY-MM-DD HH:mm:ss') : '-' }}</el-descriptions-item>
        <el-descriptions-item label="回调地址" :span="2">{{ detail.notifyUrl || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import request from '@/utils/request';

const ORDER_STATUS_MAP: Record<string, { type: any; label: string }> = {
  PENDING:   { type: 'warning',  label: '待支付' },
  PAID:      { type: 'success',  label: '已支付' },
  CLOSED:    { type: 'info',     label: '已关闭' },
  REFUNDING: { type: 'warning',  label: '退款中' },
  REFUNDED:  { type: 'primary',  label: '已退款' },
  FAILED:    { type: 'danger',   label: '失败' },
};
const PAY_TYPE_MAP: Record<string, { color: string; label: string }> = {
  ALIPAY: { color: '#1677ff', label: '支付宝' },
  WECHAT: { color: '#07c160', label: '微信支付' },
};

const data    = ref<any[]>([]);
const total   = ref(0);
const loading = ref(false);
const page    = ref(1);
const pageSize = ref(20);
const dateRange = ref<string[]>([]);
const filters = reactive<any>({ keyword: '', payType: '', status: '' });
const detail  = ref<any>(null);
const detailVisible = ref(false);

async function fetchOrders() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.keyword)  params.keyword  = filters.keyword;
    if (filters.payType)  params.payType  = filters.payType;
    if (filters.status)   params.status   = filters.status;
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0];
      params.endDate   = dateRange.value[1];
    }
    const res: any = await request.get('/orders', { params });
    data.value  = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

async function showDetail(id: string) {
  const res: any = await request.get(`/orders/${id}`);
  detail.value = res.data;
  detailVisible.value = true;
}

fetchOrders();
</script>
