# AI 自动 SEO 优化结果

模型：由共享 AI 客户端模块管理
仓库：wang361999/shouye
执行时间：2026-08-02T06:12:42.581Z

## 摘要

为根布局 layout.tsx 和首页 page.tsx 补充和优化了 SEO metadata。在保持数据库读取站点配置的动态特性的同时，增加了 OpenGraph、Twitter 卡片、title template 模板化支持，以确保全站具有一致且友好的社交分享展示效果。

## 细节

- 优化了 `app/layout.tsx`：为根 layout 增加了 title 模版设置 `template: "%s | ${siteName}"`，以便子页面能自动格式化标题；补充了 `openGraph` 和 `twitter` 元数据，保留了通过 Prisma 数据库读取系统配置的动态逻辑。
- 优化了 `app/page.tsx`：添加了服务端的 `generateMetadata` 函数，使其能通过数据库动态读取配置渲染出“首页 | 站点名”格式的标题、准确的描述以及对应的 OpenGraph 和 Twitter 卡片。

## 已写入文件

- `app/layout.tsx`
- `app/page.tsx`
