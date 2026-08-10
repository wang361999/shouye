import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';

interface ContentAdaptModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalContent: string;
  onAdapt: (adaptedContent: string) => void;
}

export default function ContentAdaptModal({
  isOpen,
  onClose,
  originalContent,
  onAdapt,
}: ContentAdaptModalProps) {
  const [adaptedContent, setAdaptedContent] = useState(originalContent);
  const [showDiff, setShowDiff] = useState(false);
  const [autoFormat, setAutoFormat] = useState(true);
  const [preserveCode, setPreserveCode] = useState(true);
  const [preserveImages, setPreserveImages] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAdaptedContent(originalContent);
  }, [originalContent]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc as any);
    }
    return () => document.removeEventListener('keydown', handleEsc as any);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAdapt = () => {
    onAdapt(adaptedContent);
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = adaptedContent.substring(0, start) + '  ' + adaptedContent.substring(end);
      setAdaptedContent(newValue);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setAdaptedContent(e.target.value);
  };

  const renderDiff = () => {
    if (!showDiff) return null;
    const originalLines = originalContent.split('\n');
    const adaptedLines = adaptedContent.split('\n');
    const maxLines = Math.max(originalLines.length, adaptedLines.length);
    const diffLines: { type: 'same' | 'add' | 'remove'; content: string }[] = [];

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const adaptLine = adaptedLines[i] || '';
      if (origLine === adaptLine) {
        diffLines.push({ type: 'same', content: adaptLine });
      } else {
        if (origLine) diffLines.push({ type: 'remove', content: origLine });
        if (adaptLine) diffLines.push({ type: 'add', content: adaptLine });
      }
    }

    return (
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
        <div className="mb-2 font-medium text-gray-700">差异对比：</div>
        <div className="max-h-60 overflow-auto font-mono">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={
                line.type === 'add'
                  ? 'bg-green-50 text-green-700'
                  : line.type === 'remove'
                  ? 'bg-red-50 text-red-700 line-through'
                  : 'text-gray-600'
              }
            >
              <span className="mr-2 select-none">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              {line.content || '\u00A0'}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">内容适配</h2>
            <p className="text-sm text-gray-500">调整内容以适应目标平台格式</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between border-b px-6 py-2">
          <div className="inline-flex rounded-md border border-gray-200 p-0.5">
            <button
              className={`rounded px-3 py-1 text-sm ${
                activeTab === 'preview'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('preview')}
            >
              预览
            </button>
            <button
              className={`rounded px-3 py-1 text-sm ${
                activeTab === 'source'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('source')}
            >
              源码
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={autoFormat}
                onChange={(e) => setAutoFormat(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              自动排版
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={preserveCode}
                onChange={(e) => setPreserveCode(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              保留代码
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={preserveImages}
                onChange={(e) => setPreserveImages(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              保留图片
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              差异对比
            </label>
          </div>
        </div>

        <div className="flex max-h-[calc(90vh-13rem)] flex-col overflow-y-auto px-6 py-4">
          {activeTab === 'source' ? (
            <>
              <label className="mb-1 block text-sm text-gray-600">
                适配后的内容
              </label>
              <textarea
                ref={textareaRef}
                value={adaptedContent}
                onChange={handleChange}
                onKeyDown={handleKeyDown as any}
                className="h-96 w-full resize-none rounded-md border border-gray-200 p-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="在此输入或编辑适配内容..."
              />
              {renderDiff()}
            </>
          ) : (
            <div className="prose max-w-none flex-1 overflow-auto">
              <pre className="whitespace-pre-wrap break-words bg-gray-50 p-2 text-xs">
                {adaptedContent}
              </pre>
              {renderDiff()}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={handleAdapt}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            应用适配
          </button>
        </div>
      </div>
    </div>
  );
}
