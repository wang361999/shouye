'use client';

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiFetch } from '@/lib/fetch-retry';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  isActive: boolean;
  awardedCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    condition: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/badges') as Badge[];
      setBadges(data);
    } catch (err) {
      console.error('Failed to fetch badges:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (badge?: Badge) => {
    if (badge) {
      setEditingBadge(badge);
      setFormData({
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        condition: badge.condition,
      });
    } else {
      setEditingBadge(null);
      setFormData({
        name: '',
        description: '',
        icon: '',
        condition: '',
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBadge(null);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.condition) {
      setError('名称和条件不能为空');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const url = editingBadge
        ? `/api/badges/${editingBadge.id}`
        : '/api/badges';
      
      const method = editingBadge ? 'PATCH' : 'POST';
      
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
      fetchBadges();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (badge: Badge) => {
    try {
      await fetch(`/api/badges/${badge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !badge.isActive }),
      });
      fetchBadges();
    } catch (err) {
      console.error('Failed to toggle badge:', err);
    }
  };

  const deleteBadge = async (id: string) => {
    if (!confirm('确定要删除这个徽章吗？此操作不可恢复。')) return;

    try {
      await fetch(`/api/badges/${id}`, {
        method: 'DELETE',
      });
      fetchBadges();
    } catch (err) {
      console.error('Failed to delete badge:', err);
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
        <Typography variant="h4">徽章管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加徽章
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>图标</TableCell>
              <TableCell>名称</TableCell>
              <TableCell>描述</TableCell>
              <TableCell>条件</TableCell>
              <TableCell>已颁发</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {badges.map((badge) => (
              <TableRow key={badge.id}>
                <TableCell>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                    {badge.icon}
                  </Avatar>
                </TableCell>
                <TableCell>{badge.name}</TableCell>
                <TableCell>{badge.description}</TableCell>
                <TableCell>
                  <Chip label={badge.condition} size="small" />
                </TableCell>
                <TableCell>{badge.awardedCount}</TableCell>
                <TableCell>
                  {badge.isActive ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <BlockIcon color="error" />
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip title="编辑">
                    <IconButton size="small" onClick={() => handleOpenDialog(badge)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={badge.isActive ? '禁用' : '启用'}>
                    <IconButton size="small" onClick={() => toggleActive(badge)}>
                      {badge.isActive ? <BlockIcon /> : <CheckCircleIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" onClick={() => deleteBadge(badge.id)} color="error">
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
          {editingBadge ? '编辑徽章' : '添加徽章'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="徽章名称"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="描述"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="图标 Emoji"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              fullWidth
              placeholder="例如：🏆 ⭐ 🎯"
            />
            <TextField
              label="获取条件"
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              fullWidth
              placeholder="例如：累计发帖 100 篇"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || !formData.name || !formData.condition}
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
