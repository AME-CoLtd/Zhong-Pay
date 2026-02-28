<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <el-card class="w-full max-w-md" shadow="hover">
      <template #header>
        <div class="font-semibold text-lg">客户登录 / 注册</div>
      </template>

      <el-tabs v-model="tab">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" @submit.prevent>
            <el-form-item><el-input v-model="loginForm.username" placeholder="用户名" /></el-form-item>
            <el-form-item><el-input v-model="loginForm.password" type="password" show-password placeholder="密码" /></el-form-item>
            <el-button type="primary" class="w-full" @click="handleLogin">登录</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form :model="regForm" @submit.prevent>
            <el-form-item><el-input v-model="regForm.username" placeholder="用户名" /></el-form-item>
            <el-form-item><el-input v-model="regForm.password" type="password" show-password placeholder="至少6位密码" /></el-form-item>
            <el-form-item><el-input v-model="regForm.nickname" placeholder="昵称（可选）" /></el-form-item>
            <el-button type="primary" class="w-full" @click="handleRegister">注册</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="text-center text-sm mt-4">
        <router-link to="/store" class="text-blue-600">返回商城首页</router-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import storeRequest from '@/utils/storeRequest';

const router = useRouter();
const tab = ref('login');
const loginForm = reactive({ username: '', password: '' });
const regForm = reactive({ username: '', password: '', nickname: '' });

async function handleLogin() {
  const res: any = await storeRequest.post('/auth/login', loginForm);
  localStorage.setItem('zp_customer_token', res.data.token);
  localStorage.setItem('zp_customer_info', JSON.stringify(res.data.customer));
  ElMessage.success('登录成功');
  router.push('/store');
}

async function handleRegister() {
  const res: any = await storeRequest.post('/auth/register', regForm);
  localStorage.setItem('zp_customer_token', res.data.token);
  localStorage.setItem('zp_customer_info', JSON.stringify(res.data.customer));
  ElMessage.success('注册成功');
  router.push('/store');
}
</script>