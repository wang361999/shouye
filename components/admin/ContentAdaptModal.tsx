import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Alert, Spinner } from './ui';
import { toast } from 'sonner';
import { getCSRFToken } from '@/lib/csrf';

interface ContentAdaptModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  postTitle?: string;
}

export function ContentAdaptModal({ isOpen, onClose, postId, postTitle }: ContentAdaptModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦到文本区域
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch('/api/admin/content-adapt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          postId,
          postTitle,
          content: result,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '操作失败');
      }
      
      toast.success('内容适配成功');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="内容适配"
      size="large"
    >
      <Form onSubmit={handleSubmit}>
        <Form.Group>
          <Form.Label>适配后的内容</Form.Label>
          <Form.Textarea
            ref={textareaRef}
            value={result || ''}
            onChange={(e) => setResult(e.target.value)}
            placeholder="请输入适配后的内容..."
            rows={10}
            required
          />
          <Form.HelpText>
            基于原文内容，适配为适合当前平台风格的内容
          </Form.HelpText>
        </Form.Group>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        )}
        
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={loading || !result}
          >
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                处理中...
              </>
            ) : (
              '保存适配'
            )}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export default ContentAdaptModal;
