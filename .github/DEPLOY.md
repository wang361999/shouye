# GitHub Actions 部署配置

## 自动部署流程

```
git push origin main
       │
       ├──→ Vercel（原生 Git 集成，自动触发部署）
       │
       └──→ GitHub Actions → Cloudflare Workers（通过 deploy.yml）
```

每次 push 到 `main` 分支时，两个平台会同时自动部署。

## 需要配置的 GitHub Secrets

在 GitHub 仓库 → Settings → Secrets and variables → Actions 中添加以下 Secrets：

| Secret 名称 | 说明 | 示例值 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 | `cfut_xxxxx` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | `6a95c5b22e021829832e7324bcc8c962` |
| `DATABASE_URL` | Turso 数据库连接地址 | `libsql://shouye-xxx.turso.io` |
| `DATABASE_AUTH_TOKEN` | Turso 数据库访问令牌 | `eyJhbGci...` |
| `JWT_SECRET` | JWT 签名密钥 | `your-jwt-secret` |

> 注意：Vercel 的环境变量需要在 Vercel Dashboard → Settings → Environment Variables 中单独配置。

## 手动触发部署

在 GitHub 仓库 → Actions → Deploy → Run workflow 可手动触发 Cloudflare 部署。

## Vercel 端配置

Vercel 只需在 Dashboard 中连接 GitHub 仓库即可：
1. 进入 Vercel Dashboard → New Project
2. 导入对应的 GitHub 仓库
3. Framework Preset 选择 Next.js
4. 在 Environment Variables 中配置 `DATABASE_URL`、`DATABASE_AUTH_TOKEN`、`JWT_SECRET` 等
5. Deploy

之后每次 push 到 main 分支，Vercel 会自动部署。
