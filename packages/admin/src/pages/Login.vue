<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-blue-600 px-5">
    <el-card class="w-full max-w-md shadow-2xl border-0 rounded-2xl" body-style="padding: 40px 48px;">
      <!-- Logo -->
      <div class="text-center mb-9">
        <img src="/bt-logo.png" alt="众支付" class="h-16 mx-auto object-contain" />
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="onSubmit">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <el-form-item class="mb-0">
          <el-button
            type="primary"
            class="w-full !h-11 !text-base !rounded-lg"
            :loading="loading"
            @click="onSubmit"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="text-center mt-5 flex justify-between items-center text-sm text-gray-400">
        <span>默认账号：admin / Admin@123456</span>
        <el-link type="primary" :underline="false" @click="router.push('/admin/forgot-password')">
          忘记密码？
        </el-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import request from '@/utils/request';

const router  = useRouter();
const auth    = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码',   trigger: 'blur' }],
};

async function onSubmit() {
  if (!await formRef.value?.validate().catch(() => false)) return;
  loading.value = true;
  try {
    const res: any = await request.post('/auth/login', form);
    auth.setAuth(res.data.token, res.data.admin);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } finally {
    loading.value = false;
  }
}
</script>
