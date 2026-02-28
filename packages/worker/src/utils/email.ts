import type { D1Database } from './db';

interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

/** 从 system_configs 读取邮件配置并发送邮件 */
export async function sendEmail(db: D1Database, opts: SendEmailOptions): Promise<void> {
  const rows = await db
    .prepare("SELECT key, value FROM system_configs WHERE key IN ('email_from','email_from_name','email_auth_code')")
    .all<{ key: string; value: string }>();

  const cfg: Record<string, string> = {};
  for (const row of rows.results ?? []) cfg[row.key] = row.value;

  const emailFrom     = cfg['email_from'];
  const emailFromName = cfg['email_from_name'] || '众支付';
  const emailAuthCode = cfg['email_auth_code'];

  if (!emailFrom || !emailAuthCode) {
    throw new Error('邮件服务未配置，请先在系统配置中填写发件邮箱和授权码');
  }

  const body = {
    from:       emailFrom,
    from_name:  emailFromName,
    to:         opts.to,
    subject:    opts.subject,
    smtp_host:  'smtp.qq.com',
    smtp_port:  465,
    smtp_user:  emailFrom,
    smtp_pass:  emailAuthCode,
    use_ssl:    true,
    html:       opts.html ?? opts.text ?? '',
    text:       opts.text ?? '',
  };

  const res = await fetch('https://smtp.amemusic.cn/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`邮件发送失败：${msg}`);
  }

  const json = await res.json<{ success?: boolean; error?: string; message?: string }>().catch(() => null);
  if (json && json.success === false) {
    throw new Error(`邮件发送失败：${json.error ?? json.message ?? '未知错误'}`);
  }
}
