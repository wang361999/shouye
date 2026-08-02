# 用户协议与隐私政策 - 功能文档

## 功能概述

Gitd 内置了完整的**用户协议**和**隐私政策**功能，包括：

- 前台展示页面（Markdown 渲染）
- 后台在线编辑管理（支持 Markdown 实时编辑）
- 数据库持久化存储（修改后前台立即生效）
- 默认内容内置（首次部署自动初始化）

---

## 页面地址

| 页面 | 地址 | 说明 |
|------|------|------|
| 用户协议（前台） | `/agreements/terms` | 公开访问，无需登录 |
| 隐私政策（前台） | `/agreements/privacy` | 公开访问，无需登录 |
| 协议管理（后台） | `/admin/settings/agreements` | 需管理员登录 |

---

## 技术架构

### 数据存储

协议内容存储在 `SystemSetting` 表中，使用以下两个 key：

| key | 说明 |
|-----|------|
| `agreement_terms` | 用户协议内容（Markdown 格式） |
| `agreement_privacy` | 隐私政策内容（Markdown 格式） |

> 无需单独建表，复用现有的 `SystemSetting` 模型，通过 key 区分。

### 文件结构

```
lib/
  default-agreements.ts          # 默认协议内容（Markdown）

app/
  api/
    agreements/
      route.ts                   # API 接口（GET 获取 / POST 更新）
  agreements/
    [type]/
      page.tsx                   # 前台展示页面（动态路由）
  admin/
    settings/
      agreements/
        page.tsx                 # 后台编辑管理页面

components/
  common/
    Footer.tsx                   # 页脚链接（已更新指向 /agreements/terms 和 /agreements/privacy）
```

### API 接口

#### GET `/api/agreements?type=terms`

获取用户协议内容。

**参数：**
- `type`: `terms` 或 `privacy`

**响应：**
```json
{
  "type": "terms",
  "content": "# 用户协议\n\n..."
}
```

**说明：** 公开接口，无需鉴权。如果数据库中没有记录，返回内置默认内容。

#### POST `/api/agreements`

更新协议内容（需管理员权限）。

**请求头：**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体：**
```json
{
  "type": "terms",
  "content": "# 用户协议\n\n更新后的内容..."
}
```

**响应：**
```json
{
  "message": "用户协议已保存"
}
```

---

## 使用方法

### 前台查看

1. 页面底部页脚的「用户协议」和「隐私政策」链接直接指向对应页面
2. 也可以直接访问 `/agreements/terms` 或 `/agreements/privacy`
3. 页面支持 Markdown 渲染，包含标题、列表、加粗、引用等

### 后台编辑

1. 登录管理后台
2. 进入 **系统设置 → 协议文档**
3. 通过顶部 Tab 切换「用户协议」和「隐私政策」
4. 在编辑框中修改内容（支持 Markdown 语法）
5. 点击「保存修改」按钮，前台立即生效
6. 点击「恢复默认」可恢复初始内容（需再次点击保存）
7. 点击「在新窗口预览」可查看前台效果

---

## 默认内容

默认的用户协议和隐私政策内置在 `lib/default-agreements.ts` 中，包含以下章节：

### 用户协议

1. 服务说明
2. 用户注册与账号
3. 用户行为规范
4. 内容管理
5. 免责声明
6. 协议变更
7. 法律适用

### 隐私政策

1. 收集的信息
2. 信息使用方式
3. 信息存储与保护
4. 信息共享
5. 用户权利
6. Cookie 使用
7. 未成年人保护
8. 隐私政策变更
9. 联系方式

---

## 部署说明

### 首次部署

部署时 `db-setup.mjs` 脚本会自动执行 `prisma seed`，将默认协议内容写入数据库。

### 数据库初始化

协议内容在种子脚本（`prisma/seed.ts`）中初始化：
- 检查 `agreement_terms` 和 `agreement_privacy` 是否已存在
- 如不存在则写入默认内容
- 如已存在则跳过（不会覆盖已有修改）

### 注意事项

1. **修改后立即生效**：后台保存后前台实时显示最新内容
2. **不会丢失修改**：重新部署时不会覆盖已修改的协议内容
3. **恢复默认**：后台提供「恢复默认」按钮，加载初始内容后需手动保存
4. **内容限制**：协议内容最大 100,000 字符
5. **Markdown 支持**：完整支持 GFM（GitHub Flavored Markdown）语法

---

## 自定义指南

### 修改默认协议内容

编辑 `lib/default-agreements.ts` 文件中的 `DEFAULT_TERMS` 和 `DEFAULT_PRIVACY` 常量。

> 注意：修改默认内容仅影响新部署，已有数据库中的内容不会被覆盖。如需更新已部署的协议，请在后台管理页面修改。

### 添加新协议类型

1. 在 `lib/default-agreements.ts` 中添加默认内容
2. 在 API 路由中扩展 type 支持
3. 在后台管理页面添加对应 Tab
4. 在前台页面添加对应路由
