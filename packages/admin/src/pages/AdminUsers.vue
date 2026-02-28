<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">管理用户</h2>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增用户</el-button>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data" v-loading="loading" stripe>
        <el-table-column label="用户名" prop="username" min-width="120" />
        <el-table-column label="邮箱" prop="email" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || '-' }}</template>
        </el-table-column>
        <el-table-column label="手机号" prop="phone" min-width="130">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column label="角色" prop="role" width="130">
          <template #default="{ row }">
            <el-tag :type="ROLE_MAP[row.role]?.type" size="small">{{ ROLE_MAP[row.role]?.label || row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="is_active" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">{{ row.is_active ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" prop="last_login" width="170">
          <template #default="{ row }">{{ row.last_login ? dayjs(row.last_login).format('YYYY-MM-DD HH:mm') : '-' }}</template>
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
          @current-change="fetchAdmins"
        />
      </div>
    </div>

    <el-dialog v-model="formVisible" :title="editingId ? '编辑用户' : '新增用户'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="pr-3">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="!!editingId" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item v-if="!editingId" label="登录密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少8位" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="可选" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="可选" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" class="w-full">
            <el-option label="超级管理员" value="SUPER_ADMIN" />
            <el-option label="管理员" value="ADMIN" />
            <el-option label="员工" value="STAFF" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editingId" label="状态">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pwdVisible" title="重置密码" width="420px">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="90px" class="pr-3">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="pwdForm.password" type="password" show-password placeholder="至少8位" />
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
import { Plus } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import request from '@/utils/request';

const ROLE_MAP: Record<string, { type: any; label: string }> = {
  SUPER_ADMIN: { type: 'danger', label: '超级管理员' },
  ADMIN: { type: 'warning', label: '管理员' },
  STAFF: { type: 'info', label: '员工' },
};

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const saving = ref(false);
const savingPwd = ref(false);

const formVisible = ref(false);
const pwdVisible = ref(false);
const editingId = ref<string | null>(null);
const resetPwdId = ref<string | null>(null);
const formRef = ref<FormInstance>();
const pwdFormRef = ref<FormInstance>();

const form = reactive<any>({
  username: '',
  password: '',
  email: '',
  phone: '',
  role: 'STAFF',
  isActive: true,
});

const pwdForm = reactive({ password: '' });

const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, min: 8, message: '密码至少8位' }],
};

const pwdRules = {
  password: [{ required: true, min: 8, message: '密码至少8位' }],
};

async function fetchAdmins() {
  loading.value = true;
  try {
    const res: any = await request.get('/admins', { params: { page: page.value, pageSize: 20 } });
    data.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, { username: '', password: '', email: '', phone: '', role: 'STAFF', isActive: true });
  formVisible.value = true;
}

function openEdit(row: any) {
  editingId.value = row.id;
  Object.assign(form, {
    username: row.username,
    password: '',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role,
    isActive: !!row.is_active,
  });
  formVisible.value = true;
}

async function submitForm() {
  if (!await formRef.value?.validate().catch(() => false)) return;
  saving.value = true;
  try {
    if (!editingId.value) {
      await request.post('/admins', {
        username: form.username,
        password: form.password,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
      });
      ElMessage.success('用户创建成功');
    } else {
      await request.put(`/admins/${editingId.value}`, {
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
        isActive: form.isActive,
      });
      ElMessage.success('用户更新成功');
    }
    formVisible.value = false;
    fetchAdmins();
  } finally {
    saving.value = false;
  }
}

function openResetPwd(row: any) {
  resetPwdId.value = row.id;
  pwdForm.password = '';
  pwdVisible.value = true;
}

async function submitResetPwd() {
  if (!await pwdFormRef.value?.validate().catch(() => false)) return;
  if (!resetPwdId.value) return;
  savingPwd.value = true;
  try {
    await request.post(`/admins/${resetPwdId.value}/reset-password`, { password: pwdForm.password });
    ElMessage.success('密码重置成功');
    pwdVisible.value = false;
  } finally {
    savingPwd.value = false;
  }
}

async function toggleActive(row: any) {
  const next = !row.is_active;
  await ElMessageBox.confirm(`确认${next ? '启用' : '停用'}该用户？`, '提示', { type: 'warning' });
  await request.put(`/admins/${row.id}`, {
    email: row.email || null,
    phone: row.phone || null,
    role: row.role,
    isActive: next,
  });
  ElMessage.success(next ? '已启用' : '已停用');
  fetchAdmins();
}

fetchAdmins();
</script>
