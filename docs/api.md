# API 接口文档

> **版权**：本文档及项目由 [AME](https://github.com/AME-CoLtd) 维护，基于 Apache 2.0 开源。

## 基础信息

- **Base URL（本地）**：`http://localhost:3000`
- **Base URL（生产）**：你的部署域名
- **数据格式**：`application/json`
- **字符编码**：`UTF-8`

## 统一响应格式

```json
{
  "code": 0,          // 0 表示成功，非 0 表示失败
  "message": "成功",  // 提示信息
  "data": {}          // 响应数据（失败时可能为空）
}
```

### 通用错误码

| code | 说明 |
|------|------|
| `0` | 成功 |
| `400` | 请求参数错误 |
| `401` | 未认证或 Token 失效 |
| `403` | 无权限 |
| `404` | 资源不存在 |
| `429` | 请求过于频繁 |
| `500` | 服务器内部错误 |

---

## 认证方式

管理后台接口使用 **Bearer Token** 认证：

```http
Authorization: Bearer <your_jwt_token>
```

商户支付接口使用 **MD5 签名** 认证（见下方签名规则）。

---

## 一、管理认证接口

### 1.1 管理员登录

```http
POST /api/auth/login
```

**请求体：**

```json
{
  "username": "admin",
  "password": "Admin@123456"
}
```

**成功响应：**

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@zhongpay.com",
      "role": "SUPER_ADMIN"
    }
  }
}
```

---

### 1.2 获取当前用户信息

```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

### 1.3 修改密码

```http
PUT /api/auth/password
Authorization: Bearer <token>
```

```json
{
  "oldPassword": "旧密码",
  "newPassword": "新密码（最少8位）"
}
```

---

## 二、支付接口（商户调用）

### 签名规则

1. 将所有非空参数（除 `sign` 外）按**字段名 ASCII 码升序**排列
2. 拼接成 `key1=val1&key2=val2` 格式字符串
3. 末尾拼接 `&key=<你的API_SECRET>`
4. 对整个字符串做 **MD5** 取值，转大写

**示例（Node.js）：**

```javascript
const crypto = require('crypto');

function generateSign(params, apiSecret) {
  const sorted = Object.keys(params)
    .filter(k => params[k] !== '' && params[k] != null && k !== 'sign')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&') + `&key=${apiSecret}`;
  return crypto.createHash('md5').update(sorted).digest('hex').toUpperCase();
}
```

---

### 2.1 统一下单

```http
POST /api/pay/unified
Content-Type: application/json
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiKey` | string | ✅ | 商户 API Key |
| `outTradeNo` | string | ✅ | 商户订单号（唯一） |
| `subject` | string | ✅ | 商品名称 |
| `amount` | number | ✅ | 订单金额（元，最小 0.01） |
| `channel` | string | ✅ | 支付渠道（见下表） |
| `sign` | string | ✅ | MD5 签名 |
| `body` | string | ❌ | 商品详情 |
| `notifyUrl` | string | ❌ | 回调地址（覆盖商户配置） |
| `returnUrl` | string | ❌ | 支付完成跳转地址 |
| `clientIp` | string | ❌ | 客户端 IP |

**支付渠道（channel）：**

| 渠道值 | 说明 |
|--------|------|
| `ALIPAY_PC` | 支付宝 PC 网站支付 |
| `ALIPAY_WAP` | 支付宝手机网站支付 |
| `ALIPAY_QRCODE` | 支付宝扫码支付 |
| `WECHAT_NATIVE` | 微信 Native 扫码支付 |
| `WECHAT_H5` | 微信 H5 支付 |

**成功响应示例（ALIPAY_PC）：**

```json
{
  "code": 0,
  "message": "下单成功",
  "data": {
    "orderNo": "ZP202401011234001",
    "outTradeNo": "YOUR_ORDER_001",
    "amount": "99.00",
    "channel": "ALIPAY_PC",
    "expiredAt": "2024-01-01T00:30:00.000Z",
    "payUrl": "https://openapi.alipay.com/gateway.do?..."
  }
}
```

**成功响应示例（WECHAT_NATIVE）：**

```json
{
  "code": 0,
  "data": {
    "orderNo": "ZP202401011234001",
    "codeUrl": "weixin://wxpay/bizpayurl?pr=xxx"
  }
}
```

---

### 2.2 查询订单状态

```http
GET /api/pay/query?apiKey=xx&orderNo=xx&sign=xx
```

**请求参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `apiKey` | ✅ | 商户 API Key |
| `orderNo` | 二选一 | 平台订单号 |
| `outTradeNo` | 二选一 | 商户订单号 |
| `sign` | ✅ | MD5 签名 |

**响应：**

```json
{
  "code": 0,
  "data": {
    "orderNo": "ZP202401011234001",
    "outTradeNo": "YOUR_ORDER_001",
    "status": "PAID",
    "amount": "99.00",
    "actualAmount": "99.00",
    "paidAt": "2024-01-01T00:05:00.000Z"
  }
}
```

**订单状态：**

| 状态 | 说明 |
|------|------|
| `PENDING` | 待支付 |
| `PAID` | 已支付 |
| `CLOSED` | 已关闭 |
| `REFUNDING` | 退款中 |
| `REFUNDED` | 已退款 |
| `FAILED` | 失败 |

---

## 三、支付回调通知

### 3.1 商户回调接收（由众支付主动通知）

支付成功后，众支付会向商户配置的 `notifyUrl` 发送 POST 请求：

```json
{
  "orderNo": "ZP202401011234001",
  "outTradeNo": "YOUR_ORDER_001",
  "status": "PAID",
  "amount": 99.00,
  "paidAt": "2024-01-01T00:05:00.000Z"
}
```

> 商户系统需返回 HTTP 200 状态码，否则系统将重试（最多 5 次，间隔递增）。

---

### 3.2 支付宝异步回调

```http
POST /api/notify/alipay
```

由支付宝直接调用，内部处理后返回 `success` 字符串。

### 3.3 微信支付异步回调

```http
POST /api/notify/wechat
```

由微信直接调用，内部处理后返回 XML 格式响应。

---

## 四、管理接口（需 JWT 认证）

### 4.1 订单管理

```http
GET /api/orders?page=1&pageSize=20&status=PAID&payType=ALIPAY
GET /api/orders/:id
POST /api/orders/:id/close
```

### 4.2 商户管理

```http
GET    /api/merchants
POST   /api/merchants
GET    /api/merchants/:id
PUT    /api/merchants/:id
POST   /api/merchants/:id/reset-key
```

### 4.3 提现管理

```http
GET  /api/withdrawals
POST /api/withdrawals/:id/audit   # { action: "APPROVE" | "REJECT" }
POST /api/withdrawals/:id/transfer
```

### 4.4 数据统计

```http
GET /api/stats/overview
GET /api/stats/trend?days=7
GET /api/stats/channel
```

### 4.5 系统配置

```http
GET /api/configs
PUT /api/configs/:key
```

---

## 五、健康检查

```http
GET /health
```

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "众支付"
}
```

---

> **文档维护**：[AME](https://github.com/AME-CoLtd) · 如发现文档错误请 [提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=bug_report.md)
