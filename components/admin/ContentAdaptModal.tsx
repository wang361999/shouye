import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentAdaptModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  targetPlatform: '小红书' | '公众号' | '知乎' | '微博' | '抖音';
  onAdapted?: (adaptedContent: string) => void;
}

export function ContentAdaptModal({
  isOpen,
  onClose,
  content,
  targetPlatform,
  onAdapted,
}: ContentAdaptModalProps) {
  const [isAdapting, setIsAdapting] = useState(false);
  const [adaptedContent, setAdaptedContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleAdapt = async () => {
    if (!content.trim()) return;

    setIsAdapting(true);
    setError(null);
    setAdaptedContent('');

    try {
      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          targetPlatform,
          mode: 'adapt',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setAdaptedContent(data.content || content);
    } catch (err) {
      setError(err instanceof Error ? err.message : '适配失败');
    } finally {
      setIsAdapting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(adaptedContent);
  };

  const handleApply = () => {
    onAdapted?.(adaptedContent);
    onClose();
  };

  if (!isOpen) return null;

  const platformStyles = {
    '小红书': { color: 'text-[#FF2442]', bg: 'bg-[#FF2442]/10', border: 'border-[#FF2442]/30' },
    '公众号': { color: 'text-[#07C160]', bg: 'bg-[#07C160]/10', border: 'border-[#07C160]/30' },
    '知乎': { color: 'text-[#0066FF]', bg: 'bg-[#0066FF]/10', border: 'border-[#0066FF]/30' },
    '微博': { color: 'text-[#FF8200]', bg: 'bg-[#FF8200]/10', border: 'border-[#FF8200]/30' },
    '抖音': { color: 'text-[#FE2C55]', bg: 'bg-[#FE2C55]/10', border: 'border-[#FE2C55]/30' },
  };

  const style = platformStyles[targetPlatform];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', style.bg)}>
              <span className={cn('text-lg font-bold', style.color)}>
                {targetPlatform[0]}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">内容适配</h2>
              <p className="text-sm text-muted-foreground">
                将内容适配到{targetPlatform}风格
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Original */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">原始内容</span>
                <span className="text-xs text-muted-foreground">
                  {content.length} 字符
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  // 实时更新内容长度显示
                }}
                className="flex-1 w-full p-4 bg-muted/50 border border-border rounded-xl resize-none text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="输入或粘贴要适配的内容..."
              />
            </div>

            {/* Adapted */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">
                  {targetPlatform}风格
                </span>
                <div className="flex items-center gap-2">
                  {adaptedContent && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      复制
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 relative">
                {isAdapting ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30 rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">AI 正在适配中...</p>
                  </div>
                ) : adaptedContent ? (
                  <textarea
                    value={adaptedContent}
                    onChange={(e) => setAdaptedContent(e.target.value)}
                    className="w-full h-full p-4 bg-primary/5 border border-primary/20 rounded-xl resize-none text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ) : (
                  <div className="w-full h-full p-4 bg-muted/30 border border-dashed border-border rounded-xl flex items-center justify-center">
                    <p className="text-sm text-muted-foreground text-center">
                      点击&quot;开始适配&quot;生成{targetPlatform}风格内容
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleAdapt}
            disabled={isAdapting || !content.trim()}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-xl transition-all',
              isAdapting || !content.trim()
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : cn('bg-primary text-primary-foreground hover:opacity-90', style.border),
            )}
          >
            {isAdapting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                适配中...
              </span>
            ) : (
              '开始适配'
            )}
          </button>
          {adaptedContent && (
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium bg-success text-success-foreground rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              应用到内容
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContentAdaptModal;
