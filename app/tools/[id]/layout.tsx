import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { truncateText } from '@/lib/utils';

type ToolSeo = {
  id: string;
  name: string;
  description?: string | null;
  url: string;
  category?: string | null;
  icon?: string | null;
  coverImage?: string | null;
  toolType: string;
  clickCount: number;
  updatedAt: Date;
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';

async function getToolSeo(id: string): Promise<ToolSeo | null> {
  try {
    const tool = await prisma.tool.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        url: true,
        category: true,
        icon: true,
        coverImage: true,
        toolType: true,
        clickCount: true,
        updatedAt: true,
      },
    });

    return tool;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const tool = await getToolSeo(params.id);

  if (!tool) {
    return {
      title: '工具不存在',
      description: '该工具可能已下线、删除或链接错误。',
      robots: { index: false, follow: false },
    };
  }

  const description = truncateText(
    tool.description || `${tool.name} 是一个实用开发者工具，可在线使用或快速访问。`,
    150,
  );
  const image = tool.coverImage || tool.icon || undefined;

  return {
    title: `${tool.name} - 在线开发者工具`,
    description,
    keywords: [
      tool.name,
      '在线工具',
      '开发者工具',
      '实用工具',
      ...(tool.category ? [tool.category] : []),
    ],
    alternates: { canonical: `/tools/${tool.id}` },
    openGraph: {
      title: `${tool.name} - 在线开发者工具`,
      description,
      type: 'website',
      locale: 'zh_CN',
      url: `${baseUrl}/tools/${tool.id}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tool.name} - 在线开发者工具`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ToolSeoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const tool = await getToolSeo(params.id);

  if (!tool) return children;

  const description = truncateText(
    tool.description || `${tool.name} 是一个实用开发者工具，可在线使用或快速访问。`,
    150,
  );

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    description,
    applicationCategory: tool.category || 'DeveloperApplication',
    operatingSystem: 'Web',
    url: `${baseUrl}/tools/${tool.id}`,
    sameAs: tool.url,
    dateModified: tool.updatedAt.toISOString(),
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/UseAction',
      userInteractionCount: tool.clickCount,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
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
