<template>
  <div class="max-w-2xl mx-auto">
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-gray-800">个人设置</h2>
      <p class="text-gray-400 text-sm mt-0.5">管理您的账号安全信息</p>
    </div>

    <el-tabs type="border-card" class="rounded-xl shadow-sm">
      <!-- 基本信息 -->
      <el-tab-pane label="基本信息">
        <div class="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <el-avatar :size="56" class="profile-avatar">
            {{ auth.admin?.username?.charAt(0).toUpperCase() }}
          </el-avatar>
          <div>
            <div class="font-semibold text-gray-800 text-base">{{ auth.admin?.username }}</div>
            <div class="text-sm text-gray-400 mt-0.5">{{ roleText }}</div>
          </div>
        </div>

        <el-descriptions :column="1" border>
          <el-descriptions-item label="用户名">{{ auth.admin?.username }}</el-descriptions-item>
          <el-descriptions-item label="绑定邮箱">
            <div class="flex items-center gap-3">
              <span>{{ auth.admin?.email || '未绑定' }}</span>
              <el-button type="primary" link size="small" @click="emailDrawer = true">
                {{ auth.admin?.email ? '修改邮箱' : '绑定邮箱' }}
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="绑定手机">
            <div class="flex items-center gap-3">
              <span>{{ auth.admin?.phone || '未绑定' }}</span>
              <el-button type="primary" link size="small" @click="phoneDrawer = true">
                {{ auth.admin?.phone ? '修改手机' : '绑定手机' }}
              </el-button>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <!-- 修改密码 -->
      <el-tab-pane label="修改密码">
        <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="90px" class="max-w-sm mt-2">
          <el-form-item label="当前密码" prop="oldPassword">
            <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少8位" />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="pwdLoading" @click="changePassword">修改密码</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <!-- 绑定邮箱抽屉 -->
    <el-drawer v-model="emailDrawer" title="绑定 / 修改邮箱" size="400px">
      <el-form ref="emailFormRef" :model="emailForm" :rules="emailRules" label-width="80px" class="mt-2">
        <el-form-item label="新邮箱" prop="email">
          <el-input v-model="emailForm.email" placeholder="请输入邮箱地址" />
        </el-form-item>
        <el-form-item label="验证码" prop="code">
          <el-input v-model="emailForm.code" placeholder="6位验证码" maxlength="6">
            <template #append>
              <el-button :disabled="emailCountdown > 0" :loading="codeSending" @click="sendEmailCode">
                {{ emailCountdown > 0 ? `${emailCountdown}s` : '发送验证码' }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="emailLoading" @click="bindEmail">确认绑定</el-button>
        </el-form-item>
      </el-form>
    </el-drawer>

    <!-- 绑定手机抽屉 -->
    <el-drawer v-model="phoneDrawer" title="绑定 / 修改手机" size="400px">
      <el-form ref="phoneFormRef" :model="phoneForm" :rules="phoneRules" label-width="80px" class="mt-2">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="phoneForm.phone" placeholder="请输入手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="验证码" prop="code">
          <el-input v-model="phoneForm.code" placeholder="6位验证码" maxlength="6">
            <template #append>
              <el-button :disabled="phoneCountdown > 0" :loading="smsSending" @click="sendSmsCode">
                {{ phoneCountdown > 0 ? `${phoneCountdown}s` : '发送验证码' }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="phoneLoading" @click="bindPhone">确认绑定</el-button>
        </el-form-item>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import request from '@/utils/request';

const auth = useAuthStore();

const roleText = computed(() => {
  const r = auth.admin?.role;
  if (r === 'SUPER_ADMIN') return '超级管理员';
  if (r === 'ADMIN') return '管理员';
  return '员工';
});

// ---- 修改密码 ----
const pwdFormRef = ref<FormInstance>();
const pwdLoading = ref(false);
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwdRules = {
  oldPassword:     [{ required: true, message: '请输入当前密码' }],
  newPassword:     [{ required: true, message: '请输入新密码' }, { min: 8, message: '密码至少8位' }],
  confirmPassword: [
    { required: true, message: '请确认密码' },
    {
      validator: (_: any, val: string, cb: any) => {
        if (val !== pwdForm.newPassword) cb(new Error('两次密码不一致'));
        else cb();
      },
    },
  ],
};
async function changePassword() {
  if (!await pwdFormRef.value?.validate().catch(() => false)) return;
  pwdLoading.value = true;
  try {
    await request.put('/auth/password', { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
    ElMessage.success('密码修改成功，请重新登录');
    auth.logout();
    window.location.href = '/admin/login';
  } finally {
    pwdLoading.value = false;
  }
}

// ---- 绑定邮箱 ----
const emailDrawer  = ref(false);
const emailFormRef = ref<FormInstance>();
const emailLoading = ref(false);
const codeSending  = ref(false);
const emailCountdown = ref(0);
const emailForm = reactive({ email: '', code: '' });
const emailRules = {
  email: [{ required: true, type: 'email', message: '请输入正确的邮箱' }],
  code:  [{ required: true, message: '请输入验证码' }, { len: 6, message: '验证码为6位' }],
};

let emailTimer: ReturnType<typeof setInterval>;
function startEmailCountdown() {
  emailCountdown.value = 60;
  emailTimer = setInterval(() => {
    if (--emailCountdown.value <= 0) clearInterval(emailTimer);
  }, 1000);
}

async function sendEmailCode() {
  if (!emailForm.email) { ElMessage.warning('请先输入邮箱地址'); return; }
  codeSending.value = true;
  try {
    await request.post('/auth/send-email-code', { email: emailForm.email });
    ElMessage.success('验证码已发送至邮箱');
    startEmailCountdown();
  } finally {
    codeSending.value = false;
  }
}

async function bindEmail() {
  if (!await emailFormRef.value?.validate().catch(() => false)) return;
  emailLoading.value = true;
  try {
    await request.post('/auth/bind-email', emailForm);
    auth.updateAdmin({ email: emailForm.email });
    ElMessage.success('邮箱绑定成功');
    emailDrawer.value = false;
  } finally {
    emailLoading.value = false;
  }
}

// ---- 绑定手机 ----
const phoneDrawer  = ref(false);
const phoneFormRef = ref<FormInstance>();
const phoneLoading = ref(false);
const smsSending   = ref(false);
const phoneCountdown = ref(0);
const phoneForm = reactive({ phone: '', code: '' });
const phoneRules = {
  phone: [{ required: true, message: '请输入手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' }],
  code:  [{ required: true, message: '请输入验证码' }, { len: 6, message: '验证码为6位' }],
};

let phoneTimer: ReturnType<typeof setInterval>;
function startPhoneCountdown() {
  phoneCountdown.value = 60;
  phoneTimer = setInterval(() => {
    if (--phoneCountdown.value <= 0) clearInterval(phoneTimer);
  }, 1000);
}

async function sendSmsCode() {
  if (!phoneForm.phone || !/^1[3-9]\d{9}$/.test(phoneForm.phone)) {
    ElMessage.warning('请先输入正确的手机号');
    return;
  }
  smsSending.value = true;
  try {
    await request.post('/auth/send-sms-code', { phone: phoneForm.phone });
    ElMessage.success('验证码已发送至手机');
    startPhoneCountdown();
  } finally {
    smsSending.value = false;
  }
}

async function bindPhone() {
  if (!await phoneFormRef.value?.validate().catch(() => false)) return;
  phoneLoading.value = true;
  try {
    await request.post('/auth/bind-phone', phoneForm);
    auth.updateAdmin({ phone: phoneForm.phone });
    ElMessage.success('手机号绑定成功');
    phoneDrawer.value = false;
  } finally {
    phoneLoading.value = false;
  }
}
</script>

<style scoped>
.profile-avatar {
  background-color: #409eff;
  font-size: 22px;
}
</style>
