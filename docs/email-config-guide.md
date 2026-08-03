# Gitd 邮箱配置指南（Resend）

## 概述

Gitd 使用 [Resend](https://resend.com) API 发送邮件，用于用户注册验证码、系统通知等功能。

配置入口位于管理后台：

> 管理后台 → 系统设置 → 安全设置 → 邮箱服务配置

邮件 API Key 和发信邮箱存储在**数据库**中（非环境变量），迁移 Vercel 账号时随数据库一起迁移，无需额外操作。

---

## 配置步骤

### 第一步：创建 Resend 账号

1. 访问 [resend.com](https://resend.com) 注册账号
2. 进入 Dashboard → **API Keys**
3. 点击 **Create API Key**
4. 名称随意（如 `gitd`），权限选择 **Sending access**
5. 复制生成的 API Key（格式：`re_xxxxxxxx`），**仅显示一次**

### 第二步：验证发信域名（推荐）

Resend 默认提供 `on.resend.com` 域名用于测试，生产环境建议验证自有域名：

1. 进入 Dashboard → **Domains**
2. 点击 **Add Domain**
3. 输入你的域名（如 `gitd.cn`）
4. 按提示在 DNS 服务商添加以下记录：
   - **SPF 记录**：TXT 类型，值为 `v=spf1 include:amazonses.com ~all`
   - **DKIM 记录**：CNAME 类型，指向 Resend 提供的值
   - **DMARC 记录**（可选）：TXT 类型，值为 `v=DMARC1; p=none;`
5. 回到 Resend 点击 **Verify**，等待验证通过（通常几分钟到几小时）

> 域名验证后，发信地址可以使用 `noreply@yourdomain.com`，到达率和信誉更高。

### 第三步：在后台填写配置

在安全设置页面的「邮箱服务配置」区域填写：

| 字段 | 说明 | 示例 |
|------|------|------|
| **Resend API Key** | Resend 创建的 API Key | `re_xxxxxxxx` |
| **发信邮箱** | 发件人地址，需使用已验证的域名 | `noreply@gitd.cn` |

### 第四步：测试

1. 保存配置
2. 在「测试邮件」区域输入收件邮箱
3. 点击发送测试邮件
4. 检查收件箱，收到测试邮件即配置成功

---

## 不使用环境变量

之前版本通过 Vercel 环境变量配置邮件，现已改为数据库存储：

- API Key 和发信邮箱存在 `SystemSetting` 表中
- 迁移到新 Vercel 账号时，**无需手动迁移环境变量**
- 配置随数据库一起迁移，开箱即用

---

## 常见问题排查

### 发送失败：API Key 无效
- 确认 API Key 以 `re_` 开头
- 确认没有多余空格或换行
- 在 Resend Dashboard 确认 Key 未被撤销

### 发送失败：发信邮箱未验证
- 使用 `on.resend.com` 测试域名时，发信地址必须为 `onboarding@resend.dev`
- 使用自有域名前，确保已在 Resend 完成域名验证
- 验证状态可在 Resend → Domains 查看

### 邮件进入垃圾箱
- 确保已配置 SPF、DKIM、DMARC 记录
- 发信邮箱的域名与发件人地址一致
- 避免短时间内大量发送

### 测试邮件未收到
- 检查垃圾邮件文件夹
- 确认收件地址正确
- 查看 Vercel 函数日志中的错误信息

---

## 安全建议

1. API Key 存储在数据库中，不要提交到代码仓库
2. 定期在 Resend Dashboard 检查发送量和异常
3. 如不需要邮件功能，可以不配置，不影响其他功能使用
4. Resend 免费额度：每月 3000 封、100 封/天，足够中小站点使用

---

## 迁移说明

从 SMTP 迁移到 Resend 的原因：

- **Serverless 兼容**：SMTP 需要长连接，Vercel Serverless 函数不支持
- **更简单**：无需配置 SMTP 服务器、端口、加密方式
- **更稳定**：Resend 提供 API 请求方式，无连接超时问题
- **免费额度充足**：每月 3000 封免费发送
