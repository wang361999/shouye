'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  MenuItem,
  IconButton,
  Select,
  InputLabel,
  FormControl,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import AIIcon from '@/components/common/AIIcon';
import Image from 'next/image';

interface ContentAdaptModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: {
    id: string;
    title: string;
    content: string;
    type: 'post' | 'comment';
    authorName?: string;
  };
}

export default function ContentAdaptModal({
  open,
  onClose,
  onSuccess,
  template,
}: ContentAdaptModalProps) {
  const [aiResult, setAiResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [adaptType, setAdaptType] = useState<'rewrite' | 'expand' | 'condense'>('rewrite');
  const [style, setStyle] = useState('');
  const [length, setLength] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'result' | 'edit'>('result');

  // 预设提示词
  const presetPrompts = [
    '使内容更加口语化，适合论坛讨论',
    '增加技术深度，添加代码示例',
    '精简内容，突出核心观点',
    '添加更多实战案例和经验分享',
    '调整为更专业的技术文档风格',
    '增加可读性，使用更多列表和分段',
  ];

  const handleGenerate = async () => {
    if (!template?.content) {
      setError('模板内容为空');
      return;
    }

    setIsLoading(true);
    setError('');
    setAiResult('');

    try {
      const prompt = customPrompt || 
        `${adaptType === 'rewrite' ? '改写' : adaptType === 'expand' ? '扩写' : '精简'}以下内容${style ? `，风格要求：${style}` : ''}${length ? `，长度要求：${length}` : ''}，保持核心信息不变，使其更适合论坛发布：\n\n${template.content}`;

      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: template.content,
          prompt,
          style,
          length,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI 生成失败');
      }

      setAiResult(data.content);
      setActiveTab('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const contentToSave = activeTab === 'edit' ? aiResult : aiResult;
    
    if (!contentToSave?.trim()) {
      setError('内容为空');
      return;
    }

    try {
      const response = await fetch('/api/admin/content-adapt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalContent: template?.content,
          adaptedContent: contentToSave,
          adaptType,
          style,
          length,
          customPrompt,
          sourceTemplateId: template?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon />
          <Typography variant="h6">AI 内容适配</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* 模板预览 */}
        <Paper sx={{ mb: 3, p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            原始模板
          </Typography>
          {template?.title && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {template.title}
            </Typography>
          )}
          {template?.authorName && (
            <Typography variant="caption" color="text.secondary" display="block">
              作者：{template.authorName}
            </Typography>
          )}
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
            {template?.content?.slice(0, 500)}
            {template?.content?.length > 500 && '...'}
          </Typography>
        </Paper>

        {/* 控制选项 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            适配选项
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>适配类型</InputLabel>
              <Select
                value={adaptType}
                label="适配类型"
                onChange={(e) => setAdaptType(e.target.value as any)}
              >
                <MenuItem value="rewrite">改写</MenuItem>
                <MenuItem value="expand">扩写</MenuItem>
                <MenuItem value="condense">精简</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              size="small"
              label="风格要求"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="如：口语化、专业、轻松..."
              sx={{ minWidth: 200 }}
            />
            
            <TextField
              size="small"
              label="长度要求"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="如：500字、精简版..."
              sx={{ minWidth: 150 }}
            />
          </Box>

          {/* 预设提示词 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              快速选择：
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {presetPrompts.map((preset, idx) => (
                <Chip
                  key={idx}
                  label={preset}
                  size="small"
                  onClick={() => setCustomPrompt(preset)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {/* 自定义提示词 */}
          <TextField
            multiline
            rows={3}
            label="自定义提示词（可选）"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="输入更详细的适配要求..."
            sx={{ mb: 2 }}
          />
        </Box>

        {/* 生成按钮 */}
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={isLoading || !template?.content}
          startIcon={isLoading ? undefined : <AIIcon />}
          sx={{ mb: 3 }}
        >
          {isLoading ? 'AI 生成中...' : '生成适配内容'}
        </Button>

        {/* 结果展示 */}
        {aiResult && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                size="small"
                variant={activeTab === 'result' ? 'contained' : 'outlined'}
                onClick={() => setActiveTab('result')}
              >
                预览结果
              </Button>
              <Button
                size="small"
                variant={activeTab === 'edit' ? 'contained' : 'outlined'}
                onClick={() => setActiveTab('edit')}
              >
                编辑内容
              </Button>
            </Box>

            {activeTab === 'result' ? (
              <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {aiResult}
                </Typography>
              </Paper>
            ) : (
              <TextField
                multiline
                rows={15}
                value={aiResult}
                onChange={(e) => setAiResult(e.target.value)}
                sx={{ width: '100%' }}
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!aiResult || isLoading}
          startIcon={<SendIcon />}
        >
          保存并使用
        </Button>
      </DialogActions>
    </Dialog>
  );
}
