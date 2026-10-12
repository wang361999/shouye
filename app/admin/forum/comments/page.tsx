'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Grid,
  Avatar,
  Tooltip,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiFetch } from '@/lib/fetch-retry';

interface ForumComment {
  id: string;
  content: string;
  authorName: string;
  authorId: string;
  postId: string;
  parentId?: string;
  isApproved: boolean;
  likes: number;
  createdAt: string;
  updatedAt: string;
  postTitle?: string;
}

export default function ForumCommentsPage() {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingComment, setEditingComment] = useState<ForumComment | null>(null);
  const [formData, setFormData] = useState({
    content: '',
    isApproved: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [token, setToken] = useState('');

  useEffect(() => {
    fetchComments();
  }, [filter]);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/forum/comments?filter=${filter}`) as ForumComment[];
      setComments(data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleOpenDialog = (comment?: ForumComment) => {
    if (comment) {
      setEditingComment(comment);
      setFormData({
        content: comment.content,
        isApproved: comment.isApproved,
      });
    } else {
      setEditingComment(null);
      setFormData({
        content: '',
        isApproved: true,
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingComment(null);
  };

  const handleSubmit = async () => {
    if (!formData.content.trim()) {
      setError('内容不能为空');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const url = editingComment
        ? `/api/forum/comments/${editingComment.id}`
        : '/api/forum/comments';
      
      const method = editingComment ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '操作失败');
      }

      handleCloseDialog();
      fetchComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleApproved = async (comment: ForumComment) => {
    try {
      await fetch(`/api/forum/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved: !comment.isApproved }),
      });
      fetchComments();
    } catch (err) {
      console.error('Failed to toggle approval:', err);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm('确定要删除这条评论吗？此操作不可恢复。')) return;

    try {
      await fetch(`/api/forum/comments/${id}`, {
        method: 'DELETE',
      });
      fetchComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">评论管理</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchComments}
        >
          刷新
        </Button>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <FormControl size="small">
          <InputLabel>筛选</InputLabel>
          <Select
            value={filter}
            label="筛选"
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="approved">已通过</MenuItem>
            <MenuItem value="pending">待审核</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>作者</TableCell>
              <TableCell>内容</TableCell>
              <TableCell>帖子</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>点赞</TableCell>
              <TableCell>时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comments.map((comment) => (
              <TableRow key={comment.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                      {comment.authorName[0]}
                    </Avatar>
                    {comment.authorName}
                  </Box>
                </TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                  <Typography variant="body2" noWrap>
                    {comment.content}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {comment.postTitle || comment.postId}
                  </Typography>
                </TableCell>
                <TableCell>
                  {comment.isApproved ? (
                    <Chip label="已通过" size="small" color="success" />
                  ) : (
                    <Chip label="待审核" size="small" color="warning" />
                  )}
                </TableCell>
                <TableCell>{comment.likes}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title="编辑">
                    <IconButton size="small" onClick={() => handleOpenDialog(comment)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={comment.isApproved ? '取消审核' : '通过审核'}>
                    <IconButton size="small" onClick={() => toggleApproved(comment)}>
                      {comment.isApproved ? <BlockIcon /> : <CheckCircleIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" onClick={() => deleteComment(comment.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingComment ? '编辑评论' : '添加评论'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="评论内容"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              fullWidth
              multiline
              rows={4}
              required
            />
            <Box>
              <label>审核状态</label>
              <Select
                value={formData.isApproved ? 'approved' : 'pending'}
                onChange={(e) => setFormData({ ...formData, isApproved: e.target.value === 'approved' })}
                fullWidth
              >
                <MenuItem value="approved">已通过</MenuItem>
                <MenuItem value="pending">待审核</MenuItem>
              </Select>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || !formData.content.trim()}
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
