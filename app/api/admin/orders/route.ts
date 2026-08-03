import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { sendNotification } from '@/lib/notify';
import { logOperation } from '@/lib/admin-log';

/** 生成授权码格式: ET-XXXXXXXX-XXXXXXXX-XXXXXXXX */
function generateLicenseKey(): string {
  const part = () => crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ET-${part()}-${part()}-${part()}`;
}

/** GET /api/admin/orders - 获取订单列表（含用户与产品信息） */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const keyword = searchParams.get('keyword');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10));

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { productName: { contains: keyword } },
        { payTxId: { contains: keyword } },
        { user: { username: { contains: keyword } } },
        { user: { email: { contains: keyword } } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, email: true } },
          product: { select: { id: true, name: true, slug: true } },
          license: { select: { id: true, licenseKey: true } },
        },
      }),
    ]);

    const data = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      userId: o.userId,
      username: o.user?.username,
      email: o.user?.email,
      productId: o.productId,
      productName: o.productName,
      productSlug: o.product?.slug,
      projectType: o.projectType,
      maxDomains: o.maxDomains,
      amount: o.amount,
      validDays: o.validDays,
      status: o.status,
      payMethod: o.payMethod,
      payTxId: o.payTxId,
      paidAt: o.paidAt,
      licenseId: o.licenseId,
      licenseKey: o.license?.licenseKey,
      remark: o.remark,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error('[ORDERS GET ERROR]', error);
    return NextResponse.json({ error: '获取订单列表失败' }, { status: 500 });
  }
}

/** PATCH /api/admin/orders - 更新订单状态（用于手动确认收款） */
export async function PATCH(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { id, status, payMethod, payTxId, remark } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少订单 ID' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (payMethod !== undefined) updateData.payMethod = payMethod || null;
    if (payTxId !== undefined) updateData.payTxId = payTxId || null;
    if (remark !== undefined) updateData.remark = remark;

    // 若标记为已支付：仅设置支付时间，不生成授权码（需管理员审核通过后才生成）
    const isPaying = status === 'paid' && order.status !== 'paid';
    // 若标记为已审核通过：生成授权码
    const isApproving = status === 'approved' && order.status !== 'approved';
    // 若标记为取消/退款/拒绝：吊销授权码
    const isRevoking = ['cancelled', 'refunded', 'rejected'].includes(status) &&
                       !['cancelled', 'refunded', 'rejected'].includes(order.status);
    let createdLicenseKey: string | null = null;

    if (isPaying) {
      updateData.paidAt = new Date();
      // 未指定支付方式时默认记为 manual
      if (!payMethod && !order.payMethod) {
        updateData.payMethod = 'manual';
      }
      await prisma.order.update({ where: { id }, data: updateData });
    } else if (isApproving) {
      // 审核通过：生成授权码（若尚未生成）
      if (!order.licenseId) {
        // 生成唯一授权码
        let licenseKey = generateLicenseKey();
        let exists = await prisma.license.findUnique({ where: { licenseKey } });
        while (exists) {
          licenseKey = generateLicenseKey();
          exists = await prisma.license.findUnique({ where: { licenseKey } });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + order.validDays);

        // 事务：创建授权码并回写订单 licenseId
        const license = await prisma.$transaction(async (tx) => {
          const created = await tx.license.create({
            data: {
              licenseKey,
              projectName: order.productName,
              projectType: order.projectType,
              maxDomains: order.maxDomains,
              expiresAt,
              status: 'active',
              ownerId: order.userId,
              productId: order.productId,
              orderId: order.id,
            },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { ...updateData, licenseId: created.id },
          });
          return created;
        });

        createdLicenseKey = license.licenseKey;
      } else {
        // 已有授权码，仅更新订单
        await prisma.order.update({ where: { id }, data: updateData });
      }
    } else if (isRevoking && order.licenseId) {
      // 吊销授权码并解除关联
      await prisma.license.update({
        where: { id: order.licenseId },
        data: { status: 'revoked' },
      });
      updateData.licenseId = null;
      await prisma.order.update({ where: { id }, data: updateData });
    } else {
      await prisma.order.update({ where: { id }, data: updateData });
    }

    await logOperation(
      admin.userId,
      admin.username,
      'update_order',
      'Order',
      `更新订单 ${order.orderNo}: ${JSON.stringify({
        status,
        payMethod,
        payTxId,
        remark,
        ...(createdLicenseKey ? { generatedLicense: createdLicenseKey } : {}),
      })}`,
    );

    // ---- 通知用户审核结果 ----
    if (isApproving) {
      // 获取授权码（新生成的或已有的）
      let licenseKeyForNotify = createdLicenseKey;
      if (!licenseKeyForNotify && order.licenseId) {
        const existingLicense = await prisma.license.findUnique({
          where: { id: order.licenseId },
          select: { licenseKey: true },
        });
        licenseKeyForNotify = existingLicense?.licenseKey || null;
      }
      await sendNotification({
        userId: order.userId,
        type: 'authorize',
        title: '授权申请已通过',
        content: licenseKeyForNotify
          ? `您的授权申请已通过，授权码：${licenseKeyForNotify}`
          : '您的授权申请已通过，请前往授权管理查看',
        link: '/profile/licenses',
      });
    }

    if (status === 'rejected' && order.status !== 'rejected') {
      await sendNotification({
        userId: order.userId,
        type: 'authorize',
        title: '授权申请未通过',
        content: `您的授权申请（订单号：${order.orderNo}）未通过审核`,
        link: '/profile/orders',
      });
    }

    return NextResponse.json({
      message: '订单已更新',
      ...(createdLicenseKey ? { licenseKey: createdLicenseKey } : {}),
    });
  } catch (error) {
    console.error('[ORDERS PATCH ERROR]', error);
    return NextResponse.json({ error: '更新订单失败' }, { status: 500 });
  }
}

/** DELETE /api/admin/orders - 删除订单（同时吊销关联授权码） */
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少订单 ID' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 若订单关联了授权码，先吊销
    if (order.licenseId) {
      await prisma.license.update({
        where: { id: order.licenseId },
        data: { status: 'revoked' },
      });
    }

    // 删除订单
    await prisma.order.delete({ where: { id } });

    await logOperation(
      admin.userId,
      admin.username,
      'delete_order',
      'Order',
      `删除订单 ${order.orderNo}`,
    );

    return NextResponse.json({ message: '订单已删除' });
  } catch (error) {
    console.error('[ORDERS DELETE ERROR]', error);
    return NextResponse.json({ error: '删除订单失败' }, { status: 500 });
  }
}
