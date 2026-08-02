/**
 * 数据库种子脚本
 * 创建初始管理员账号、论坛分类、示例工具和欢迎帖
 *
 * 用法：npx tsx prisma/seed.ts
 *
 * 环境变量：
 *   DATABASE_URL          - 数据库连接字符串（必需）
 *   JWT_SECRET            - JWT 密钥（必需）
 *   ADMIN_USERNAME        - 管理员用户名（默认 admin）
 *   ADMIN_PASSWORD        - 管理员密码（默认 admin123）
 *   ADMIN_EMAIL           - 管理员邮箱（默认 admin@ethhy.com）
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_TERMS, DEFAULT_PRIVACY } from '../lib/default-agreements';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种数据库...\n');

  // ============ 1. 创建管理员账号 ============
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ethhy.com';

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  let adminUser;
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        avatar: '👨‍💻',
      },
    });
    console.log(`✅ 创建管理员账号：${adminUsername} / ${adminPassword}`);
  } else {
    adminUser = existingAdmin;
    console.log(`ℹ️  管理员账号已存在：${adminUsername}（跳过）`);
  }

  // ============ 2. 创建论坛分类 ============
  const categories = [
    { name: '公告', slug: 'announcement', icon: '📢', desc: '官方公告与重要通知', sortOrder: 1 },
    { name: '反馈建议', slug: 'feedback', icon: '💬', desc: '产品反馈与功能建议', sortOrder: 2 },
    { name: '使用教程', slug: 'tutorial', icon: '📖', desc: '工具使用教程与经验分享', sortOrder: 3 },
    { name: '闲聊', slug: 'chat', icon: '🗣️', desc: '开发者日常闲聊', sortOrder: 4 },
  ];

  const categoryRecords = [];
  for (const cat of categories) {
    const existing = await prisma.category.findUnique({
      where: { slug: cat.slug },
    });
    if (existing) {
      categoryRecords.push(existing);
      console.log(`ℹ️  分类已存在：${cat.name}（跳过）`);
    } else {
      const created = await prisma.category.create({ data: cat });
      categoryRecords.push(created);
      console.log(`✅ 创建分类：${cat.icon} ${cat.name}`);
    }
  }

  const announcementCat = categoryRecords.find((c) => c.slug === 'announcement')!;
  const tutorialCat = categoryRecords.find((c) => c.slug === 'tutorial')!;
  const feedbackCat = categoryRecords.find((c) => c.slug === 'feedback')!;

  // ============ 3. 创建示例工具 ============
  const tools = [
    {
      name: 'ZIP一键上传GitHub',
      description: '将本地 ZIP 压缩包一键解压并上传到 GitHub 仓库，无需配置 Git 环境。',
      url: '#zip-upload-github',
      icon: '📦',
      category: '代码工具',
      isActive: true,
      isFeatured: true,
      needLogin: false,
      sortOrder: 100,
    },
    {
      name: 'AI Commit生成器',
      description: '基于 AI 自动分析代码变更，生成规范的 commit message，支持中英文。',
      url: '#ai-commit-generator',
      icon: '🤖',
      category: 'AI工具',
      isActive: true,
      isFeatured: true,
      needLogin: false,
      sortOrder: 99,
    },
    {
      name: '代码格式化工具',
      description: '支持多种语言的在线代码格式化和美化工具。',
      url: '#code-formatter',
      icon: '🎨',
      category: '代码工具',
      isActive: true,
      isFeatured: false,
      needLogin: false,
      sortOrder: 98,
    },
    {
      name: 'JSON 格式化',
      description: 'JSON 数据格式化、压缩、转义、校验一体化工具。',
      url: '#json-formatter',
      icon: '🔧',
      category: '效率工具',
      isActive: true,
      isFeatured: false,
      needLogin: false,
      sortOrder: 97,
    },
  ];

  for (const tool of tools) {
    const existing = await prisma.tool.findFirst({
      where: { name: tool.name },
    });
    if (existing) {
      console.log(`ℹ️  工具已存在：${tool.icon} ${tool.name}（跳过）`);
    } else {
      await prisma.tool.create({ data: tool });
      console.log(`✅ 创建工具：${tool.icon} ${tool.name}`);
    }
  }

  // ============ 4. 创建欢迎帖 ============
  const welcomePostTitle = '欢迎来到 Gitd 社区';
  const existingWelcome = await prisma.post.findFirst({
    where: { title: welcomePostTitle },
  });

  if (!existingWelcome) {
    await prisma.post.create({
      data: {
        title: welcomePostTitle,
        content: `# 欢迎来到 Gitd 社区 🎉

大家好！欢迎来到 **Gitd** 开发者社区。

## 在这里你可以

- 📢 获取最新的产品公告和更新动态
- 💬 提交反馈和功能建议
- 📖 分享和阅读使用教程
- 🗣️ 和其他开发者闲聊交流

## 社区规则

1. **友好交流**：尊重每一位社区成员
2. **内容相关**：请到对应分类下发帖
3. **禁止广告**：请勿发布无关广告内容

## 快速开始

- 浏览 [工具列表](/) 发现实用工具
- 点击右上角「登录」使用管理员账号管理内容
- 在 [论坛](/forum) 发布你的第一篇帖子

如有问题，请在「反馈建议」分类下发帖，我们会尽快回复。

祝大家使用愉快！ 🚀`,
        categoryId: announcementCat.id,
        authorId: adminUser.id,
        status: 'PUBLISHED',
        isPinned: true,
        isEssence: true,
      },
    });
    console.log('✅ 创建欢迎帖（置顶+精华）');
  } else {
    console.log('ℹ️  欢迎帖已存在（跳过）');
  }

  // ============ 5. 创建示例教程帖 ============
  const tutorialTitle = '如何一键上传代码到 GitHub';
  const existingTutorial = await prisma.post.findFirst({
    where: { title: tutorialTitle },
  });

  if (!existingTutorial) {
    await prisma.post.create({
      data: {
        title: tutorialTitle,
        content: `# 如何一键上传代码到 GitHub 📦

本教程介绍如何使用 Gitd 的 **ZIP一键上传GitHub** 工具。

## 使用步骤

### 1. 准备 ZIP 文件

将你的项目代码打包为 ZIP 压缩文件。

### 2. 打开工具

访问首页，点击「ZIP一键上传GitHub」工具卡片。

### 3. 配置仓库信息

- 输入 GitHub 用户名
- 输入仓库名称（不存在会自动创建）
- 粘贴 GitHub Personal Access Token

### 4. 上传

选择 ZIP 文件，点击「上传」按钮即可。

## 获取 GitHub Token

\`\`\`
GitHub → Settings → Developer settings → Personal access tokens → Generate new token
\`\`\`

勾选 \`repo\` 权限即可。

## 常见问题

**Q: 上传失败怎么办？**
A: 检查 Token 是否有效、权限是否包含 repo。

**Q: 文件大小有限制吗？**
A: 建议 ZIP 不超过 50MB。

---
有问题欢迎在评论区留言！ 👇`,
        categoryId: tutorialCat.id,
        authorId: adminUser.id,
        status: 'PUBLISHED',
        isEssence: true,
      },
    });
    console.log('✅ 创建示例教程帖（精华）');
  } else {
    console.log('ℹ️  示例教程帖已存在（跳过）');
  }

  // ============ 6. 创建示例反馈帖 ============
  const feedbackTitle = '建议增加批量上传功能';
  const existingFeedback = await prisma.post.findFirst({
    where: { title: feedbackTitle },
  });

  if (!existingFeedback) {
    await prisma.post.create({
      data: {
        title: feedbackTitle,
        content: `## 功能建议

目前 ZIP 上传工具一次只能上传一个文件，希望能支持**批量上传**功能。

### 具体需求

- 支持同时选择多个 ZIP 文件
- 每个文件上传到独立的仓库或分支
- 显示上传进度和结果汇总

### 使用场景

同时维护多个小项目时，逐个上传比较繁琐。批量上传能大幅提升效率。

希望团队能考虑这个建议，谢谢！ 🙏`,
        categoryId: feedbackCat.id,
        authorId: adminUser.id,
        status: 'PUBLISHED',
      },
    });
    console.log('✅ 创建示例反馈帖');
  } else {
    console.log('ℹ️  示例反馈帖已存在（跳过）');
  }

  // ============ 7. 初始化系统设置 ============
  const defaultSettings: { key: string; value: string }[] = [
    { key: 'site_name', value: 'Gitd' },
    { key: 'site_description', value: '开发者工具与社区' },
    { key: 'site_logo', value: '' },
    { key: 'site_favicon', value: '' },
    { key: 'theme_color', value: '#3B82F6' },
    { key: 'dark_mode', value: 'false' },
    { key: 'hero_title', value: '让工具回归工具' },
    { key: 'hero_subtitle', value: '汇聚实用开发者工具' },
    { key: 'home_layout', value: 'grid' },
    { key: 'admin_path', value: 'admin' },
    { key: 'login_fail_limit', value: '5' },
    { key: 'login_lock_minutes', value: '10' },
    { key: 'email_verify', value: 'false' },
    { key: 'captcha', value: 'false' },
    { key: 'seo_title', value: 'Gitd - 开发者工具集' },
    { key: 'seo_keywords', value: '开发者,工具,GitHub,AI' },
    { key: 'seo_description', value: '汇聚实用开发者工具，让效率翻倍' },
  ];

  let settingsCount = 0;
  for (const s of defaultSettings) {
    const existing = await prisma.systemSetting.findUnique({ where: { key: s.key } });
    if (!existing) {
      await prisma.systemSetting.create({ data: s });
      settingsCount++;
    }
  }
  if (settingsCount > 0) {
    console.log(`✅ 初始化系统设置（${settingsCount} 项）`);
  } else {
    console.log('ℹ️  系统设置已存在（跳过）');
  }

  // ============ 8. 初始化协议文档 ============
  const agreements: { key: string; value: string }[] = [
    { key: 'agreement_terms', value: DEFAULT_TERMS },
    { key: 'agreement_privacy', value: DEFAULT_PRIVACY },
  ];

  let agreementsCount = 0;
  for (const a of agreements) {
    const existing = await prisma.systemSetting.findUnique({ where: { key: a.key } });
    if (!existing) {
      await prisma.systemSetting.create({ data: a });
      agreementsCount++;
    }
  }
  if (agreementsCount > 0) {
    console.log(`✅ 初始化协议文档（${agreementsCount} 项）`);
  } else {
    console.log('ℹ️  协议文档已存在（跳过）');
  }

  console.log('\n✨ 数据库播种完成！');
  console.log(`\n📋 登录信息：`);
  console.log(`   用户名：${adminUsername}`);
  console.log(`   密码：${adminPassword}`);
  console.log(`   登录地址：/admin/login`);
}

main()
  .catch((e) => {
    console.error('❌ 播种失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
