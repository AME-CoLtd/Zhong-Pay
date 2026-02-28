<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-gray-800">商品管理</h2>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增商品</el-button>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b border-gray-100">
        <el-input v-model="keyword" placeholder="搜索商品名称" clearable class="max-w-sm" @keyup.enter="fetchProducts">
          <template #append>
            <el-button @click="fetchProducts">搜索</el-button>
          </template>
        </el-input>
      </div>

      <el-table :data="data" v-loading="loading" stripe>
        <el-table-column label="封面" width="90">
          <template #default="{ row }">
            <el-image v-if="row.cover" :src="row.cover" fit="cover" style="width:44px;height:44px;border-radius:6px" />
            <span v-else class="text-gray-300">-</span>
          </template>
        </el-table-column>
        <el-table-column label="商品名称" prop="name" min-width="180" />
        <el-table-column label="价格" prop="price" width="120">
          <template #default="{ row }">¥{{ Number(row.price).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="库存" prop="stock" width="100" />
        <el-table-column label="状态" prop="status" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ON_SHELF' ? 'success' : 'info'" size="small">
              {{ row.status === 'ON_SHELF' ? '已上架' : '已下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="created_at" width="120">
          <template #default="{ row }">{{ dayjs(row.created_at).format('YYYY-MM-DD') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="warning" link size="small" @click="toggleStatus(row)">
              {{ row.status === 'ON_SHELF' ? '下架' : '上架' }}
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
          @current-change="fetchProducts"
        />
      </div>
    </div>

    <el-dialog v-model="visible" :title="editingId ? '编辑商品' : '新增商品'" width="620px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="pr-3">
        <el-form-item label="商品名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="价格" prop="price">
          <el-input-number v-model="form.price" :min="0.01" :step="1" :precision="2" class="w-full" />
        </el-form-item>
        <el-form-item label="库存" prop="stock">
          <el-input-number v-model="form.stock" :min="0" :step="1" class="w-full" />
        </el-form-item>
        <el-form-item label="封面图"><el-input v-model="form.cover" placeholder="图片 URL（可选）" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" class="w-full">
            <el-option label="上架" value="ON_SHELF" />
            <el-option label="下架" value="OFF_SHELF" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import request from '@/utils/request';

const loading = ref(false);
const saving = ref(false);
const page = ref(1);
const total = ref(0);
const keyword = ref('');
const data = ref<any[]>([]);

const visible = ref(false);
const editingId = ref<string | null>(null);
const formRef = ref<FormInstance>();
const form = reactive<any>({
  name: '',
  price: 1,
  stock: 0,
  cover: '',
  status: 'OFF_SHELF',
  description: '',
});

const rules = {
  name: [{ required: true, message: '请输入商品名称' }],
  price: [{ required: true, message: '请输入价格' }],
};

async function fetchProducts() {
  loading.value = true;
  try {
    const res: any = await request.get('/store/admin/products', { params: { page: page.value, pageSize: 20, keyword: keyword.value } });
    data.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, { name: '', price: 1, stock: 0, cover: '', status: 'OFF_SHELF', description: '' });
  visible.value = true;
}

function openEdit(row: any) {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name,
    price: Number(row.price),
    stock: Number(row.stock),
    cover: row.cover || '',
    status: row.status,
    description: row.description || '',
  });
  visible.value = true;
}

async function handleSubmit() {
  if (!await formRef.value?.validate().catch(() => false)) return;
  saving.value = true;
  try {
    const payload = {
      name: form.name,
      price: Number(form.price),
      stock: Number(form.stock),
      cover: form.cover || null,
      status: form.status,
      description: form.description || null,
    };

    if (editingId.value) {
      await request.put(`/store/admin/products/${editingId.value}`, payload);
      ElMessage.success('商品更新成功');
    } else {
      await request.post('/store/admin/products', payload);
      ElMessage.success('商品创建成功');
    }

    visible.value = false;
    fetchProducts();
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: any) {
  await request.post(`/store/admin/products/${row.id}/toggle`);
  ElMessage.success(row.status === 'ON_SHELF' ? '已下架' : '已上架');
  fetchProducts();
}

fetchProducts();
</script>
