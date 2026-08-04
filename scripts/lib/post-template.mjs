/**
 * AI 发帖内容模板工具
 * 用于统一自动发帖的专业结构、互动引导和 AI 辅助说明。
 */

export function normalizeTags(tags, fallback = []) {
  const source = Array.isArray(tags) ? tags : fallback;
  return [...new Set(
    source
      .map((tag) => String(tag || '').trim())
      .filter((tag) => tag.length > 0 && tag.length <= 20),
  )].slice(0, 5);
}

export function normalizeTitle(title, fallbackTitle) {
  const cleanTitle = String(title || fallbackTitle || '技术分享')
    .replace(/^#+\s*/, '')
    .replace(/[《》]/g, '')
    .trim();

  if (cleanTitle.length <= 80) return cleanTitle;
  return `${cleanTitle.slice(0, 77)}...`;
}

export function appendProfessionalFooter(content, options = {}) {
  const {
    discussionQuestion = '你在实际项目中遇到过类似问题吗？欢迎在评论区补充你的经验、方案或踩坑记录。',
    includeAiNote = true,
  } = options;

  let result = String(content || '').trim();

  if (!/##\s*(讨论|延伸讨论|欢迎讨论|互动)/.test(result)) {
    result += `\n\n## 讨论\n\n${discussionQuestion}`;
  }

  if (includeAiNote && !/AI\s*辅助|AI 辅助|人工校对/.test(result)) {
    result += '\n\n---\n\n> 本文由 Gitd 社区 AI 辅助整理，内容已按技术社区阅读场景优化。若有错误或更好的实践，欢迎评论区指出。';
  }

  return result;
}

export function buildProfessionalPromptRules({ mode = 'forum' } = {}) {
  const commonRules = `
## 专业度要求

1. 标题要像技术社区优质帖：明确技术对象、问题或收益，不要标题党。
2. 开头必须先给「核心结论」或「本文要解决的问题」，避免铺垫太长。
3. 正文必须有清晰层级，优先使用二级标题和短段落。
4. 每个主要观点都要落到具体场景、代码、配置、实践步骤或判断标准。
5. 不要写空泛套话，例如“非常重要”“大大提升效率”，必须说明为什么。
6. 结尾必须有「总结」和「讨论」两个部分，引导用户评论补充。
7. 技术内容要谨慎，不能编造不存在的 API、命令、版本特性。
8. 标签要短、准确，优先使用技术名词或场景词。
`;

  if (mode === 'deep') {
    return `${commonRules}
## 推荐文章结构

> 核心结论：用 2-3 句话说明这篇文章的价值。

## 适合读者

列出 2-4 类适合阅读的人群。

## 背景与问题

说明真实业务或开发场景。

## 方案拆解

分步骤讲清楚原理、取舍和实现方式。

## 代码示例

给出可以复制的代码或配置，并解释关键点。

## 常见坑点

列出 3-5 个容易踩坑的地方和规避方式。

## 总结

沉淀可复用的方法论。

## 讨论

提出一个具体问题，邀请社区补充经验。`;
  }

  return `${commonRules}
## 推荐帖子结构

> 核心结论：用 1-2 句话先说明这篇帖子能解决什么问题。

## 背景

说明为什么这个主题值得关注。

## 实践步骤 / 项目亮点

教程类写步骤，开源推荐类写亮点和适用场景。

## 示例

给出代码、配置、命令或具体用法。

## 避坑建议

列出 2-4 个实际开发中容易忽略的问题。

## 总结

给出简短结论。

## 讨论

抛出一个具体问题，引导评论。`;
}

/**
 * 微信公众号「开源风」发帖规则
 * 适用于 Gitd 社区 AI 机器人：用 Markdown 写作，但结构、节奏和信息密度贴近微信公众号开源模板。
 */
export function buildWechatOpenSourcePromptRules({ topicKind = 'general' } = {}) {
  const isOpenSource = topicKind === 'open-source';

  return `
## 微信公众号开源风模板要求

整体风格参考微信公众号「开源风格」：清爽、克制、有社区感，像一篇可以直接同步到公众号的开源/技术精选文章。

### 版式结构

必须严格使用下面的 Markdown 结构，不要随意换标题：

> 开源共创：用 1-2 句话说明本文最值得读的点，语气克制，不要夸张营销。

## 速览

用 3-5 条短 bullet 总结核心信息。每条控制在一行左右。

## 为什么值得关注

说明背景、痛点或趋势，短段落，不要长篇铺垫。

## 核心亮点

列出 3-5 个亮点。每个亮点要说明「解决什么问题」和「适合什么场景」。

## 适用场景

写清楚适合谁、不适合谁。避免只写优点。

## 快速上手

给出最小可用步骤。可以包含命令或代码块，但代码块只放必要内容，不要堆太长。

## 选型与避坑

给出实际选型建议、常见误区、版本/依赖/协议/性能/维护风险。

## 总结

用 2-4 句话收束，强调可执行判断。

## 讨论

提出一个具体问题，引导用户补充经验。

### 内容规则

1. 每个二级标题下优先使用短段落和短列表，避免大段文字。
2. 不使用夸张宣传词，例如“神器”“颠覆”“必用”“完美解决”。
3. 如果涉及开源项目，必须写清楚：项目定位、原作者/维护方、原仓库链接、开源协议；如果无法确定，明确写“以官方仓库信息为准”，不要编造。
4. 如果涉及技术教程，必须写清楚前提条件、适用版本、最小示例和风险点。
5. 代码块语言要标注清楚，例如 \`\`\`bash、\`\`\`ts、\`\`\`sql。
6. 正文长度控制在 1200-2200 字，移动端阅读优先。
7. 标签要短且准确，优先使用 3-5 个。
${isOpenSource ? '8. 本文必须更偏“开源项目精选/开源治理/协议合规”视角。' : '8. 本文虽然不是开源项目推荐，也要保持“开源社区文章”的清爽结构和实践导向。'}
`;
}

export function appendWechatOpenSourceFooter(content, options = {}) {
  const {
    discussionQuestion = '你用过类似项目或方案吗？欢迎补充真实体验、替代方案和适合/不适合的场景。',
    includeAiNote = true,
  } = options;

  let result = String(content || '').trim();

  if (!/##\s*讨论/.test(result)) {
    result += `\n\n## 讨论\n\n${discussionQuestion}`;
  }

  if (includeAiNote && !/Gitd 社区 AI|AI 辅助|人工校对/.test(result)) {
    result += '\n\n---\n\n> Gitd 社区 AI 辅助整理，采用开源风阅读结构。项目、协议、版本等关键信息请以官方资料为准，欢迎在评论区补充校对。';
  }

  return result;
}
