/**
 * 設備詳細ページ - 左右2ペイン構成
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Paper, Typography, Divider, IconButton, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { EquipmentTree } from '../components/EquipmentTree';
import { EquipmentDetailPanel } from '../components/EquipmentDetailPanel';

export const EquipmentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(id || '');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const handleEquipmentSelect = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    // URLも更新
    window.history.pushState({}, '', `/equipment/${equipmentId}`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', gap: 2 }}>
      {/* 左ペイン: 構成設備ツリー */}
      {sidebarOpen && (
        <>
          <Paper
            elevation={2}
            sx={{
              width: '30%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'width 0.3s ease',
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">構成設備</Typography>
              <Tooltip title="サイドバーを閉じる">
                <IconButton onClick={() => setSidebarOpen(false)} size="small">
                  <ChevronLeft />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              <EquipmentTree
                selectedEquipmentId={selectedEquipmentId}
                onEquipmentSelect={handleEquipmentSelect}
              />
            </Box>
          </Paper>
          <Divider orientation="vertical" flexItem />
        </>
      )}

      {/* 右ペイン: 設備詳細 */}
      <Paper
        elevation={2}
        sx={{
          width: sidebarOpen ? '70%' : '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!sidebarOpen && (
            <Tooltip title="サイドバーを開く">
              <IconButton onClick={() => setSidebarOpen(true)} size="small">
                <ChevronRight />
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="h6">設備詳細</Typography>
          <Box sx={{ width: 40 }} /> {/* スペーサー */}
        </Box>
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {selectedEquipmentId ? (
            <EquipmentDetailPanel equipmentId={selectedEquipmentId} />
          ) : (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              height="100%"
            >
              <Typography color="textSecondary">
                左側のツリーから設備を選択してください
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};
