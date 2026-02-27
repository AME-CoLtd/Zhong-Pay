<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">提现管理</h2>
      <el-select v-model="statusFilter" placeholder="筛选状态" clearable class="!w-36" @change="fetchWithdrawals">
        <el-option v-for="(v, k) in STATUS_MAP" :key="k" :label="v.label" :value="k" />
      </el-select>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data" v-loading="loading" stripe>
        <el-table-column label="提现单号" prop="withdrawNo" min-width="180">
          <template #default="{ row }">
            <span class="font-mono text-xs text-gray-500">{{ row.withdrawNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="商户" prop="merchant.name" width="120" />
        <el-table-column label="提现金额" prop="amount" width="110">
          <template #default="{ row }">
            <span class="font-semibold text-blue-500">¥{{ Number(row.amount).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="开户银行" prop="bankName" width="130" show-overflow-tooltip />
        <el-table-column label="收款账号" prop="bankAccount" width="160" />
        <el-table-column label="收款人" prop="bankHolder" width="100" />
        <el-table-column label="状态" prop="status" width="90">
          <template #default="{ row }">
            <el-tag :type="STATUS_MAP[row.status]?.type" size="small">
              {{ STATUS_MAP[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" prop="createdAt" width="140">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button type="success" link size="small" @click="handleAudit(row.id, 'APPROVE')">通过</el-button>
              <el-button type="danger"  link size="small" @click="handleAudit(row.id, 'REJECT')">拒绝</el-button>
            </template>
            <el-button v-if="row.status === 'APPROVED'" type="primary" link size="small" @click="handleTransfer(row.id)">
              打款完成
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end p-4">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="20"
          layout="total, prev, pager, next"
          @current-change="fetchWithdrawals"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import request from '@/utils/request';

const STATUS_MAP: Record<string, { type: any; label: string }> = {
  PENDING:     { type: 'warning', label: '待审核' },
  APPROVED:    { type: 'primary', label: '已审核' },
  REJECTED:    { type: 'danger',  label: '已拒绝' },
  TRANSFERRED: { type: 'success', label: '已打款' },
  FAILED:      { type: 'danger',  label: '打款失败' },
};

const data         = ref<any[]>([]);
const total        = ref(0);
const loading      = ref(false);
const page         = ref(1);
const statusFilter = ref('');

async function fetchWithdrawals() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: 20 };
    if (statusFilter.value) params.status = statusFilter.value;
    const res: any = await request.get('/withdrawals', { params });
    data.value  = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

async function handleAudit(id: string, action: 'APPROVE' | 'REJECT') {
  const actionText = action === 'APPROVE' ? '审核通过' : '拒绝';
  const msg = action === 'REJECT' ? '拒绝后余额将自动返回商户账户' : '请确认已核实提现信息';
  await ElMessageBox.confirm(msg, `确认${actionText}`, {
    type: action === 'REJECT' ? 'warning' : 'info',
  });
  await request.post(`/withdrawals/${id}/audit`, { action });
  ElMessage.success(`${actionText}成功`);
  fetchWithdrawals();
}

async function handleTransfer(id: string) {
  await ElMessageBox.confirm('请确认已完成线下打款操作', '确认标记已打款');
  await request.post(`/withdrawals/${id}/transfer`);
  ElMessage.success('已标记打款成功');
  fetchWithdrawals();
}

fetchWithdrawals();
</script>
