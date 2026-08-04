/**
 * 格式化相对时间
 * 将日期转换为"刚刚"、"几分钟前"、"几小时前"等友好的中文时间格式
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diff = now.getTime() - past.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  if (months < 12) return `${months} 个月前`;
  return `${years} 年前`;
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 合并 className
 * 过滤掉 falsy 值并用空格连接
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * 截断文本
 * 超过指定长度时截断并添加省略号
 */
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * 生成 URL 友好的 slug
 * 将中文/特殊字符转换为小写字母、数字和连字符
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, '-')       // 空格替换为连字符
    .replace(/[^\w\u4e00-\u9fff-]/g, '') // 保留字母、数字、中文和连字符
    .replace(/-+/g, '-')                  // 多个连字符合并为一个
    .replace(/^-|-$/g, '');              // 去掉首尾连字符
}

/**
 * slug → 中文名映射表
 * 当数据库中分类 name 字段存的是拼音/slug 时，用作兜底显示
 */
const CATEGORY_SLUG_TO_CN: Record<string, string> = {
  announcement: '公告',
  feedback: '反馈建议',
  tutorial: '使用教程',
  chat: '闲聊',
  'open-source': '开源项目',
  opensource: '开源项目',
  kaiyuan: '开源项目',
  discussion: '讨论',
  question: '问答',
  share: '分享',
  project: '项目',
  devops: 'DevOps',
  frontend: '前端',
  backend: '后端',
  mobile: '移动开发',
  ai: 'AI',
  ml: '机器学习',
  career: '职场',
  hiring: '招聘',
  news: '资讯',
};

/**
 * 获取分类显示名称
 * 优先使用 slug 的标准显示名，避免旧数据里的同义分类名称重复展示
 */
export function getCategoryDisplayName(name: string | null | undefined, slug: string | null | undefined): string {
  // 尝试 slug 映射
  if (slug) {
    const mapped = CATEGORY_SLUG_TO_CN[slug.toLowerCase()];
    if (mapped) return mapped;
  }
  // 有中文名直接用
  if (name && /[\u4e00-\u9fff]/.test(name)) return name;
  // name 存在就用 name（可能是英文分类名）
  if (name) return name;
  return '其他';
}

/**
 * 去除 Markdown 语法符号，提取纯文本
 * 用于帖子列表摘要展示
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    // 去除代码块 ```...```
    .replace(/```[\s\S]*?```/g, '')
    // 去除行内代码 `...`
    .replace(/`[^`]+`/g, '')
    // 去除图片 ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 去除链接 [text](url)，保留 text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 去除标题标记 #
    .replace(/^#{1,6}\s+/gm, '')
    // 去除粗体 **text** 或 __text__
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // 去除斜体 *text* 或 _text_
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 去除删除线 ~~text~~
    .replace(/~~([^~]+)~~/g, '$1')
    // 去除引用 >
    .replace(/^>\s+/gm, '')
    // 去除列表标记 - * + 1.
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // 去除水平线
    .replace(/^---+$/gm, '')
    // 压缩多余空行和空格
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}
