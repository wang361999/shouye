import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { getCategoryDisplayName, truncateText } from '@/lib/utils';

type CategorySeo = {
  name: string;
  slug: string;
  desc?: string | null;
  postCount: number;
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';

async function getCategorySeo(slug: string): Promise<CategorySeo | null> {
  try {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        desc: true,
        _count: {
          select: {
            posts: {
              where: { status: 'PUBLISHED', deletedAt: null },
            },
          },
        },
      },
    });

    if (!category) return null;

    return {
      name: getCategoryDisplayName(category.name, category.slug),
      slug: category.slug,
      desc: category.desc,
      postCount: category._count.posts,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await getCategorySeo(params.slug);

  if (!category) {
    return {
      title: '分类不存在',
      description: '该论坛分类不存在或已被删除。',
      robots: { index: false, follow: false },
    };
  }

  const description = truncateText(
    category.desc ||
      `${category.name} 分类下的技术讨论、教程分享、问题解答和社区经验沉淀。`,
    150,
  );

  return {
    title: `${category.name} - 开发者社区分类`,
    description,
    keywords: [
      category.name,
      '开发者社区',
      '技术论坛',
      '技术讨论',
      '问题解答',
      '经验分享',
    ],
    alternates: { canonical: `/forum/category/${category.slug}` },
    openGraph: {
      title: `${category.name} - 开发者社区分类`,
      description,
      type: 'website',
      locale: 'zh_CN',
      url: `${baseUrl}/forum/category/${category.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.name} - 开发者社区分类`,
      description,
    },
  };
}

export default async function CategorySeoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const category = await getCategorySeo(params.slug);

  if (!category) return children;

  const description = truncateText(
    category.desc ||
      `${category.name} 分类下的技术讨论、教程分享、问题解答和社区经验沉淀。`,
    150,
  );

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name} - 开发者社区分类`,
    description,
    url: `${baseUrl}/forum/category/${category.slug}`,
    mainEntity: {
      '@type': 'ItemList',
      name: category.name,
      numberOfItems: category.postCount,
    },
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
