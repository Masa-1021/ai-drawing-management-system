/**
 * 設備図面データグリッド - 設備に紐づく図面一覧を表示
 */

import { Box, CircularProgress, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridRowParams } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { useEquipmentDrawings } from '../hooks/useEquipmentDrawings';
import type { Drawing } from '../types/drawing';

interface DrawingDataGridProps {
  equipmentId: string;
}

// 図面から図番を取得するヘルパー関数
const getDrawingNumber = (drawing: Drawing): string => {
  // 摘要表部品から取得
  if (drawing.spec_sheet_item?.drawing_number) {
    return drawing.spec_sheet_item.drawing_number;
  }
  // 抽出フィールドから「図番」を取得
  const drawingNumberField = drawing.extracted_fields?.find(
    (f) => f.field_name === '図番' || f.field_name === '図面番号'
  );
  if (drawingNumberField) {
    return drawingNumberField.field_value;
  }
  return '';
};

// 図面からタイトルを取得するヘルパー関数
const getDrawingTitle = (drawing: Drawing): string => {
  // 抽出フィールドから「名称」を取得
  const titleField = drawing.extracted_fields?.find(
    (f) => f.field_name === '名称' || f.field_name === 'タイトル' || f.field_name === '件名'
  );
  if (titleField) {
    return titleField.field_value;
  }
  // サマリーを使用
  if (drawing.summary) {
    return drawing.summary.substring(0, 50);
  }
  return '';
};

export const DrawingDataGrid = ({ equipmentId }: DrawingDataGridProps) => {
  const navigate = useNavigate();
  const { data: drawings, isLoading, error } = useEquipmentDrawings(equipmentId);

  const columns: GridColDef[] = [
    {
      field: 'pdf_filename',
      headerName: 'ファイル名',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'drawing_number',
      headerName: '図面番号',
      width: 150,
      valueGetter: (_value, row: Drawing) => getDrawingNumber(row),
    },
    {
      field: 'title',
      headerName: '名称',
      flex: 1,
      minWidth: 200,
      valueGetter: (_value, row: Drawing) => getDrawingTitle(row),
    },
    {
      field: 'classification',
      headerName: '分類',
      width: 100,
    },
    {
      field: 'status',
      headerName: 'ステータス',
      width: 100,
      valueFormatter: (value: string) => {
        switch (value) {
          case 'pending': return '未処理';
          case 'analyzing': return '解析中';
          case 'approved': return '承認済';
          case 'unapproved': return '未承認';
          case 'failed': return '失敗';
          default: return value;
        }
      },
    },
    {
      field: 'upload_date',
      headerName: 'アップロード日',
      width: 160,
      valueFormatter: (value: string) => {
        if (!value) return '';
        return new Date(value).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
  ];

  const handleRowClick = (params: GridRowParams) => {
    navigate(`/edit/${params.row.id}`);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">
          図面の読み込みに失敗しました: {error.message}
        </Typography>
      </Box>
    );
  }

  if (!drawings || drawings.length === 0) {
    return (
      <Box p={2}>
        <Typography color="textSecondary">
          この設備に紐づく図面が登録されていません
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <DataGrid
        rows={drawings}
        columns={columns}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25, page: 0 },
          },
        }}
        onRowClick={handleRowClick}
        sx={{
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
          },
        }}
      />
    </Box>
  );
};
