import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/**
 * 标准化域名：去除首尾空白、转小写、去掉协议(http/https)、去掉路径、去掉端口
 */
function normalizeDomain(raw: string): string {
  let domain = raw.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  domain = domain.split(':')[0]; // 去掉端口
  return domain;
}

/** 域名格式校验：仅允许字母、数字、下划线、点、连字符 */
const DOMAIN_REGEX = /^[\w.-]+$/;

// ============ GET /api/user/licenses - 获取当前用户的授权码列表 ============
export async function GET(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const licenses = await prisma.license.findMany({
      where: { ownerId: userPayload.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        domains: true,
        _count: { select: { logs: true } },
        product: { select: { downloadUrl: true } },
      },
    });

    const now = new Date();
    const result = licenses.map((lic) => ({
      id: lic.id,
      licenseKey: lic.licenseKey,
      projectName: lic.projectName,
      projectType: lic.projectType,
      maxDomains: lic.maxDomains,
      boundDomains: lic.domains.length,
      expiresAt: lic.expiresAt,
      status:
        lic.expiresAt < now && lic.status === 'active' ? 'expired' : lic.status,
      remark: lic.remark,
      downloadUrl: lic.product?.downloadUrl || null,
      domains: lic.domains.map((d) => ({
        domain: d.domain,
        activatedAt: d.activatedAt,
        lastVerifiedAt: d.lastVerifiedAt,
      })),
      logCount: lic._count.logs,
      createdAt: lic.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[USER LICENSE LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取授权码列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/user/licenses - 绑定域名到授权码 ============
// body: { licenseId, domain }
export async function POST(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { licenseId, domain } = body;

    if (!licenseId || !domain) {
      return NextResponse.json(
        { error: '授权码 ID 和域名不能为空' },
        { status: 400 },
      );
    }

    // ---- 标准化并校验域名 ----
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain || !DOMAIN_REGEX.test(normalizedDomain)) {
      return NextResponse.json({ error: '域名格式无效' }, { status: 400 });
    }

    // ---- 校验授权码归属当前用户 ----
    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: { domains: true },
    });

    if (!license) {
      return NextResponse.json({ error: '授权码不存在' }, { status: 404 });
    }

    if (license.ownerId !== userPayload.userId) {
      return NextResponse.json(
        { error: '无权操作该授权码' },
        { status: 403 },
      );
    }

    // ---- 检查域名是否已绑定到其他授权码（唯一约束） ----
    const existingDomain = await prisma.licenseDomain.findUnique({
      where: { domain: normalizedDomain },
      include: { license: true },
    });

    if (existingDomain && existingDomain.licenseId !== licenseId) {
      return NextResponse.json(
        {
          error: `域名 ${normalizedDomain} 已绑定到其他授权码: ${existingDomain.license.licenseKey}`,
        },
        { status: 409 },
      );
    }

    if (existingDomain && existingDomain.licenseId === licenseId) {
      return NextResponse.json(
        { error: '该域名已绑定到此授权码' },
        { status: 409 },
      );
    }

    // ---- 检查是否超过最大绑定数 ----
    if (license.domains.length >= license.maxDomains) {
      return NextResponse.json(
        {
          error: `已达到最大绑定域名数（${license.maxDomains}），请先解绑其他域名或升级套餐`,
        },
        { status: 400 },
      );
    }

    // ---- 创建域名绑定记录 ----
    const domainRecord = await prisma.licenseDomain.create({
      data: {
        licenseId,
        domain: normalizedDomain,
      },
    });

    return NextResponse.json(
      {
        id: domainRecord.id,
        domain: domainRecord.domain,
        activatedAt: domainRecord.activatedAt,
        message: '域名绑定成功',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[USER LICENSE BIND ERROR]', error);
    return NextResponse.json({ error: '绑定域名失败' }, { status: 500 });
  }
}

// ============ DELETE /api/user/licenses - 解绑域名 ============
// 查询参数: ?domain=xxx 或 ?licenseId=xxx&domain=xxx
export async function DELETE(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domainParam = searchParams.get('domain');
    const licenseIdParam = searchParams.get('licenseId');

    if (!domainParam) {
      return NextResponse.json(
        { error: '需要提供 domain 参数' },
        { status: 400 },
      );
    }

    // ---- 标准化域名以便匹配已存储记录 ----
    const normalizedDomain = normalizeDomain(domainParam);
    if (!normalizedDomain || !DOMAIN_REGEX.test(normalizedDomain)) {
      return NextResponse.json({ error: '域名格式无效' }, { status: 400 });
    }

    // ---- 查找域名绑定记录 ----
    const domainRecord = await prisma.licenseDomain.findUnique({
      where: { domain: normalizedDomain },
      include: { license: true },
    });

    if (!domainRecord) {
      return NextResponse.json(
        { error: '域名绑定记录不存在' },
        { status: 404 },
      );
    }

    // ---- 校验绑定记录归属当前用户 ----
    if (domainRecord.license.ownerId !== userPayload.userId) {
      return NextResponse.json(
        { error: '无权操作该授权码' },
        { status: 403 },
      );
    }

    // ---- 若提供 licenseId，需与记录中的 licenseId 一致 ----
    if (licenseIdParam && domainRecord.licenseId !== licenseIdParam) {
      return NextResponse.json(
        { error: '域名与授权码不匹配' },
        { status: 400 },
      );
    }

    await prisma.licenseDomain.delete({ where: { id: domainRecord.id } });

    return NextResponse.json({ message: '域名已解绑' });
  } catch (error) {
    console.error('[USER LICENSE UNBIND ERROR]', error);
    return NextResponse.json({ error: '解绑域名失败' }, { status: 500 });
  }
}
