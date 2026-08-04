import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { stripMarkdown, truncateText } from '@/lib/utils';

type ProductSeo = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  coverImage?: string | null;
  icon?: string | null;
  demoUrl?: string | null;
  docsUrl?: string | null;
  downloadUrl?: string | null;
  techStack?: string | null;
  features: string[];
  updatedAt: Date;
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';

function parseStringArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    return value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

async function getProductSeo(slug: string): Promise<ProductSeo | null> {
  try {
    const product = await prisma.product.findFirst({
      where: { slug, status: 'active' },
      select: {
        name: true,
        slug: true,
        tagline: true,
        description: true,
        coverImage: true,
        icon: true,
        demoUrl: true,
        docsUrl: true,
        downloadUrl: true,
        techStack: true,
        features: true,
        updatedAt: true,
      },
    });

    if (!product) return null;

    return {
      ...product,
      features: parseStringArray(product.features),
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
  const product = await getProductSeo(params.slug);

  if (!product) {
    return {
      title: '项目不存在',
      description: '该项目可能已下架、删除或链接错误。',
      robots: { index: false, follow: false },
    };
  }

  const description = truncateText(
    product.tagline || stripMarkdown(product.description) || `${product.name} 项目介绍与下载。`,
    150,
  );
  const image = product.coverImage || product.icon || undefined;

  return {
    title: `${product.name} - 开源项目与授权下载`,
    description,
    keywords: [
      product.name,
      '开源项目',
      '项目授权',
      '软件下载',
      '开发者工具',
      ...product.features.slice(0, 6),
      ...parseStringArray(product.techStack).slice(0, 6),
    ],
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} - 开源项目与授权下载`,
      description,
      type: 'website',
      locale: 'zh_CN',
      url: `${baseUrl}/products/${product.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} - 开源项目与授权下载`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductSeoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const product = await getProductSeo(params.slug);

  if (!product) return children;

  const description = truncateText(
    product.tagline || stripMarkdown(product.description) || `${product.name} 项目介绍与下载。`,
    150,
  );
  const techStack = parseStringArray(product.techStack);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: product.name,
    description,
    url: `${baseUrl}/products/${product.slug}`,
    codeRepository: product.demoUrl || undefined,
    programmingLanguage: techStack,
    dateModified: product.updatedAt.toISOString(),
    isAccessibleForFree: true,
    keywords: [...product.features, ...techStack].join(','),
    potentialAction: [
      product.downloadUrl
        ? {
            '@type': 'DownloadAction',
            target: product.downloadUrl,
          }
        : undefined,
      product.docsUrl
        ? {
            '@type': 'ReadAction',
            target: product.docsUrl,
          }
        : undefined,
    ].filter(Boolean),
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
