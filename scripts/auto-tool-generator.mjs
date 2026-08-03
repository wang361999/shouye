#!/usr/bin/env node

/**
 * 自动在线工具生成器
 * 调用 AI 生成实用的前端在线工具（纯 HTML/CSS/JS），通过 API 发布到工具库
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[auto-tool-gen]';

function log(message) { console.log(`${TAG} ${message}`); }
function warn(message) { console.warn(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

// ===== 工具类型池 =====
// 每个类型包含名称、描述、AI 提示词中的功能要求
const TOOL_IDEAS = [
  {
    name: 'JSON 格式化工具',
    desc: '在线 JSON 格式化、压缩、校验工具',
    icon: '🔧',
    category: '开发工具',
    requirements: '支持 JSON 输入、格式化（美化）、压缩、校验错误并提示行号、复制结果',
  },
  {
    name: 'Base64 编解码工具',
    desc: 'Base64 编码和解码工具，支持中文',
    icon: '🔐',
    category: '开发工具',
    requirements: '支持文本 Base64 编码和解码、支持中文、显示原始长度和编码后长度、一键复制',
  },
  {
    name: 'URL 编解码工具',
    desc: 'URL 编码和解码工具',
    icon: '🔗',
    category: '开发工具',
    requirements: '支持 URL 编码（encodeURIComponent）和解码、支持批量处理、显示编码前后对比',
  },
  {
    name: '颜色选择器',
    desc: '在线颜色选择和转换工具',
    icon: '🎨',
    category: '设计工具',
    requirements: '支持拾色器选择颜色、HEX/RGB/HSL 互转、显示互补色、复制颜色值',
  },
  {
    name: '正则表达式测试工具',
    desc: '在线正则表达式匹配测试工具',
    icon: '🔍',
    category: '开发工具',
    requirements: '输入正则和测试文本、实时高亮匹配结果、显示匹配数量和捕获组、支持标志位切换',
  },
  {
    name: 'Markdown 预览工具',
    desc: '在线 Markdown 编辑和实时预览工具',
    icon: '📝',
    category: '效率工具',
    requirements: '左侧编辑 Markdown、右侧实时预览渲染、支持标题/列表/代码块/链接/图片/表格、支持复制 HTML',
  },
  {
    name: '密码生成器',
    desc: '随机安全密码生成工具',
    icon: '🔑',
    category: '安全工具',
    requirements: '自定义密码长度（4-64）、选择包含大小写字母/数字/特殊字符、密码强度指示器、一键复制',
  },
  {
    name: 'UUID 生成器',
    desc: '批量生成 UUID/GUID 工具',
    icon: '🆔',
    category: '开发工具',
    requirements: '批量生成 UUID v4、可选生成数量（1-100）、一键复制全部、支持带连字符和不带连字符',
  },
  {
    name: '时间戳转换工具',
    desc: 'Unix 时间戳和日期互转工具',
    icon: '⏰',
    category: '开发工具',
    requirements: '时间戳转日期、日期转时间戳、支持秒和毫秒、显示当前时间戳、支持本地和 UTC',
  },
  {
    name: 'CSS 渐变生成器',
    desc: '在线 CSS 渐变色生成工具',
    icon: '🌈',
    category: '设计工具',
    requirements: '可视化调整线性/径向渐变、支持多色停止点、调整角度、生成 CSS 代码并复制',
  },
  {
    name: 'HTML 实体编码工具',
    desc: 'HTML 特殊字符编码解码工具',
    icon: ' &lt;/&gt;',
    category: '开发工具',
    requirements: 'HTML 实体编码和解码、支持 < > & " 等特殊字符、实时转换、批量处理',
  },
  {
    name: '二维码生成器',
    desc: '在线二维码生成工具',
    icon: '📱',
    category: '效率工具',
    requirements: '输入文本或 URL 生成二维码、可选尺寸、可选纠错等级、可下载为 PNG',
  },
  {
    name: '文本差异对比工具',
    desc: '在线文本 Diff 对比工具',
    icon: '📋',
    category: '开发工具',
    requirements: '左右输入两段文本、逐行对比差异、高亮增删行、显示差异统计',
  },
  {
    name: '单位换算工具',
    desc: '长度、重量、温度等单位换算',
    icon: '📐',
    category: '效率工具',
    requirements: '支持长度/重量/温度/面积/速度等多类别、实时换算、双向输入',
  },
  {
    name: 'HTTP 状态码查询',
    desc: 'HTTP 状态码含义查询工具',
    icon: '🌐',
    category: '开发工具',
    requirements: '搜索 HTTP 状态码、显示含义和使用场景、按 1xx-5xx 分类浏览',
  },
  {
    name: 'CSV 转换工具',
    desc: 'CSV 与 JSON 互转工具',
    icon: '📊',
    category: '开发工具',
    requirements: 'CSV 转 JSON、JSON 转 CSV、支持自定义分隔符、显示转换结果并复制',
  },
  {
    name: '图片尺寸压缩器',
    desc: '在线图片压缩工具',
    icon: '🖼️',
    category: '效率工具',
    requirements: '上传图片、调整质量、预览压缩效果、显示压缩前后大小、下载压缩图片',
  },
  {
    name: 'Lorem 文本生成器',
    desc: '占位文本生成工具',
    icon: '📃',
    category: '效率工具',
    requirements: '生成 Lorem Ipsum 占位文本、可选段落数/句子数/单词数、一键复制',
  },
  {
    name: 'CSS 阴影生成器',
    desc: '在线 CSS Box-Shadow 生成工具',
    icon: '影子',
    category: '设计工具',
    requirements: '可视化调整阴影参数（偏移、模糊、扩散、颜色）、实时预览效果、生成 CSS 代码并复制',
  },
  {
    name: 'JWT 解码器',
    desc: 'JWT Token 解码查看工具',
    icon: '🎫',
    category: '开发工具',
    requirements: '粘贴 JWT Token、解码 Header 和 Payload、显示过期时间、格式化 JSON 输出',
  },
];

// ===== 登录管理员账号 =====
async function login() {
  log(`登录 ${SITE_URL} ...`);
  try {
    const res = await siteFetch(`${SITE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      fail(`登录失败：${res.status} ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    if (!data.token) fail('登录返回中没有 token');
    log(`登录成功，用户：${data.user?.username}`);
    return data.token;
  } catch (error) {
    fail(`登录异常：${error?.message || error}`);
  }
}

// ===== 获取已有工具列表（避免重复） =====
async function fetchExistingTools(token) {
  try {
    const res = await siteFetch(`${SITE_URL}/api/tools?isActive=all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const tools = await res.json();
    return Array.isArray(tools) ? tools.map(t => t.name) : [];
  } catch {
    return [];
  }
}

// ===== 随机选择一个工具创意（避免重复） =====
function pickToolIdea(existingNames) {
  const available = TOOL_IDEAS.filter(idea => !existingNames.includes(idea.name));
  if (available.length === 0) {
    // 所有预设工具都已存在，随机选一个加后缀
    const base = TOOL_IDEAS[Math.floor(Math.random() * TOOL_IDEAS.length)];
    const suffix = Math.floor(Math.random() * 900 + 100);
    return { ...base, name: `${base.name} ${suffix}` };
  }
  return available[Math.floor(Math.random() * available.length)];
}

// ===== 调用 AI 生成工具 =====
async function generateTool(idea) {
  log(`调用 AI 生成工具：${idea.name} ...`);

  const prompt = `你是一个前端开发专家。请生成一个完整的、可直接在浏览器中运行的在线工具。

## 工具信息
- 名称：${idea.name}
- 描述：${idea.desc}
- 功能要求：${idea.requirements}

## 技术要求
1. 输出一个完整的 HTML 文件内容（包含 HTML、CSS、JavaScript）。
2. 所有代码必须内联在单个 HTML 文件中，不依赖外部 CDN 或库（纯原生 HTML/CSS/JS）。
3. 界面必须美观现代：使用渐变、阴影、圆角等现代 CSS 技术，配色协调。
4. 响应式布局，在手机和桌面端都能正常使用。
5. 功能必须完整可用，不能有占位符或"TODO"。
6. 所有交互必须有反馈（如复制成功提示、输入校验提示等）。
7. 不使用 alert/prompt/confirm，用自定义 toast 或内联提示。
8. 代码注释用中文。

## 安全要求
1. 不使用 eval() 或 new Function()。
2. 不加载任何外部资源。
3. 不包含任何恶意代码。

## 输出格式

只输出一个 JSON 对象，不要输出任何其他文字，不要用 markdown 代码块包裹：
{
  "name": "${idea.name}",
  "description": "${idea.desc}",
  "icon": "${idea.icon}",
  "category": "${idea.category}",
  "htmlContent": "完整的 HTML 文件代码，注意：代码中的换行用 \\n 表示，双引号用 \\\" 转义",
  "summary": "一句话工具使用说明"
}`;

  const content = await callAI({
    prompt,
    systemPrompt: '你是前端开发专家，擅长创建美观实用的在线工具。必须只输出一个有效的 JSON 对象，htmlContent 字段包含完整的 HTML 文件代码。不要包含任何 markdown 代码块标记或其他文字。',
    maxTokens: 12000,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  // 解析 AI 返回
  const parsed = robustJSONParse(content);
  if (!parsed.htmlContent || parsed.htmlContent.length < 200) {
    fail(`AI 生成的工具内容太短或不完整，htmlContent 长度：${parsed.htmlContent?.length || 0}`);
  }

  log(`工具生成完成，HTML 长度：${parsed.htmlContent.length}`);
  return parsed;
}

// ===== 发布工具到站点 =====
async function publishTool(token, toolData) {
  const body = {
    name: toolData.name,
    description: toolData.description,
    url: `#embedded-${Date.now()}`,
    icon: toolData.icon || '🛠️',
    category: toolData.category || '开发工具',
    toolType: 'embedded',
    htmlContent: toolData.htmlContent,
    isActive: true,
    isFeatured: false,
    sortOrder: 0,
  };

  log(`发布工具到 ${SITE_URL}/api/tools ...`);

  const res = await siteFetch(`${SITE_URL}/api/tools`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`发布工具失败：${res.status} ${text.slice(0, 300)}`);
  }

  const result = await res.json();
  log(`工具发布成功！ID：${result.id || '未知'}`);
  return result;
}

// ===== 主流程 =====
async function main() {
  log('=== 自动工具生成任务开始 ===');

  // 预检 AI API
  const healthyModel = await checkAIHealth(TAG);
  if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
  log(`使用 AI 模型：${healthyModel}`);

  // 登录
  const token = await login();

  // 获取已有工具，避免重复
  const existingNames = await fetchExistingTools(token);
  log(`已有 ${existingNames.length} 个工具`);

  // 随机选一个工具创意
  const idea = pickToolIdea(existingNames);
  log(`本次生成：${idea.name}（${idea.desc}）`);

  // AI 生成工具
  const toolData = await generateTool(idea);

  // 发布工具
  const result = await publishTool(token, toolData);

  log('=== 自动工具生成任务完成 ===');
  log(`工具：${toolData.name} | 分类：${toolData.category} | HTML 长度：${toolData.htmlContent.length}`);
}

main().catch((error) => {
  fail(`未捕获的错误：${error?.stack || error}`);
});
