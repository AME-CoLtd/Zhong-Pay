<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-gray-800">系统配置</h2>
      <p class="text-gray-400 text-sm mt-0.5">修改后立即生效，支付渠道密钥等敏感配置建议在服务器 .env 中配置</p>
    </div>

    <el-tabs v-model="activeTab" type="border-card" class="rounded-xl shadow-sm">
      <!-- 通用配置 -->
      <el-tab-pane label="通用配置" name="general">
        <ConfigTable :items="generalConfigs" @edit="openEdit" />
      </el-tab-pane>

      <!-- QQ邮件 -->
      <el-tab-pane name="email">
        <template #label>
          <span class="flex items-center gap-1"><el-icon><Message /></el-icon> 邮件配置</span>
        </template>
        <el-alert title="邮件发送使用 QQ 邮箱 SMTP，需填写 QQ 邮箱地址和 16 位授权码（非 QQ 密码）" type="info" show-icon :closable="false" class="mb-4" />
        <ConfigTable :items="emailConfigs" @edit="openEdit" />
      </el-tab-pane>

      <!-- 短信 -->
      <el-tab-pane name="sms">
        <template #label>
          <span class="flex items-center gap-1"><el-icon><ChatDotRound /></el-icon> 短信配置</span>
        </template>
        <el-alert title="配置任意一个短信供应商即可启用短信验证码功能，优先级：腾讯云 > 阿里云 > 百度云 > 火山引擎" type="info" show-icon :closable="false" class="mb-4" />

        <el-collapse v-model="smsCollapse" class="border-0">
          <el-collapse-item name="tencent">
            <template #title>
              <div class="flex items-center gap-2 font-medium">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span> 腾讯云短信
                <el-tag v-if="hasSmsProvider('tencent')" type="success" size="small">已配置</el-tag>
              </div>
            </template>
            <ConfigTable :items="smsTencentConfigs" @edit="openEdit" />
          </el-collapse-item>

          <el-collapse-item name="aliyun">
            <template #title>
              <div class="flex items-center gap-2 font-medium">
                <span class="w-2 h-2 rounded-full bg-orange-500"></span> 阿里云短信
                <el-tag v-if="hasSmsProvider('aliyun')" type="success" size="small">已配置</el-tag>
              </div>
            </template>
            <ConfigTable :items="smsAliyunConfigs" @edit="openEdit" />
          </el-collapse-item>

          <el-collapse-item name="baidu">
            <template #title>
              <div class="flex items-center gap-2 font-medium">
                <span class="w-2 h-2 rounded-full bg-blue-400"></span> 百度云短信
                <el-tag v-if="hasSmsProvider('baidu')" type="success" size="small">已配置</el-tag>
              </div>
            </template>
            <ConfigTable :items="smsBaiduConfigs" @edit="openEdit" />
          </el-collapse-item>

          <el-collapse-item name="volc">
            <template #title>
              <div class="flex items-center gap-2 font-medium">
                <span class="w-2 h-2 rounded-full bg-red-400"></span> 火山引擎短信
                <el-tag v-if="hasSmsProvider('volc')" type="success" size="small">已配置</el-tag>
              </div>
            </template>
            <ConfigTable :items="smsVolcConfigs" @edit="openEdit" />
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>
    </el-tabs>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑配置" width="480px">
      <div v-if="editItem" class="mb-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-500">
        <div><span class="text-gray-400">配置键：</span><code class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{{ editItem.key }}</code></div>
        <div v-if="editItem.remark" class="mt-1">{{ editItem.remark }}</div>
      </div>
      <el-form ref="editFormRef" :model="editForm" label-width="0">
        <el-form-item prop="value" :rules="[{ required: true, message: '请输入配置值' }]">
          <el-input
            v-model="editForm.value"
            :type="isSensitive(editItem?.key) ? 'password' : 'textarea'"
            :rows="3"
            :show-password="isSensitive(editItem?.key)"
            placeholder="请输入配置值"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import { Message, ChatDotRound } from '@element-plus/icons-vue';
import request from '@/utils/request';

// ---- 内联子组件：配置表格 ----
const CONFIG_LABELS: Record<string, string> = {
  platform_fee_rate:           '平台手续费率',
  min_withdraw_amount:         '最小提现金额',
  max_withdraw_amount:         '最大提现金额',
  order_expire_minutes:        '订单超时时间',
  email_from:                  '发件邮箱地址',
  email_from_name:             '发件人名称',
  email_auth_code:             '邮箱授权码',
  sms_tencent_secret_id:       '腾讯云 SecretId',
  sms_tencent_secret_key:      '腾讯云 SecretKey',
  sms_tencent_sdk_app_id:      '短信应用 AppId',
  sms_tencent_sign_name:       '短信签名',
  sms_tencent_template_id:     '短信模板 ID',
  sms_aliyun_access_key_id:    '阿里云 AccessKeyId',
  sms_aliyun_access_key_secret:'阿里云 AccessKeySecret',
  sms_aliyun_sign_name:        '短信签名名称',
  sms_aliyun_template_code:    '短信模板 CODE',
  sms_baidu_access_key:        '百度云 Access Key',
  sms_baidu_secret_key:        '百度云 Secret Key',
  sms_baidu_invoke_id:         '短信服务 Invoke Id',
  sms_baidu_signature_id:      '签名 ID',
  sms_volc_access_key_id:      '火山引擎 AccessKeyId',
  sms_volc_secret_access_key:  '火山引擎 SecretKey',
  sms_volc_sms_account:        '短信账号',
  sms_volc_sign_name:          '短信签名',
  sms_volc_template_id:        '模板 ID',
};

const ConfigTable = defineComponent({
  props: { items: Array as () => any[] },
  emits: ['edit'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'divide-y divide-gray-100' },
        (props.items ?? []).map((item: any) =>
          h('div', {
            class: 'flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors group',
          }, [
            h('div', { class: 'flex-1 min-w-0 mr-4' }, [
              h('div', { class: 'flex items-center gap-2' }, [
                h('span', { class: 'text-sm font-medium text-gray-700' },
                  CONFIG_LABELS[item.key] || item.key
                ),
                item.value
                  ? h('span', { class: 'text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200' }, '已配置')
                  : h('span', { class: 'text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200' }, '未配置'),
              ]),
              h('div', { class: 'text-xs text-gray-400 mt-0.5' }, item.remark),
            ]),
            h('button', {
              class: 'px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 hover:border-blue-300 rounded-md transition-all cursor-pointer opacity-0 group-hover:opacity-100',
              onClick: () => emit('edit', item),
            }, '编辑'),
          ])
        )
      );
  },
});

// ---- 状态 ----
const activeTab   = ref('general');
const smsCollapse = ref(['tencent']);
const configMap   = ref<Record<string, string>>({});
const loading     = ref(false);
const editVisible = ref(false);
const saving      = ref(false);
const editItem    = ref<any>(null);
const editFormRef = ref<FormInstance>();
const editForm    = ref({ value: '' });

// ---- 配置分组定义 ----
const generalConfigs = computed(() => makeItems([
  { key: 'platform_fee_rate',    remark: '平台手续费率（如 0.006 = 0.6%）' },
  { key: 'min_withdraw_amount',  remark: '最小提现金额（元）' },
  { key: 'max_withdraw_amount',  remark: '最大提现金额（元）' },
  { key: 'order_expire_minutes', remark: '订单超时分钟数' },
]));

const emailConfigs = computed(() => makeItems([
  { key: 'email_from',       remark: '发件邮箱地址（如 123456@qq.com）' },
  { key: 'email_from_name',  remark: '发件人名称（显示名）' },
  { key: 'email_auth_code',  remark: 'QQ 邮箱 SMTP 授权码（16位）' },
]));

const smsTencentConfigs = computed(() => makeItems([
  { key: 'sms_tencent_secret_id',   remark: '腾讯云 SecretId' },
  { key: 'sms_tencent_secret_key',  remark: '腾讯云 SecretKey' },
  { key: 'sms_tencent_sdk_app_id',  remark: '短信应用 SDK AppId' },
  { key: 'sms_tencent_sign_name',   remark: '短信签名内容' },
  { key: 'sms_tencent_template_id', remark: '短信模板 ID（含 {1} 验证码变量）' },
]));

const smsAliyunConfigs = computed(() => makeItems([
  { key: 'sms_aliyun_access_key_id',     remark: '阿里云 AccessKeyId' },
  { key: 'sms_aliyun_access_key_secret', remark: '阿里云 AccessKeySecret' },
  { key: 'sms_aliyun_sign_name',         remark: '短信签名名称' },
  { key: 'sms_aliyun_template_code',     remark: '短信模板 CODE（如 SMS_1234567）' },
]));

const smsBaiduConfigs = computed(() => makeItems([
  { key: 'sms_baidu_access_key',   remark: '百度云 Access Key' },
  { key: 'sms_baidu_secret_key',   remark: '百度云 Secret Key' },
  { key: 'sms_baidu_invoke_id',    remark: '短信服务 Invoke Id' },
  { key: 'sms_baidu_signature_id', remark: '签名 ID' },
]));

const smsVolcConfigs = computed(() => makeItems([
  { key: 'sms_volc_access_key_id',     remark: '火山引擎 Access Key ID' },
  { key: 'sms_volc_secret_access_key', remark: '火山引擎 Secret Access Key' },
  { key: 'sms_volc_sms_account',       remark: '短信账号（Sms Account）' },
  { key: 'sms_volc_sign_name',         remark: '短信签名' },
  { key: 'sms_volc_template_id',       remark: '模板 ID' },
]));

function makeItems(defs: { key: string; remark: string }[]) {
  return defs.map((d) => ({ ...d, value: configMap.value[d.key] ?? '' }));
}

function hasSmsProvider(provider: string) {
  const keyMap: Record<string, string> = {
    tencent: 'sms_tencent_secret_id',
    aliyun:  'sms_aliyun_access_key_id',
    baidu:   'sms_baidu_access_key',
    volc:    'sms_volc_access_key_id',
  };
  return !!configMap.value[keyMap[provider]];
}

const SENSITIVE_KEYS = ['auth_code', 'secret', 'key', 'pass', 'token'];
function isSensitive(key?: string) {
  if (!key) return false;
  return SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k));
}

// ---- 数据加载 ----
async function fetchConfigs() {
  loading.value = true;
  try {
    const res: any = await request.get('/configs');
    const map: Record<string, string> = {};
    for (const item of res.data) map[item.key] = item.value;
    configMap.value = map;
  } finally {
    loading.value = false;
  }
}

function openEdit(item: any) {
  editItem.value  = item;
  editForm.value  = { value: item.value };
  editVisible.value = true;
}

async function handleSave() {
  if (!await editFormRef.value?.validate().catch(() => false)) return;
  saving.value = true;
  try {
    await request.put(`/configs/${editItem.value.key}`, {
      value: editForm.value.value,
      remark: editItem.value.remark,
    });
    configMap.value[editItem.value.key] = editForm.value.value;
    ElMessage.success('配置保存成功');
    editVisible.value = false;
  } finally {
    saving.value = false;
  }
}

fetchConfigs();
</script>
