import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { stripMarkdown, truncateText } from '@/lib/utils';

type PostSeo = {
  id: string;
  title: string;
  content: string;
  postType: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
  categoryName?: string | null;
  categorySlug?: string | null;
  tags: string[];
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';

async function getPostSeo(id: string): Promise<PostSeo | null> {
  try {
    const post = await prisma.post.findFirst({
      where: { id, status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        postType: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        updatedAt: true,
        authorName: true,
        author: { select: { username: true } },
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });

    if (!post) return null;

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      postType: post.postType,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      authorName: post.authorName || post.author.username,
      categoryName: post.category?.name,
      categorySlug: post.category?.slug,
      tags: post.tags.map((item) => item.tag.name).filter(Boolean),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const post = await getPostSeo(params.id);

  if (!post) {
    return {
      title: '帖子不存在',
      description: '该帖子可能已删除、未发布或链接错误。',
      robots: { index: false, follow: false },
    };
  }

  const plainText = stripMarkdown(post.content);
  const description = truncateText(plainText || post.title, 150);
  const url = `${baseUrl}/forum/post/${post.id}`;
  const typeText = post.postType === 'question' ? '技术问答' : '技术讨论';

  return {
    title: `${post.title} - ${typeText}`,
    description,
    keywords: [
      post.title,
      typeText,
      '开发者社区',
      '技术交流',
      ...(post.categoryName ? [post.categoryName] : []),
      ...post.tags,
    ],
    alternates: { canonical: `/forum/post/${post.id}` },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      locale: 'zh_CN',
      url,
      publishedTime: post.createdAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.authorName],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
    },
  };
}

export default async function PostSeoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const post = await getPostSeo(params.id);

  if (!post) return children;

  const plainText = stripMarkdown(post.content);
  const description = truncateText(plainText || post.title, 150);
  const url = `${baseUrl}/forum/post/${post.id}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': post.postType === 'question' ? 'QAPage' : 'DiscussionForumPosting',
    headline: post.title,
    name: post.title,
    description,
    url,
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: post.authorName,
    },
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: post.viewCount,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: post.likeCount,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: post.commentCount,
      },
    ],
    articleSection: post.categoryName,
    keywords: post.tags.join(','),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {children}
    </>
  );
}
