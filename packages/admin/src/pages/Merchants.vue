<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">商户管理</h2>
      <el-button type="primary" :icon="Plus" @click="openCreate">添加商户</el-button>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data" v-loading="loading" stripe>
        <el-table-column label="商户名称" prop="name" min-width="130">
          <template #default="{ row }">
            <el-button type="primary" link @click="showDetail(row.id)">{{ row.name }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="邮箱" prop="email" min-width="160" show-overflow-tooltip />
        <el-table-column label="API Key" prop="apiKey" min-width="200">
          <template #default="{ row }">
            <span class="font-mono text-xs text-gray-500">{{ row.apiKey }}</span>
          </template>
        </el-table-column>
        <el-table-column label="余额" prop="balance" width="110">
          <template #default="{ row }">
            <span class="font-semibold text-blue-500">¥{{ Number(row.balance).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="费率" prop="feeRate" width="80">
          <template #default="{ row }">{{ (Number(row.feeRate) * 100).toFixed(2) }}%</template>
        </el-table-column>
        <el-table-column label="状态" prop="status" width="90">
          <template #default="{ row }">
            <el-tag :type="STATUS_MAP[row.status]?.type" size="small">{{ STATUS_MAP[row.status]?.label || row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" width="110">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="resetKey(row.id)">重置密钥</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end p-4">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="20"
          layout="total, prev, pager, next"
          @current-change="fetchMerchants"
        />
      </div>
    </div>

    <!-- 创建/编辑 -->
    <el-dialog v-model="modalVisible" :title="editingId ? '编辑商户' : '添加商户'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="pr-4">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="商户名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入商户名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" placeholder="merchant@example.com" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" placeholder="可选" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手续费率" prop="feeRate">
              <el-input-number
                v-model="form.feeRate"
                :min="0" :max="1" :step="0.001" :precision="4"
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="回调地址" prop="notifyUrl">
              <el-input v-model="form.notifyUrl" placeholder="https://your-domain.com/notify" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="返回地址" prop="returnUrl">
              <el-input v-model="form.returnUrl" placeholder="https://your-domain.com/return" />
            </el-form-item>
          </el-col>
          <el-col v-if="editingId" :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" class="w-full">
                <el-option v-for="(v, k) in STATUS_MAP" :key="k" :label="v.label" :value="k" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="modalVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 商户详情 -->
    <el-drawer v-model="detailVisible" title="商户详情" size="520px">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <span class="font-semibold">商户详情</span>
          <el-button type="danger" size="small" :icon="Key" @click="detail && resetKey(detail.id)">重置密钥</el-button>
        </div>
      </template>
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="商户名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.email }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ detail.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="STATUS_MAP[detail.status]?.type" size="small">{{ STATUS_MAP[detail.status]?.label }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="API Key" :span="2">
          <span class="font-mono text-xs break-all">{{ detail.apiKey }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="API Secret" :span="2">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs">{{ showSecret ? detail.apiSecret : '•'.repeat(28) }}</span>
            <el-button link size="small" @click="showSecret = !showSecret">
              <el-icon><component :is="showSecret ? 'Hide' : 'View'" /></el-icon>
            </el-button>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="账户余额">
          <span class="font-semibold text-blue-500">¥{{ Number(detail.balance).toFixed(2) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="累计收款">
          <span class="font-semibold text-green-500">¥{{ Number(detail.totalIncome).toFixed(2) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="手续费率">{{ (Number(detail.feeRate) * 100).toFixed(2) }}%</el-descriptions-item>
        <el-descriptions-item label="订单数">{{ detail._count?.orders || 0 }} 笔</el-descriptions-item>
        <el-descriptions-item label="回调地址" :span="2">{{ detail.notifyUrl || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">{{ dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus, Key } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import request from '@/utils/request';

const STATUS_MAP: Record<string, { type: any; label: string }> = {
  ACTIVE:    { type: 'success', label: '正常' },
  INACTIVE:  { type: 'info',    label: '未激活' },
  SUSPENDED: { type: 'danger',  label: '已暂停' },
};

const data    = ref<any[]>([]);
const total   = ref(0);
const loading = ref(false);
const saving  = ref(false);
const page    = ref(1);
const modalVisible  = ref(false);
const detailVisible = ref(false);
const editingId = ref<string | null>(null);
const detail    = ref<any>(null);
const showSecret = ref(false);
const formRef = ref<FormInstance>();

const form = reactive<any>({
  name: '', email: '', phone: '', feeRate: 0.006, notifyUrl: '', returnUrl: '', status: 'ACTIVE',
});
const rules = {
  name:    [{ required: true, message: '请输入商户名称' }],
  email:   [{ required: true, type: 'email', message: '请输入正确邮箱' }],
  feeRate: [{ required: true, message: '请输入手续费率' }],
};

async function fetchMerchants() {
  loading.value = true;
  try {
    const res: any = await request.get('/merchants', { params: { page: page.value, pageSize: 20 } });
    data.value  = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, { name: '', email: '', phone: '', feeRate: 0.006, notifyUrl: '', returnUrl: '', status: 'ACTIVE' });
  modalVisible.value = true;
}

function openEdit(record: any) {
  editingId.value = record.id;
  Object.assign(form, record);
  modalVisible.value = true;
}

async function showDetail(id: string) {
  const res: any = await request.get(`/merchants/${id}`);
  detail.value = res.data;
  showSecret.value = false;
  detailVisible.value = true;
}

async function handleSubmit() {
  if (!await formRef.value?.validate().catch(() => false)) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await request.put(`/merchants/${editingId.value}`, form);
      ElMessage.success('更新成功');
    } else {
      await request.post('/merchants', form);
      ElMessage.success('商户创建成功');
    }
    modalVisible.value = false;
    fetchMerchants();
  } finally {
    saving.value = false;
  }
}

async function resetKey(id: string) {
  await ElMessageBox.confirm('重置后旧密钥将立即失效，确认操作？', '确认重置 API 密钥', { type: 'warning', confirmButtonText: '确认重置', confirmButtonClass: 'el-button--danger' });
  const res: any = await request.post(`/merchants/${id}/reset-key`);
  ElMessage.success('API 密钥已重置');
  if (detail.value?.id === id) detail.value = { ...detail.value, ...res.data };
}

fetchMerchants();
</script>
