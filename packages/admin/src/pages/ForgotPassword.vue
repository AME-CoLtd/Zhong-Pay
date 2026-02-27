<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-blue-600 px-5">
    <el-card class="w-full max-w-md shadow-2xl border-0 rounded-2xl" body-style="padding: 40px 48px;">
      <div class="text-center mb-8">
        <el-icon :size="44" color="#409eff" class="mb-3"><Lock /></el-icon>
        <h1 class="text-xl font-bold text-gray-800 mb-1">找回密码</h1>
        <p class="text-gray-400 text-sm">通过绑定邮箱或手机号重置密码</p>
      </div>

      <!-- Step 1: 输入账号 -->
      <template v-if="step === 1">
        <el-form ref="step1Ref" :model="step1Form" :rules="step1Rules" size="large">
          <el-form-item prop="username">
            <el-input v-model="step1Form.username" placeholder="用户名" :prefix-icon="User" clearable />
          </el-form-item>
          <el-form-item prop="contact">
            <el-input v-model="step1Form.contact" placeholder="绑定邮箱或手机号" :prefix-icon="Message" clearable />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" class="w-full !h-11" :loading="loading" @click="sendCode">
              发送验证码
            </el-button>
          </el-form-item>
        </el-form>
      </template>

      <!-- Step 2: 输入验证码 + 新密码 -->
      <template v-else-if="step === 2">
        <el-form ref="step2Ref" :model="step2Form" :rules="step2Rules" size="large">
          <el-alert
            :title="`验证码已发送至 ${maskedContact}`"
            type="info" show-icon :closable="false" class="mb-4"
          />
          <el-form-item prop="code">
            <el-input v-model="step2Form.code" placeholder="6位验证码" :prefix-icon="Key" maxlength="6">
              <template #append>
                <el-button :disabled="countdown > 0" @click="sendCode">
                  {{ countdown > 0 ? `${countdown}s` : '重新发送' }}
                </el-button>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="newPassword">
            <el-input v-model="step2Form.newPassword" type="password" placeholder="新密码（至少8位）" :prefix-icon="Lock" show-password />
          </el-form-item>
          <el-form-item prop="confirmPassword">
            <el-input v-model="step2Form.confirmPassword" type="password" placeholder="确认新密码" :prefix-icon="Lock" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" class="w-full !h-11" :loading="loading" @click="resetPassword">
              重置密码
            </el-button>
          </el-form-item>
        </el-form>
      </template>

      <!-- Step 3: 成功 -->
      <template v-else>
        <el-result icon="success" title="密码重置成功" sub-title="请使用新密码登录">
          <template #extra>
            <el-button type="primary" @click="router.push('/login')">立即登录</el-button>
          </template>
        </el-result>
      </template>

      <div class="text-center mt-4">
        <el-link :underline="false" @click="router.push('/login')">
          <el-icon><ArrowLeft /></el-icon> 返回登录
        </el-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { User, Lock, Message, Key } from '@element-plus/icons-vue';
import request from '@/utils/request';

const router   = useRouter();
const loading  = ref(false);
const step     = ref(1);
const countdown = ref(0);

const step1Ref  = ref<FormInstance>();
const step2Ref  = ref<FormInstance>();

const step1Form = reactive({ username: '', contact: '' });
const step2Form = reactive({ code: '', newPassword: '', confirmPassword: '' });

const step1Rules = {
  username: [{ required: true, message: '请输入用户名' }],
  contact:  [{ required: true, message: '请输入绑定邮箱或手机号' }],
};
const step2Rules = {
  code:            [{ required: true, message: '请输入验证码' }, { len: 6, message: '验证码为6位' }],
  newPassword:     [{ required: true, message: '请输入新密码' }, { min: 8, message: '密码至少8位' }],
  confirmPassword: [
    { required: true, message: '请确认密码' },
    {
      validator: (_: any, val: string, cb: any) => {
        if (val !== step2Form.newPassword) cb(new Error('两次密码不一致'));
        else cb();
      },
    },
  ],
};

const maskedContact = computed(() => {
  const c = step1Form.contact;
  if (c.includes('@')) {
    const [u, d] = c.split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  return `${c.slice(0, 3)}****${c.slice(-4)}`;
});

let countdownTimer: ReturnType<typeof setInterval>;

function startCountdown() {
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) clearInterval(countdownTimer);
  }, 1000);
}

async function sendCode() {
  if (!await step1Ref.value?.validate().catch(() => false)) return;
  loading.value = true;
  try {
    await request.post('/auth/forgot-password/send-code', step1Form);
    ElMessage.success('验证码已发送');
    step.value = 2;
    startCountdown();
  } finally {
    loading.value = false;
  }
}

async function resetPassword() {
  if (!await step2Ref.value?.validate().catch(() => false)) return;
  loading.value = true;
  try {
    await request.post('/auth/forgot-password/reset', {
      ...step1Form,
      ...step2Form,
    });
    step.value = 3;
  } finally {
    loading.value = false;
  }
}
</script>
