import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/** 生成授权码格式: ET-XXXXXXXX-XXXXXXXX-XXXXXXXX */
function generateLicenseKey(): string {
  const part = () => crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ET-${part()}-${part()}-${part()}`;
}

/** GET /api/admin/licenses - 获取授权码列表 */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const keyword = searchParams.get('keyword');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (keyword) {
      where.OR = [
        { licenseKey: { contains: keyword, mode: 'insensitive' } },
        { projectName: { contains: keyword, mode: 'insensitive' } },
        { remark: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const licenses = await prisma.license.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        domains: true,
        _count: { select: { logs: true } },
      },
    });

    const result = licenses.map((lic) => ({
      id: lic.id,
      licenseKey: lic.licenseKey,
      projectName: lic.projectName,
      projectType: lic.projectType,
      maxDomains: lic.maxDomains,
      boundDomains: lic.domains.length,
      expiresAt: lic.expiresAt,
      status: lic.expiresAt < new Date() && lic.status === 'active' ? 'expired' : lic.status,
      remark: lic.remark,
      domains: lic.domains.map((d) => ({
        domain: d.domain,
        activatedAt: d.activatedAt,
        lastVerifiedAt: d.lastVerifiedAt,
      })),
      logCount: lic._count.logs,
      createdAt: lic.createdAt,
      updatedAt: lic.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[LICENSES GET ERROR]', error);
    return NextResponse.json({ error: '获取授权码列表失败' }, { status: 500 });
  }
}

/** POST /api/admin/licenses - 创建授权码 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { projectName, projectType, maxDomains, validDays, remark } = body;

    if (!projectName) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }

    const type = projectType || 'standard';
    const domains = maxDomains || (type === 'enterprise' ? 10 : type === 'premium' ? 5 : type === 'standard' ? 2 : 1);
    const days = validDays || 365;

    // 生成唯一授权码
    let licenseKey = generateLicenseKey();
    let existing = await prisma.license.findUnique({ where: { licenseKey } });
    while (existing) {
      licenseKey = generateLicenseKey();
      existing = await prisma.license.findUnique({ where: { licenseKey } });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const license = await prisma.license.create({
      data: {
        licenseKey,
        projectName,
        projectType: type,
        maxDomains: domains,
        expiresAt,
        remark: remark || null,
      },
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'create_license',
        target: 'License',
        detail: `创建授权码: ${licenseKey} (${projectName})`,
      },
    });

    return NextResponse.json({
      id: license.id,
      licenseKey: license.licenseKey,
      projectName: license.projectName,
      projectType: license.projectType,
      maxDomains: license.maxDomains,
      expiresAt: license.expiresAt,
      status: license.status,
      message: '授权码创建成功',
    }, { status: 201 });
  } catch (error) {
    console.error('[LICENSES POST ERROR]', error);
    return NextResponse.json({ error: '创建授权码失败' }, { status: 500 });
  }
}

/** PATCH /api/admin/licenses - 更新授权码状态 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { id, status, remark, maxDomains, expiresAt } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少授权码 ID' }, { status: 400 });
    }

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return NextResponse.json({ error: '授权码不存在' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (remark !== undefined) updateData.remark = remark;
    if (maxDomains !== undefined) updateData.maxDomains = maxDomains;
    if (expiresAt !== undefined) updateData.expiresAt = new Date(expiresAt);

    await prisma.license.update({
      where: { id },
      data: updateData,
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'update_license',
        target: 'License',
        detail: `更新授权码: ${license.licenseKey} (${JSON.stringify(updateData)})`,
      },
    });

    return NextResponse.json({ message: '授权码已更新' });
  } catch (error) {
    console.error('[LICENSES PATCH ERROR]', error);
    return NextResponse.json({ error: '更新授权码失败' }, { status: 500 });
  }
}

/** DELETE /api/admin/licenses - 删除授权码 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少授权码 ID' }, { status: 400 });
    }

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return NextResponse.json({ error: '授权码不存在' }, { status: 404 });
    }

    await prisma.license.delete({ where: { id } });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'delete_license',
        target: 'License',
        detail: `删除授权码: ${license.licenseKey}`,
      },
    });

    return NextResponse.json({ message: '授权码已删除' });
  } catch (error) {
    console.error('[LICENSES DELETE ERROR]', error);
    return NextResponse.json({ error: '删除授权码失败' }, { status: 500 });
  }
}
