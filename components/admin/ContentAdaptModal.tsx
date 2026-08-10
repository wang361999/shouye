"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner,
  Chip,
} from "@nextui-org/react";
import { adminFetch } from "@/lib/admin-fetch";

interface AdaptTarget {
  id: number;
  title: string;
  type: "post" | "comment";
  content: string;
  authorName?: string;
  url?: string;
}

interface AdaptResult {
  success: boolean;
  originalContent: string;
  adaptedContent: string;
  summary?: string;
  error?: string;
  target?: {
    id: number;
    type: string;
    title?: string;
    url?: string;
  };
}

export default function ContentAdaptModal({
  isOpen,
  onOpenChange,
  targets,
  onAdapted,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targets: AdaptTarget[];
  onAdapted?: () => void;
}) {
  const [targetType, setTargetType] = useState<"post" | "comment">("post");
  const [targetId, setTargetId] = useState<number | "">("");
  const [instruction, setInstruction] = useState("改写为更易懂的表述，适合初学者阅读");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdaptResult | null>(null);
  const [targetList, setTargetList] = useState<AdaptTarget[]>([]);

  useEffect(() => {
    if (isOpen && targets.length > 0) {
      setTargetList(targets);
      setTargetType(targets[0].type);
      setTargetId(targets[0].id);
      setResult(null);
    }
  }, [isOpen, targets]);

  const handleAdapt = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await adminFetch("/api/admin/content-adapt", {
        method: "POST",
        body: JSON.stringify({
          targetType,
          targetId: Number(targetId),
          instruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          success: false,
          originalContent: "",
          adaptedContent: "",
          error: data.error || "适配失败",
        });
        return;
      }
      setResult(data);
      onAdapted?.();
    } catch (err) {
      setResult({
        success: false,
        originalContent: "",
        adaptedContent: "",
        error: err instanceof Error ? err.message : "网络错误",
      });
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType, instruction, onAdapted]);

  const handleApply = useCallback(async () => {
    if (!result?.success || !result.adaptedContent) return;
    setLoading(true);
    try {
      const res = await adminFetch(
        `/api/admin/content-adapt?targetType=${targetType}&targetId=${targetId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            adaptedContent: result.adaptedContent,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(`应用失败: ${data.error || "未知错误"}`);
        return;
      }
      alert("内容已成功应用并更新！");
      onOpenChange(false);
      onAdapted?.();
    } catch (err) {
      alert(
        `应用失败: ${err instanceof Error ? err.message : "网络错误"}`
      );
    } finally {
      setLoading(false);
    }
  }, [result, targetType, targetId, onOpenChange, onAdapted]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              AI 内容适配改写
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="目标类型"
                    selectedKeys={[targetType]}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0] as "post" | "comment";
                      setTargetType(val);
                      const first = targetList.find((t) => t.type === val);
                      setTargetId(first?.id ?? "");
                    }}
                    isDisabled={loading}
                  >
                    <SelectItem key="post" value="post">
                      帖子
                    </SelectItem>
                    <SelectItem key="comment" value="comment">
                      评论
                    </SelectItem>
                  </Select>
                  <Select
                    label="目标内容"
                    selectedKeys={targetId ? [String(targetId)] : []}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0] as string;
                      setTargetId(val ? Number(val) : "");
                    }}
                    isDisabled={loading || targetList.length === 0}
                  >
                    {targetList
                      .filter((t) => t.type === targetType)
                      .map((t) => (
                        <SelectItem key={String(t.id)} value={String(t.id)}>
                          {t.title}
                        </SelectItem>
                      ))}
                  </Select>
                </div>
                <Textarea
                  label="改写指令"
                  placeholder="例如：改写为更简洁的表述"
                  value={instruction}
                  onValueChange={setInstruction}
                  isDisabled={loading}
                  minRows={2}
                />
                <Button
                  color="primary"
                  onPress={handleAdapt}
                  isLoading={loading && !result}
                  isDisabled={!targetId || !instruction}
                >
                  开始 AI 改写
                </Button>

                {result && (
                  <div className="space-y-4">
                    <Divider />
                    {result.success ? (
                      <>
                        <Card>
                          <CardHeader className="text-small font-semibold">
                            原始内容
                          </CardHeader>
                          <CardBody>
                            <pre className="whitespace-pre-wrap text-sm">
                              {result.originalContent}
                            </pre>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardHeader className="text-small font-semibold">
                            AI 改写后内容
                          </CardHeader>
                          <CardBody>
                            <pre className="whitespace-pre-wrap text-sm">
                              {result.adaptedContent}
                            </pre>
                          </CardBody>
                        </Card>
                        {result.summary && (
                          <Chip color="primary" variant="flat">
                            {result.summary}
                          </Chip>
                        )}
                        <Button
                          color="success"
                          onPress={handleApply}
                          isLoading={loading}
                        >
                          应用改写结果
                        </Button>
                      </>
                    ) : (
                      <Card>
                        <CardBody>
                          <p className="text-danger">
                            改写失败: {result.error || "未知错误"}
                          </p>
                        </CardBody>
                      </Card>
                    )}
                  </div>
                )}

                <div className="text-small text-default-500">
                  提示：AI 会根据指令自动改写内容。你可以 &quot;预览&quot; 后再决定是否应用。
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="danger"
                variant="light"
                onPress={onClose}
                isDisabled={loading}
              >
                关闭
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
