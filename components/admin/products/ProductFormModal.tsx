"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import { centsToYuan, yuanToCents } from "@/lib/admin-utils";
import {
  type Product,
  type ProductForm,
  EMPTY_FORM,
  INPUT_CLS,
  STATUS_EDIT_OPTIONS,
  featuresToText,
  textToFeaturesString,
} from "./types";

export function ProductFormModal({
  editingProduct,
  onClose,
  onSaved,
}: {
  editingProduct: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductForm>(() =>
    editingProduct
      ? {
          name: editingProduct.name,
          slug: editingProduct.slug,
          tagline: editingProduct.tagline,
          description: editingProduct.description,
          icon: editingProduct.icon || "",
          coverImage: editingProduct.coverImage || "",
          features: featuresToText(editingProduct.features),
          demoUrl: editingProduct.demoUrl || "",
          docsUrl: editingProduct.docsUrl || "",
          downloadUrl: editingProduct.downloadUrl || "",
          status: editingProduct.status,
          sortOrder: editingProduct.sortOrder,
          priceBasic: centsToYuan(editingProduct.priceBasic),
          priceStandard: centsToYuan(editingProduct.priceStandard),
          pricePremium: centsToYuan(editingProduct.pricePremium),
          priceEnterprise: centsToYuan(editingProduct.priceEnterprise),
          validDays: editingProduct.validDays,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  // 封面图上传
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  function closeFormModal() {
    if (saving) return;
    onClose();
  }

  // ============ 上传封面图 ============
  async function handleUploadCover(file: File) {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持 PNG、JPG、GIF、WebP 格式的图片");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("文件大小不能超过 2MB");
      return;
    }

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await adminFetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "上传失败");
        return;
      }
      setForm((prev) => ({ ...prev, coverImage: data.url }));
      toast.success("封面上传成功");
    } catch {
      toast.error("上传失败，请稍后重试");
    } finally {
      setUploadingCover(false);
    }
  }

  // ============ 保存产品（创建/更新） ============
  async function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("请输入产品名称");
      return;
    }
    const tagline = form.tagline.trim();
    if (!tagline) {
      toast.error("请输入一句话描述");
      return;
    }
    const description = form.description.trim();
    if (!description) {
      toast.error("请输入产品详细介绍");
      return;
    }

    const payload = {
      name,
      slug: form.slug.trim(),
      tagline,
      description,
      icon: form.icon.trim(),
      coverImage: form.coverImage.trim(),
      features: textToFeaturesString(form.features),
      demoUrl: form.demoUrl.trim(),
      docsUrl: form.docsUrl.trim(),
      downloadUrl: form.downloadUrl.trim(),
      status: form.status,
      sortOrder: Number(form.sortOrder) || 0,
      priceBasic: yuanToCents(form.priceBasic),
      priceStandard: yuanToCents(form.priceStandard),
      pricePremium: yuanToCents(form.pricePremium),
      priceEnterprise: yuanToCents(form.priceEnterprise),
      validDays: Number(form.validDays) || 365,
    };

    try {
      setSaving(true);
      const isEdit = !!editingProduct;
      const res = await adminFetch("/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit ? { id: editingProduct!.id, ...payload } : payload
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || (isEdit ? "更新失败" : "创建失败"));
        return;
      }
      toast.success(isEdit ? "产品已更新" : "产品创建成功");
      onSaved();
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={closeFormModal} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {editingProduct ? "编辑产品" : "新建产品"}
          </h3>
          <button
            onClick={closeFormModal}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 表单内容 */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          {/* 基本信息 */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="text-blue-500">①</span> 基本信息
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 产品名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={INPUT_CLS}
                  placeholder="如：极速后台管理系统"
                />
              </div>
              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Slug（URL 标识）
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slug: e.target.value }))
                  }
                  className={INPUT_CLS}
                  placeholder="留空将根据名称自动生成"
                />
                <p className="mt-1 text-xs text-gray-400">
                  仅限小写字母、数字、连字符，需全局唯一
                </p>
              </div>
              {/* 一句话描述 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  一句话描述 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tagline: e.target.value }))
                  }
                  className={INPUT_CLS}
                  placeholder="如：开箱即用的全栈后台脚手架"
                />
              </div>
              {/* 图标 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  图标（emoji）
                </label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, icon: e.target.value }))
                  }
                  className={INPUT_CLS}
                  placeholder="🚀"
                />
              </div>
              {/* 状态 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  状态
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value }))
                  }
                  className={INPUT_CLS}
                >
                  {STATUS_EDIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {/* 排序值 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  排序值
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                  className={INPUT_CLS}
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-400">数值越大越靠前</p>
              </div>
              {/* 封面图上传 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  封面图
                </label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadCover(file);
                  }}
                />
                {form.coverImage ? (
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <img
                        src={form.coverImage}
                        alt="封面预览"
                        className="h-24 w-40 rounded-lg border border-gray-200 object-cover bg-white"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium rounded-lg opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                      >
                        {uploadingCover ? "上传中..." : "点击替换"}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {uploadingCover ? "上传中..." : "重新上传"}
                      </button>
                      <button
                        onClick={() => {
                          setForm((p) => ({ ...p, coverImage: "" }));
                          if (coverInputRef.current) coverInputRef.current.value = "";
                        }}
                        disabled={uploadingCover}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        删除图片
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="w-full h-24 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingCover ? (
                      <>
                        <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-xs text-gray-500">上传中...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-500">点击上传封面图</span>
                        <span className="text-[10px] text-gray-400">PNG/JPG/GIF/WebP，最大 2MB</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 描述与特性 */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="text-blue-500">②</span> 描述与功能特性
            </h4>
            <div className="space-y-4">
              {/* 详细介绍 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  详细介绍（Markdown） <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={6}
                  className={`${INPUT_CLS} resize-y font-mono`}
                  placeholder="支持 Markdown 语法，详细介绍产品..."
                />
              </div>
              {/* 功能特性 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  功能特性
                </label>
                <textarea
                  value={form.features}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, features: e.target.value }))
                  }
                  rows={5}
                  className={`${INPUT_CLS} resize-y`}
                  placeholder={"每行一个功能特性，例如：\n响应式布局\n权限管理\n数据可视化"}
                />
                <p className="mt-1 text-xs text-gray-400">
                  每行一个特性，提交时将自动转为 JSON 数组
                </p>
              </div>
            </div>
          </section>

          {/* 链接 */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="text-blue-500">③</span> 链接
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  演示地址
                </label>
                <input
                  type="text"
                  value={form.demoUrl}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, demoUrl: e.target.value }))
                  }
                  className={INPUT_CLS}
                  placeholder="https://demo.example.com（可选）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  文档地址
                </label>
                <input
                  type="text"
                  value={form.docsUrl}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, docsUrl: e.target.value }))
                  }
                  className={INPUT_CLS}
                  placeholder="https://docs.example.com（可选）"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                下载链接
                <span className="ml-1 text-xs font-normal text-gray-400">
                  （填写 GitHub 仓库地址，系统自动打包为 ZIP 下载）
                </span>
              </label>
              <input
                type="text"
                value={form.downloadUrl}
                onChange={(e) =>
                  setForm((p) => ({ ...p, downloadUrl: e.target.value }))
                }
                className={INPUT_CLS}
                placeholder="https://github.com/用户名/仓库名"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                支持格式：https://github.com/用户名/仓库名 或 https://github.com/用户名/仓库名.git，用户点击免费下载时将自动从该仓库打包 ZIP 下载
              </p>
            </div>
          </section>

          {/* 定价 */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="text-blue-500">④</span> 定价（单位：元）
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  价格
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    ¥
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.priceStandard}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        priceStandard: e.target.value,
                      }))
                    }
                    className={`${INPUT_CLS} pl-7`}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  授权有效期（天）
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.validDays}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      validDays: Number(e.target.value) || 365,
                    }))
                  }
                  className={INPUT_CLS}
                  placeholder="365"
                />
                <p className="mt-1 text-xs text-gray-400">
                  购买后默认授权有效天数
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={closeFormModal}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? "保存中..."
              : editingProduct
              ? "保存修改"
              : "创建产品"}
          </button>
        </div>
      </div>
    </div>
  );
}
