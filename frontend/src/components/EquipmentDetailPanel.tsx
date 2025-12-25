/**
 * 設備詳細パネル - タブ切り替え式の設備情報表示
 */

import { useState } from 'react';
import { Box, Tabs, Tab, Typography, CircularProgress } from '@mui/material';
import { useEquipment } from '../hooks/useEquipments';
import { DrawingDataGrid } from './DrawingDataGrid';
import { EquipmentAttachmentList } from './EquipmentAttachmentList';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`equipment-tabpanel-${index}`}
      aria-labelledby={`equipment-tab-${index}`}
      style={{ height: '100%' }}
    >
      {value === index && <Box sx={{ height: '100%', p: 2 }}>{children}</Box>}
    </div>
  );
};

interface EquipmentDetailPanelProps {
  equipmentId: string;
}

export const EquipmentDetailPanel = ({ equipmentId }: EquipmentDetailPanelProps) => {
  const [tabValue, setTabValue] = useState(0);
  const { data: equipment, isLoading, error } = useEquipment(equipmentId);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">
          設備情報の読み込みに失敗しました: {error.message}
        </Typography>
      </Box>
    );
  }

  if (!equipment) {
    return (
      <Box p={2}>
        <Typography color="textSecondary">
          設備が見つかりません
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー部分 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}>
        <Typography variant="h6" gutterBottom>
          {equipment.name}
        </Typography>
        {equipment.code && (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            設備コード: {equipment.code}
          </Typography>
        )}
        {equipment.description && (
          <Typography variant="body2" color="textSecondary" paragraph>
            {equipment.description}
          </Typography>
        )}
      </Box>

      {/* タブ部分 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="設備詳細タブ">
          <Tab label="設備図面" id="equipment-tab-0" aria-controls="equipment-tabpanel-0" />
          <Tab label="ソフト関連" id="equipment-tab-1" aria-controls="equipment-tabpanel-1" />
          <Tab label="取説" id="equipment-tab-2" aria-controls="equipment-tabpanel-2" />
          <Tab label="点検マニュアル" id="equipment-tab-3" aria-controls="equipment-tabpanel-3" />
          <Tab label="資産情報" id="equipment-tab-4" aria-controls="equipment-tabpanel-4" />
        </Tabs>
      </Box>

      {/* タブパネル部分 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <TabPanel value={tabValue} index={0}>
          <DrawingDataGrid equipmentId={equipmentId} />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <EquipmentAttachmentList equipmentId={equipmentId} category="soft" />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <EquipmentAttachmentList equipmentId={equipmentId} category="manual" />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <EquipmentAttachmentList equipmentId={equipmentId} category="inspection" />
        </TabPanel>
        <TabPanel value={tabValue} index={4}>
          <EquipmentAttachmentList equipmentId={equipmentId} category="asset" />
        </TabPanel>
      </Box>
    </Box>
  );
};
