"use client";

import { useEffect } from "react";

interface PostSEOProps {
  title: string;
  description?: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  tags?: string[];
  image?: string;
  url?: string;
  siteName?: string;
}

/**
 * 帖子 SEO 组件
 * 动态设置页面 meta description 和 JSON-LD 结构化数据
 *
 * 优化点：
 * 1. 自动从内容生成摘要作为 description
 * 2. 添加 Article 类型 JSON-LD 结构化数据
 * 3. 支持 Open Graph 和 Twitter Card
 */
export default function PostSEO({
  title,
  description,
  author,
  datePublished,
  dateModified,
  tags = [],
  image,
  url,
  siteName = "Gitd 社区",
}: PostSEOProps) {
  useEffect(() => {
    if (!title) return;

    // 1. 设置页面标题
    document.title = `${title} - ${siteName}`;

    // 2. 设置 meta description
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', description);

      // Open Graph description
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', description);
    }

    // 3. Open Graph title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', title);

    // 4. Open Graph type
    let ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
      ogType = document.createElement('meta');
      ogType.setAttribute('property', 'og:type');
      document.head.appendChild(ogType);
    }
    ogType.setAttribute('content', 'article');

    // 5. URL
    if (url) {
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute('content', url);
    }

    // 6. Twitter Card
    let twitterCard = document.querySelector('meta[name="twitter:card"]');
    if (!twitterCard) {
      twitterCard = document.createElement('meta');
      twitterCard.setAttribute('name', 'twitter:card');
      document.head.appendChild(twitterCard);
    }
    twitterCard.setAttribute('content', 'summary_large_image');

    let twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (!twitterTitle) {
      twitterTitle = document.createElement('meta');
      twitterTitle.setAttribute('name', 'twitter:title');
      document.head.appendChild(twitterTitle);
    }
    twitterTitle.setAttribute('content', title);

    if (description) {
      let twitterDesc = document.querySelector('meta[name="twitter:description"]');
      if (!twitterDesc) {
        twitterDesc = document.createElement('meta');
        twitterDesc.setAttribute('name', 'twitter:description');
        document.head.appendChild(twitterDesc);
      }
      twitterDesc.setAttribute('content', description);
    }

    // 7. JSON-LD 结构化数据（Article 类型）
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": description || "",
      "author": author ? {
        "@type": "Person",
        "name": author,
      } : undefined,
      "datePublished": datePublished || undefined,
      "dateModified": dateModified || datePublished || undefined,
      "keywords": tags.length > 0 ? tags.join(", ") : undefined,
      "image": image || undefined,
      "publisher": {
        "@type": "Organization",
        "name": siteName,
      },
    };

    // 移除旧的 JSON-LD
    const oldJsonLd = document.getElementById('post-jsonld');
    if (oldJsonLd) {
      oldJsonLd.remove();
    }

    // 添加新的 JSON-LD
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'post-jsonld';
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      // 清理：移除我们动态添加的 JSON-LD
      const jsonLdEl = document.getElementById('post-jsonld');
      if (jsonLdEl) {
        jsonLdEl.remove();
      }
    };
  }, [title, description, author, datePublished, dateModified, tags, image, url, siteName]);

  return null;
}

/**
 * 从 Markdown 内容提取摘要
 * 规则：取第一段非空、非标题、非代码块的文字，截取 120-160 字
 */
export function extractSummary(content: string, maxLength = 150): string {
  if (!content) return "";

  const lines = content.split("\n");
  let inCodeBlock = false;
  let firstParagraph = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过代码块
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // 跳过标题
    if (/^#{1,6}\s+/.test(trimmed)) continue;
    // 跳过引用
    if (/^>\s*/.test(trimmed)) continue;
    // 跳过列表
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) continue;
    // 跳过空行
    if (!trimmed) continue;
    // 跳过图片
    if (/^!\[.*\]/.test(trimmed)) continue;
    // 跳过分隔线
    if (/^---+$/.test(trimmed)) continue;
    // 跳过表格
    if (/^\|.*\|$/.test(trimmed)) continue;

    // 找到第一段正文
    firstParagraph = trimmed;
    break;
  }

  // 如果第一段太短，继续拼接后续段落
  if (firstParagraph.length < 50) {
    let secondParagraph = "";
    let foundFirst = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      if (/^#{1,6}\s+/.test(trimmed)) continue;
      if (/^>\s*/.test(trimmed)) continue;
      if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) continue;
      if (!trimmed) continue;
      if (/^!\[.*\]/.test(trimmed)) continue;
      if (/^---+$/.test(trimmed)) continue;
      if (/^\|.*\|$/.test(trimmed)) continue;

      if (!foundFirst) {
        if (trimmed === firstParagraph) {
          foundFirst = true;
        }
        continue;
      }
      secondParagraph = trimmed;
      break;
    }
    if (secondParagraph) {
      firstParagraph = firstParagraph + "，" + secondParagraph;
    }
  }

  // 去掉 Markdown 格式符号
  const clean = firstParagraph
    .replace(/[#*`_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();

  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1) + "…";
}
