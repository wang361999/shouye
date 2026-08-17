import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wand2, ChevronRight, RefreshCw, Check, AlertCircle, MessageSquare, Code2, FileText, Lightbulb } from 'lucide-react';
import { Button, Card, CardBody, Textarea, Spinner } from '@nextui-org/react';
import { callAICompletion } from '@/lib/ai';

interface ContentAdaptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialContent?: string;
  onApply: (adaptedTitle: string, adaptedContent: string) => void;
  loading?: boolean;
  mode?: 'write' | 'improve' | 'expand' | 'summarize';
  type?: 'post' | 'comment' | 'docs';
}

interface AdaptationStrategy {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  example: string;
  systemHint: string;
}

const STRATEGIES: AdaptationStrategy[] = [
  {
    key: 'professional',
    label: '专业严谨',
    icon: FileText,
    description: '严肃技术语调，严谨准确，适合博客或长篇',
    example: '勿在小技，舍大本。要以学术语调严谨阐述。',
    systemHint: '请用专业、严谨的技术语调重写，保持信息准确、客观，适合技术长文。',
  },
  {
    key: 'community',
    label: '社区亲切',
    icon: MessageSquare,
    description: '自然口语、亲切直率，适合社区讨论与轻分享',
    example: '好东西当然要拆开摆一摆，咱们边看边聊。',
    systemHint: '请用自然、亲切的社区语调重写，像朋友间分享，避免过于正式的生硬措辞。',
  },
  {
    key: 'concise',
    label: '凝练精简',
    icon: Code2,
    description: '极致精简、直指要害，适合技术公告或快讯',
    example: '核心变更：统一显式 bcrypt 实现，历史兼容自动降级。',
    systemHint: '请将内容极致精简，只保留必要信息与关键点，适合作为公告或快讯。',
  },
  {
    key: 'expanded',
    label: '扩写详解',
    icon: Lightbulb,
    description: '在不丢失原意的前提下扩写并补齐细节',
    example: '不仅仅是声明，还要有来龙去脉；不仅仅是用法，还要有雷区与最坏情况。',
    systemHint: '请在保留原意的基础上扩写，补充必要的背景、动机、实践细节、示例与适用场景。',
  },
];

export default function ContentAdaptModal({
  isOpen,
  onClose,
  initialTitle = '',
  initialContent = '',
  onApply,
  loading = false,
  mode = 'write',
  type = 'post',
}: ContentAdaptModalProps) {
  const [activeTab, setActiveTab] = useState<'strategy' | 'prompt'>('strategy');
  const [activeStrategy, setActiveStrategy] = useState<string>('professional');
  const [prompt, setPrompt] = useState('');
  const [adaptedTitle, setAdaptedTitle] = useState(initialTitle);
  const [adaptedContent, setAdaptedContent] = useState(initialContent);
  const [adapting, setAdapting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAdaptedTitle(initialTitle);
      setAdaptedContent(initialContent);
      setError(null);
      setPrompt('');
      setShowDiff(false);
    }
  }, [isOpen, initialTitle, initialContent]);

  const canApply = useMemo(() => {
    return (
      !loading &&
      !adapting &&
      (adaptedTitle !== initialTitle || adaptedContent !== initialContent) &&
      adaptedContent.trim().length > 0
    );
  }, [loading, adapting, adaptedTitle, adaptedContent, initialTitle, initialContent]);

  const handleAdapt = async () => {
    if (adapting) return;
    setAdapting(true);
    setError(null);
    setShowDiff(false);
    try {
      const strategy = STRATEGIES.find((s) => s.key === activeStrategy);
      const systemPrompt =
        activeTab === 'strategy'
          ? strategy?.systemHint
          : `请根据以下要求调整文本：${prompt}`;
      if (activeTab === 'prompt' && !prompt.trim()) {
        throw new Error('请提供自定义适配要求');
      }
      const userPrompt = `以下是需要调整的文本：

标题：${initialTitle}
正文：${initialContent}

请输出适配后的完整内容，严格使用如下 JSON 格式：
{"title":"适配后的标题","content":"适配后的正文，保留 Markdown 格式"}`;
      const { content } = await callAICompletion(userPrompt, {
        systemPrompt,
        maxTokens: 4000,
        temperature: 0.7,
      });
      let parsed: { title?: string; content?: string } | null = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/"title"\s*:\s*"([^"]*)"/);
        const c = content.match(/"content"\s*:\s*"([\s\S]*?)"\s*}/);
        parsed = { title: m?.[1], content: c?.[1] };
      }
      if (!parsed?.content) {
        throw new Error('AI 返回内容无法解析，请重试');
      }
      setAdaptedTitle(parsed.title || initialTitle);
      setAdaptedContent(parsed.content);
      setShowDiff(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setAdapting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-divider"
            initial={{ scale: 0.92, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
              <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">AI 内容适配</h2>
                </div>
              <Button isIconOnly variant="light" size="sm" onPress={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex space-x-1 mb-4 bg-content2 p-1 rounded-lg w-fit">
                <button
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'strategy' ? 'bg-primary text-white shadow' : 'text-default-foreground hover:bg-content3'
                  }`}
                  onClick={() => setActiveTab('strategy')}
                >
                  策略模式
                </button>
                <button
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'prompt' ? 'bg-primary text-white shadow' : 'text-default-foreground hover:bg-content3'
                  }`}
                  onClick={() => setActiveTab('prompt')}
                >
                  自定义要求
                </button>
              </div>

              {activeTab === 'strategy' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STRATEGIES.map((s) => {
                    const Icon = s.icon;
                    const isActive = activeStrategy === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        className={`text-left p-3 rounded-xl border transition-all ${
                          isActive
                            ? 'border-primary bg-primary/10'
                            : 'border-divider hover:border-primary/50 hover:bg-content2'
                        }`}
                        onClick={() => setActiveStrategy(s.key)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'bg-content3'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{s.label}</div>
                            <div className="text-xs text-default-500 mt-0.5">{s.description}</div>
                          </div>
                          {isActive && (
                            <Check className="w-4 h-4 text-primary mt-1" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <Textarea
                    placeholder="例如：把它改得更口语化；突出重点 React 性能相关的技巧；加上一句对初学者的鼓励回复……"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    minRows={3}
                    maxRows={8}
                    variant="bordered"
                    className="w-full"
                  />
                </div>
              )}

              <div className="mt-5 p-3 rounded-xl border border-divider bg-content2/50">
                <div className="text-xs text-default-500 mb-2 uppercase tracking-wider">结果预览</div>
                <div className="text-sm font-medium mb-1">{adaptedTitle || '（暂无标题）'}</div>
                <div className="text-xs text-default-700 whitespace-pre-wrap font-mono line-clamp-4">
                  {adaptedContent || '（暂无适配结果）'}
                </div>
              </div>

              {showDiff && (
                <div className="mt-3 p-3 rounded-xl border border-success-200 bg-success-50 text-xs text-success-700 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  已生成新版本，可点击下方{"\""}应用到正文{"\""}覆盖原内容
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-xl border border-danger-200 bg-danger-50 text-sm text-danger-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>{error}</div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-divider flex items-center justify-between gap-2">
              <div className="text-xs text-default-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                基于现有内容调用 AI 模型
              </div>
              <div className="flex items-center gap-2">
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isDisabled={adapting || loading}
                  isLoading={adapting || loading}
                  startContent={!adapting && !loading ? <RefreshCw className="w-4 h-4" /> : undefined}
                  onPress={handleAdapt}
                >
                  生成适配
                </Button>
                <Button
                  color="success"
                  isDisabled={!canApply}
                  startContent={<ChevronRight className="w-4 h-4" />}
                  onPress={() => {
                    onApply(adaptedTitle, adaptedContent);
                    onClose();
                  }}
                >
                  应用到正文
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
