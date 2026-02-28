<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">客户管理</h2>
      <el-input v-model="keyword" placeholder="搜索用户名/昵称/邮箱/手机号" clearable class="max-w-sm" @keyup.enter="fetchCustomers">
        <template #append><el-button @click="fetchCustomers">搜索</el-button></template>
      </el-input>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data" v-loading="loading" stripe>
        <el-table-column label="用户名" prop="username" min-width="140" />
        <el-table-column label="昵称" prop="nickname" min-width="120">
          <template #default="{ row }">{{ row.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column label="邮箱" prop="email" min-width="180">
          <template #default="{ row }">{{ row.email || '-' }}</template>
        </el-table-column>
        <el-table-column label="手机号" prop="phone" min-width="140">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" prop="is_active" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">{{ row.is_active ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="created_at" width="120">
          <template #default="{ row }">{{ dayjs(row.created_at).format('YYYY-MM-DD') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="warning" link size="small" @click="openResetPwd(row)">重置密码</el-button>
            <el-button type="danger" link size="small" @click="toggleActive(row)">{{ row.is_active ? '停用' : '启用' }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-end p-4">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="20"
          layout="total, prev, pager, next"
          @current-change="fetchCustomers"
        />
      </div>
    </div>

    <el-dialog v-model="editVisible" title="编辑客户" width="520px">
      <el-form ref="editFormRef" :model="editForm" label-width="90px" class="pr-3">
        <el-form-item label="用户名"><el-input v-model="editForm.username" disabled /></el-form-item>
        <el-form-item label="昵称"><el-input v-model="editForm.nickname" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="editForm.email" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="editForm.phone" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="editForm.isActive" active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pwdVisible" title="重置客户密码" width="420px">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="90px" class="pr-3">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="pwdForm.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPwd" @click="submitResetPwd">确定重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import dayjs from 'dayjs';
import request from '@/utils/request';

const loading = ref(false);
const saving = ref(false);
const savingPwd = ref(false);
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const keyword = ref('');

const editVisible = ref(false);
const pwdVisible = ref(false);
const editFormRef = ref<FormInstance>();
const pwdFormRef = ref<FormInstance>();
const editingId = ref('');
const resetId = ref('');

const editForm = reactive<any>({ username: '', nickname: '', email: '', phone: '', isActive: true });
const pwdForm = reactive({ password: '' });
const pwdRules = { password: [{ required: true, min: 6, message: '密码至少6位' }] };

async function fetchCustomers() {
  loading.value = true;
  try {
    const res: any = await request.get('/store/admin/customers', { params: { page: page.value, pageSize: 20, keyword: keyword.value } });
    data.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function openEdit(row: any) {
  editingId.value = row.id;
  Object.assign(editForm, {
    username: row.username,
    nickname: row.nickname || '',
    email: row.email || '',
    phone: row.phone || '',
    isActive: !!row.is_active,
  });
  editVisible.value = true;
}

async function saveEdit() {
  saving.value = true;
  try {
    await request.put(`/store/admin/customers/${editingId.value}`, {
      nickname: editForm.nickname || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      isActive: editForm.isActive,
    });
    ElMessage.success('客户更新成功');
    editVisible.value = false;
    fetchCustomers();
  } finally {
    saving.value = false;
  }
}

function openResetPwd(row: any) {
  resetId.value = row.id;
  pwdForm.password = '';
  pwdVisible.value = true;
}

async function submitResetPwd() {
  if (!await pwdFormRef.value?.validate().catch(() => false)) return;
  savingPwd.value = true;
  try {
    await request.post(`/store/admin/customers/${resetId.value}/reset-password`, { password: pwdForm.password });
    ElMessage.success('密码已重置');
    pwdVisible.value = false;
  } finally {
    savingPwd.value = false;
  }
}

async function toggleActive(row: any) {
  const next = !row.is_active;
  await ElMessageBox.confirm(`确认${next ? '启用' : '停用'}该客户？`, '提示', { type: 'warning' });
  await request.put(`/store/admin/customers/${row.id}`, {
    nickname: row.nickname || null,
    email: row.email || null,
    phone: row.phone || null,
    isActive: next,
  });
  ElMessage.success(next ? '已启用' : '已停用');
  fetchCustomers();
}

fetchCustomers();
</script>
