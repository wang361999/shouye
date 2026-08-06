"use client";

import { useState } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";

// ============ Prompt 模板定义 ============
interface PromptTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  variables: { key: string; label: string; type: "text" | "textarea" | "select";
    options?: string[];
    placeholder?: string;
    defaultValue?: string;
  }[];
  build: (vars: Record<string, string>) => string;
  tips?: string[];
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  // 写代码相关
  {
    id: "code-optimize",
    name: "代码优化专家",
    icon: "⚡",
    category: "写代码",
    description: "让 AI 帮你优化代码，提升性能、可读性和可维护性",
    variables: [
      { key: "language", label: "编程语言", type: "select", options: ["JavaScript/TypeScript", "Python", "Java", "Go", "Rust", "C++", "其他"] },
      { key: "code", label: "待优化的代码", type: "textarea", placeholder: "粘贴你的代码..." },
      { key: "goal", label: "优化目标", type: "select",
        options: ["性能优化", "代码重构", "增加注释", "修复Bug", "代码审查", "最佳实践"],
        defaultValue: "性能优化" },
    ],
    build: (v) => `你是一位资深的${v.language || "编程"}架构师，擅长代码优化和最佳实践。

请优化以下代码，优化目标：${v.goal || "综合优化"}

## 待优化代码：
\`\`\`
${v.code || "// 请输入代码"}
\`\`\`

## 要求：

1. **分析问题**：先指出原代码存在的问题
2. **优化方案**：给出优化后的完整代码
3. **优化说明**：逐条解释做了哪些优化，为什么这么做的好处
4. **性能对比**：如果涉及性能优化时说明提升幅度
5. **最佳实践**：给出相关的最佳实践建议

请用中文回答，代码用代码块包裹。`,
    tips: [
      "优化后的代码可以直接复制使用",
      "如果代码太长可以分多次优化",
    ],
  },
  {
    id: "code-explain",
    name: "代码解释器",
    icon: "📖",
    category: "写代码",
    description: "逐行解释代码逻辑，快速理解复杂代码",
    variables: [
      { key: "language", label: "编程语言", type: "select", options: ["JavaScript/TypeScript", "Python", "Java", "Go", "Rust", "其他"] },
      { key: "code", label: "要解释的代码", type: "textarea", placeholder: "粘贴你看不懂的代码..." },
    ],
    build: (v) => `你是一位耐心的编程导师，请帮我解释下面这段${v.language || ""}代码。

## 代码：
\`\`\`
${v.code || "// 请输入代码"}
\`\`\`

## 请按以下结构解释：

1. **整体功能**：一句话概括这段代码是干什么的
2. **核心逻辑**：解释主要的实现思路和算法
3. **逐行解析**：对关键代码逐行解释
4. **设计亮点**：这段代码有什么值得学习的地方
5. **潜在问题**：有没有可以改进的地方

请用通俗易懂的中文解释，不要太学术化。`,
    tips: [
      "适合学习开源项目源码阅读",
      "面试前看源码必备神器",
    ],
  },
  {
    id: "code-test",
    name: "单元测试生成",
    icon: "🧪",
    category: "写代码",
    description: "自动生成单元测试用例，覆盖各种边界情况",
    variables: [
      { key: "language", label: "编程语言", type: "select", options: ["JavaScript/TypeScript", "Python", "Java", "Go", "Rust", "其他"] },
      { key: "framework", label: "测试框架", type: "select", options: ["Jest/Vitest", "Pytest", "JUnit", "Go test", "其他"] },
      { key: "code", label: "要测试的代码/函数", type: "textarea", placeholder: "粘贴你的函数或类..." },
    ],
    build: (v) => `你是一位测试专家，请为以下${v.language || ""}代码生成完整的单元测试，使用 ${v.framework || ""} 测试框架。

## 待测试代码：
\`\`\`
${v.code || "// 请输入代码"}
\`\`\`

## 要求：

1. **测试覆盖**：正常情况、边界情况、异常情况都要覆盖
2. **测试用例命名清晰**：每个测试用例名都说明测什么
3. **注释说明**：关键测试用例加注释说明测试目的
4. **最佳实践**：遵循测试代码结构清晰，易于维护

请输出完整的测试代码文件。`,
    tips: [
      "生成后可以直接运行",
      "可以补充你项目中使用",
    ],
  },
  // AI 相关
  {
    id: "prompt-optimize",
    name: "Prompt 优化器",
    icon: "✨",
    category: "AI 写作",
    description: "把你的一句话需求变成高质量 Prompt",
    variables: [
      { key: "rawPrompt", label: "你的原始需求", type: "textarea", placeholder: "比如：帮我写一篇关于AI的文章" },
      { key: "role", label: "想让 AI 扮演什么角色", type: "select",
        options: ["资深专家", "创意作家", "编程导师", "产品经理", "设计师", "普通助手"],
        defaultValue: "资深专家" },
      { key: "outputFormat", label: "期望输出格式", type: "select",
        options: ["详细步骤", "表格形式", "代码", "Markdown 文章", "列表形式", "对话形式"],
        defaultValue: "详细步骤" },
    ],
    build: (v) => `你是一位 Prompt Engineering 专家，请帮我把一个简单的需求优化成一个高质量的 Prompt。

## 我的原始需求：
${v.rawPrompt || "请输入你的需求"}

## 优化要求：

1. 让 AI 扮演 ${v.role || "资深专家"} 的角色
2. 输出格式要求：${v.outputFormat || "详细步骤"}
3. 输出要结构化、清晰
4. 加入适当的约束条件，确保输出质量
5. 加入示例，让 AI 更清楚期望

## 请输出优化后的完整 Prompt：

请用 Markdown 格式输出，包含：
- 角色设定
- 任务描述
- 输出要求
- 约束条件
- 输出格式

同时说明：为什么这么优化，优化了哪些点`,
    tips: [
      "好的 Prompt 是用好 AI 的第一步",
      "优化后的 Prompt 效果提升 3-5 倍",
    ],
  },
  {
    id: "article-writer",
    name: "技术文章写作",
    icon: "✍️",
    category: "AI 写作",
    description: "生成高质量技术文章，结构清晰有深度",
    variables: [
      { key: "topic", label: "文章主题", type: "text", placeholder: "比如：React 性能优化实战" },
      { key: "audience", label: "目标读者", type: "select",
        options: ["入门新手", "初中级开发者", "高级开发者", "技术管理者", "通用读者"],
        defaultValue: "初中级开发者" },
      { key: "style", label: "文章风格", type: "select",
        options: ["教程指南型", "实战教程", "深度解析", "对比评测", "入门科普"],
        defaultValue: "实战教程" },
      { key: "length", label: "文章长度", type: "select",
        options: ["短文（800-1500字）", "中等（1500-3000字）", "长文（3000-5000字）", "深度（5000字以上）"],
        defaultValue: "中等（1500-3000字）" },
    ],
    build: (v) => `你是一位资深技术作家，擅长写高质量的技术文章。

请写一篇关于「${v.topic || "请输入主题"}」的${v.style || "技术文章"}。

## 要求：

1. **目标读者**：${v.audience || "初中级开发者"}
2. **文章风格**：${v.style || "实战教程"}
3. **文章长度**：${v.length || "中等"}
4. **结构清晰**：有引言、正文、总结
5. **有深度**：不要泛泛而谈，要有实际价值
6. **代码示例**：涉及代码的地方要有完整可运行的代码示例
7. **图文并茂**：用图表/表格辅助
8. **结尾互动**：最后加一个引导讨论的问题

## 文章结构：
- 开头钩子（痛点引入问题/故事引入
- 正文分 3-5 个小节，每个小节有小标题
- 总结 + 延伸阅读建议
- 结尾互动问题

请用 Markdown 格式输出。`,
    tips: [
      "生成后可以直接发布",
      "可以根据需要调整长度",
    ],
  },
  // 工作效率
  {
    id: "meeting-summary",
    name: "会议纪要生成",
    icon: "📝",
    category: "工作效率",
    description: "把会议录音/聊天记录整理成结构化会议纪要",
    variables: [
      { key: "content", label: "会议内容/聊天记录", type: "textarea", placeholder: "粘贴会议录音转写或聊天记录..." },
      { key: "type", label: "会议类型", type: "select",
        options: ["项目周会", "技术评审", "产品需求评审", "头脑风暴", "一对一", "其他"],
        defaultValue: "项目周会" },
    ],
    build: (v) => `你是一位专业的会议记录者，请把以下${v.type || "会议"}内容整理成结构化的会议纪要。

## 会议内容：
${v.content || "请输入会议内容"}

## 请按以下结构整理：

1. **会议基本信息**
   - 会议主题
   - 参会人（如果有提到的话）
   - 会议时间

2. **核心议题**（3-5条最重要的讨论点）

3. **决议事项**（明确的结论和决定）

4. **Action Items（待办事项）
   - 任务描述
   - 负责人（如果提到的话）
   - 时间节点

5. **风险与问题**（会上提出的风险、待跟进的问题

6. **下次会议安排**（如果有的话）

请用中文，结构清晰，重点突出。`,
    tips: [
      "录音转文字后直接用",
      "节省 10 分钟的会 1 分钟搞定",
    ],
  },
  {
    id: "email-writer",
    name: "职场邮件写作",
    icon: "📧",
    category: "工作效率",
    description: "专业商务邮件一键生成",
    variables: [
      { key: "purpose", label: "邮件目的", type: "text", placeholder: "比如：申请加薪、请假、催进度..." },
      { key: "recipient", label: "收件人身份", type: "select",
        options: ["上级领导", "同事平级", "客户", "合作伙伴", "下属"],
        defaultValue: "上级领导" },
      { key: "tone", label: "语气风格", type: "select",
        options: ["正式专业", "友好亲切", "简洁直接", "委婉客气"],
        defaultValue: "正式专业" },
    ],
    build: (v) => `你是一位资深职场沟通专家，请帮我写一封专业的邮件。

## 邮件目的：
${v.purpose || "请输入邮件目的"}

## 收件人：${v.recipient || "上级领导"}
## 语气：${v.tone || "正式专业"}

## 要求：

1. **主题明确**：邮件主题清晰明了，让人一眼知道内容
2. **结构清晰**：
   - 称呼
   - 开头（问候+目的）
   - 正文（分点说明）
   - 结尾（行动号召/感谢）
   - 署名
3. **礼貌得体**：语气恰当，符合职场礼仪
4. **简洁有力**：不要啰嗦，重点突出
5. **可修改**：留出需要补充具体信息的地方用 [ ] 标注

请提供 2 个版本供选择：
- 版本1：简洁版（简短直接
- 版本2：完整版（更详细礼貌）`,
    tips: [
      "再也不用纠结怎么写邮件",
      "两个版本选最合适的",
    ],
  },
  // 产品/运营
  {
    id: "prd-writer",
    name: "PRD 需求文档",
    icon: "📋",
    category: "产品运营",
    description: "快速生成产品需求文档框架",
    variables: [
      { key: "feature", label: "功能/产品名称", type: "text", placeholder: "比如：AI 助手功能" },
      { key: "background", label: "需求背景", type: "textarea", placeholder: "为什么要做这个功能..." },
      { key: "users", label: "目标用户", type: "text", placeholder: "比如：C 端用户/运营人员" },
    ],
    build: (v) => `你是一位资深产品经理，请帮我生成一份「${v.feature || "产品"}」的 PRD 需求文档框架。

## 需求背景：
${v.background || "请输入需求背景"}

## 目标用户：${v.users || "请输入目标用户"}
## 请输出完整的 PRD 结构，包含：

1. **项目背景**
   - 项目背景与目标
   - 需求来源
   - 预期收益

2. **用户画像**
   - 目标用户
   - 用户痛点
   - 使用场景

3. **功能需求**
   - 功能列表（优先级标注）
   - 核心流程
   - 详细需求描述
   - 异常流程

4. **非功能需求**
   - 性能要求
   - 安全要求
   - 兼容性

5. **数据埋点**

6. **上线计划**
   - 排期预估
   - 灰度方案

请用专业的 PRD 格式输出，内容要具体可落地。`,
    tips: [
      "产品经理提效神器",
      "填完细节就能用",
    ],
  },
  {
    id: "slogan-generator",
    name: "Slogan 生成器",
    icon: "🎯",
    category: "产品运营",
    description: "一键生成品牌 slogan/宣传文案",
    variables: [
      { key: "brand", label: "品牌/产品名", type: "text", placeholder: "比如：Gitd 社区" },
      { key: "feature", label: "核心特点/卖点", type: "text", placeholder: "比如：AI 驱动的开发者社区" },
      { key: "style", label: "风格偏好", type: "select",
        options: ["简洁有力", "文艺走心", "科技感", "年轻化", "高端大气"],
        defaultValue: "科技感" },
    ],
    build: (v) => `你是一位资深品牌策划专家，请为「${v.brand || "品牌"}」生成 slogan 和宣传文案。

## 品牌/产品特点：${v.feature || "请输入特点"}
## 风格要求：${v.style || "科技感"}

## 请生成：

### 一、Slogan（10个候选，不同风格：
1. 简洁版（4-8字）
2. 完整版（10-15字）
3. 情感共鸣型
4. 功能利益型
5. 场景型

### 二、品牌故事（100字左右品牌介绍文案

### 三、各平台宣传文案：
- 朋友圈文案（100字以内）
- 官网首页文案
- 社交媒体简介

请用中文，创意新颖，有记忆点。`,
    tips: [
      "选一个好记的 slogan 顶100万广告费",
      "多试几次找感觉",
    ],
  },
  // 学习相关
  {
    id: "study-plan",
    name: "学习计划生成",
    icon: "📚",
    category: "学习成长",
    description: "根据目标定制学习路线图",
    variables: [
      { key: "topic", label: "想学的技术/知识", type: "text", placeholder: "比如：AI Agent 开发" },
      { key: "level", label: "当前水平", type: "select",
        options: ["零基础", "入门", "初中级", "高级进阶"],
        defaultValue: "入门" },
      { key: "time", label: "可投入时间", type: "select",
        options: ["每天30分钟", "每天1小时", "每天2小时", "周末集中学习"],
        defaultValue: "每天1小时" },
      { key: "goal", label: "学习目标", type: "text", placeholder: "比如：3个月能独立开发" },
    ],
    build: (v) => `你是一位资深技术导师，请为我定制一份「${v.topic || "技术"}」的学习计划。

## 我的情况：
- 当前水平：${v.level || "入门"}
- 可投入时间：${v.time || "每天1小时"}
- 学习目标：${v.goal || "掌握这门技术"}

## 请生成：

### 一、学习路线图（分阶段）
1. 入门阶段（X周）
2. 进阶阶段（X周）
3. 实战阶段（X周）
4. 高级阶段（X周）

### 二、每周学习资源推荐
- 必读书籍
- 在线课程
- 实战项目
- 社区/博客关注

### 三、每个阶段的学习重点和检验标准（怎么检验学会了）

### 四、常见坑和避坑建议

请具体可落地，不要太笼统。`,
    tips: [
      "有计划学习效率高3倍",
      "可以根据进度调整",
    ],
  },
  {
    id: "interview-prep",
    name: "面试题生成器",
    icon: "🎤",
    category: "学习成长",
    description: "生成面试题和参考答案",
    variables: [
      { key: "position", label: "面试岗位", type: "text", placeholder: "比如：前端开发" },
      { key: "level", label: "岗位级别", type: "select",
        options: ["校招/初级", "中级", "高级/资深", "技术专家/架构师"],
        defaultValue: "中级" },
      { key: "count", label: "题目数量", type: "select",
        options: ["10道", "20道", "30道", "50道"],
        defaultValue: "20道" },
    ],
    build: (v) => `你是一位资深面试官，请出一套 ${v.position || "技术"} ${v.level || "中级"} 面试题，共 ${v.count || "20道"}。

## 题目分布：
- 基础知识：40%
- 项目实战：30%
- 算法/架构：20%
- 软素质：10%

## 要求：

1. **题目分类清晰**：按知识点分类
2. **由浅入深**：从基础到高级
3. **参考答案**：每道题都要有参考答案和考察点
4. **追问方向**：标注面试官可能的追问方向
5. **答题技巧**：每类题型给出答题技巧

请用 Markdown 格式输出。`,
    tips: [
      "面试前刷一遍稳了",
      "可以生成多套题模拟面试",
    ],
  },
];

// 分类列表
const CATEGORIES = [
  { id: "all", name: "全部", icon: "🔥" },
  { id: "写代码", name: "写代码", icon: "💻" },
  { id: "AI 写作", name: "AI 写作", icon: "✨" },
  { id: "工作效率", name: "工作效率", icon: "⚡" },
  { id: "产品运营", name: "产品运营", icon: "📊" },
  { id: "学习成长", name: "学习成长", icon: "📚" },
];

export default function PromptGeneratorPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const filteredTemplates = activeCategory === "all"
    ? PROMPT_TEMPLATES
    : PROMPT_TEMPLATES.filter((t) => t.category === activeCategory);

  function handleSelectTemplate(template: PromptTemplate) {
    setSelectedTemplate(template);
    const initialVars: Record<string, string> = {};
    template.variables.forEach((v) => {
      initialVars[v.key] = v.defaultValue || "";
    });
    setVariables(initialVars);
    setGeneratedPrompt("");
  }

  function handleGenerate() {
    if (!selectedTemplate) return;
    const prompt = selectedTemplate.build(variables);
    setGeneratedPrompt(prompt);
  }

  function handleCopy() {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBack() {
    setSelectedTemplate(null);
    setGeneratedPrompt("");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Container className="py-8 max-w-5xl">
        {/* 返回 */}
        <div className="mb-6">
          <Link
            href="/tools"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← 返回工具列表
          </Link>
        </div>

        {/* 头部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            ✨ AI Prompt 生成器
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            精选 {PROMPT_TEMPLATES.length} 个高质量 Prompt 模板，一键生成专业 Prompt，让 AI 效率翻倍
          </p>
        </div>

        {!selectedTemplate ? (
          <>
            {/* 分类标签 */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-1">{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* 模板网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="bg-white rounded-xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-lg cursor-pointer transition-all group"
                >
                  <div className="text-3xl mb-3">{template.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {template.category}
                    </span>
                    <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      立即使用 →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：配置区 */}
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <button
                onClick={handleBack}
                className="text-sm text-gray-500 hover:text-blue-600 mb-4"
              >
                ← 返回模板列表
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="text-4xl">{selectedTemplate.icon}</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedTemplate.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedTemplate.description}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {selectedTemplate.variables.map((v) => (
                  <div key={v.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {v.label}
                    </label>
                    {v.type === "textarea" ? (
                      <textarea
                        value={variables[v.key] || ""}
                        onChange={(e) =>
                          setVariables({ ...variables, [v.key]: e.target.value })
                        }
                        placeholder={v.placeholder}
                        rows={5}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
                      />
                    ) : v.type === "select" ? (
                      <select
                        value={variables[v.key] || ""}
                        onChange={(e) =>
                          setVariables({ ...variables, [v.key]: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
                      >
                        {v.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={variables[v.key] || ""}
                        onChange={(e) =>
                          setVariables({ ...variables, [v.key]: e.target.value })
                        }
                        placeholder={v.placeholder}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleGenerate}
                className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
              >
                ✨ 生成 Prompt
              </button>

              {selectedTemplate.tips && selectedTemplate.tips.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                  <div className="text-xs font-medium text-amber-800 mb-1">💡 使用技巧</div>
                  {selectedTemplate.tips.map((tip, i) => (
                    <div key={i} className="text-xs text-amber-700">
                      {i + 1}. {tip}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 右侧：结果区 */}
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">生成结果</h3>
                {generatedPrompt && (
                  <button
                    onClick={handleCopy}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      copied
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                    }`}
                  >
                    {copied ? "✓ 已复制" : "📋 复制 Prompt"}
                  </button>
                )}
              </div>

              {!generatedPrompt ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-5xl mb-4">🎯</div>
                  <p className="text-gray-500 text-sm">
                    填写左侧信息后点击生成
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    生成的 Prompt 可以直接复制到 AI 对话框使用
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {generatedPrompt}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 底部说明 */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-xl p-6 border border-gray-100 max-w-2xl mx-auto">
            <h3 className="font-semibold text-gray-900 mb-2">为什么好的 Prompt 有多重要？</h3>
            <p className="text-sm text-gray-500">
              同样的 AI，用不同的 Prompt，输出质量可能差 5-10 倍。
              好的 Prompt 能让 AI 更懂你的需求，输出更精准、更专业、更有用的结果。
            </p>
            <div className="flex justify-center gap-6 mt-4 text-xs text-gray-400">
              <span>🎯 角色设定清晰</span>
              <span>📋 任务明确</span>
              <span>📐 格式规范</span>
              <span>⚡ 效率翻倍</span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
