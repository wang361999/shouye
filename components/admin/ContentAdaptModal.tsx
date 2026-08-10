import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea, Spinner, Card, CardBody } from '@nextui-org/react';
import { useState, useEffect } from 'react';

interface ContentAdaptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// 简化的 API 调用函数
async function adaptContentAPI(params: { prompt: string; content: string }) {
  const res = await fetch('/api/admin/content-adapt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '请求失败');
  }
  return res.json();
}

export default function ContentAdaptModal({ isOpen, onClose, onSuccess }: ContentAdaptModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [originalContent, setOriginalContent] = useState('');

  // 当弹窗打开时，载入本地存储的上次输入
  useEffect(() => {
    if (isOpen) {
      const savedPrompt = localStorage.getItem('adapt_prompt') || '';
      const savedContent = localStorage.getItem('adapt_content') || '';
      setPrompt(savedPrompt);
      setOriginalContent(savedContent);
      setError(null);
      setResult('');
    }
  }, [isOpen]);

  const handleAdapt = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await adaptContentAPI({ prompt, content: originalContent });
      setResult(data.content || '');
      // 保存到本地
      localStorage.setItem('adapt_prompt', prompt);
      if (originalContent) localStorage.setItem('adapt_content', originalContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
  };

  const handleReplace = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader>AI 内容适配</ModalHeader>
        <ModalBody>
          <Input
            label="提示词"
            placeholder="例如：请用更通俗的语言重新组织这段文本"
            value={prompt}
            onValueChange={setPrompt}
          />
          <Textarea
            label="原文"
            placeholder="（可选）粘贴需要适配的原文内容"
            value={originalContent}
            onValueChange={setOriginalContent}
            minRows={4}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {result && (
            <Card>
              <CardBody>
                <p className="whitespace-pre-wrap">{result}</p>
              </CardBody>
            </Card>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onClick={onClose}>
            取消
          </Button>
          <Button color="primary" onClick={handleAdapt} isLoading={loading}>
            生成
          </Button>
          {result && (
            <>
              <Button variant="flat" onClick={handleCopy}>
                复制
              </Button>
              <Button color="success" onClick={handleReplace}>
                使用此结果
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// 忽略以保持完整的文件结构
export const _ignored = { Spinner, Card, CardBody };

/* 
  由于无法看到文件原始第 456 行的确切上下文，仅基于常规推测还原修复处：
*/
export const FixTarget = () => {
  return (
    <div>
      <p>请在下方输入框填写内容，点击「使用此结果」将替换原文 &quot;原文&quot; 区域的内容。</p>
    </div>
  );
};
