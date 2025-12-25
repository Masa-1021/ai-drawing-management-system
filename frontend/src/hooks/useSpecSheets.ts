/**
 * 摘要表用React Queryフック
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSpecSheets,
  getSpecSheet,
  uploadSpecSheet,
  updateSpecSheet,
  deleteSpecSheet,
  linkSpecSheetToEquipment,
  findMatchingDrawings,
  linkDrawingsToSpecSheet,
  updateItemParent,
  bulkUpdatePartType,
  linkDrawingToItem,
  unlinkDrawingFromItem,
  updateItemWebLink,
} from '../api/spec-sheets';
import type {
  SpecSheet,
  SpecSheetListParams,
  LinkEquipmentRequest,
  LinkDrawingsRequest,
  UpdateItemParentRequest,
  BulkUpdatePartTypeRequest,
  LinkSingleDrawingRequest,
  UpdateWebLinkRequest,
} from '../types/spec-sheet';

// Query Keys
export const specSheetKeys = {
  all: ['spec-sheets'] as const,
  lists: () => [...specSheetKeys.all, 'list'] as const,
  list: (params: SpecSheetListParams) => [...specSheetKeys.lists(), params] as const,
  details: () => [...specSheetKeys.all, 'detail'] as const,
  detail: (id: string) => [...specSheetKeys.details(), id] as const,
  matchingDrawings: (id: string) => [...specSheetKeys.all, 'matching-drawings', id] as const,
};

/**
 * 摘要表一覧取得フック
 */
export const useSpecSheets = (params: SpecSheetListParams = {}) => {
  return useQuery({
    queryKey: specSheetKeys.list(params),
    queryFn: () => getSpecSheets(params),
    staleTime: 5 * 60 * 1000, // 5分
  });
};

/**
 * 摘要表詳細取得フック
 */
export const useSpecSheet = (id: string) => {
  return useQuery({
    queryKey: specSheetKeys.detail(id),
    queryFn: () => getSpecSheet(id),
    enabled: !!id,
  });
};

/**
 * 摘要表アップロードフック
 */
export const useUploadSpecSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, equipmentId }: { file: File; equipmentId?: string }) =>
      uploadSpecSheet(file, equipmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.lists() });
    },
  });
};

/**
 * 摘要表更新フック
 */
export const useUpdateSpecSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<SpecSheet, 'equipment_name' | 'line_name' | 'model_name' | 'status'>>;
    }) => updateSpecSheet(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: specSheetKeys.lists() });
    },
  });
};

/**
 * 摘要表削除フック
 */
export const useDeleteSpecSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSpecSheet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.lists() });
    },
  });
};

/**
 * 摘要表を設備に紐づけフック
 */
export const useLinkSpecSheetToEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ specSheetId, request }: { specSheetId: string; request: LinkEquipmentRequest }) =>
      linkSpecSheetToEquipment(specSheetId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.specSheetId) });
      queryClient.invalidateQueries({ queryKey: specSheetKeys.lists() });
    },
  });
};

/**
 * 紐づけ候補の図面を検索するフック
 */
export const useMatchingDrawings = (specSheetId: string, enabled = true) => {
  return useQuery({
    queryKey: specSheetKeys.matchingDrawings(specSheetId),
    queryFn: () => findMatchingDrawings(specSheetId),
    enabled: !!specSheetId && enabled,
    staleTime: 0, // 常に最新を取得
  });
};

/**
 * 図面を一括紐づけするフック
 */
export const useLinkDrawingsToSpecSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ specSheetId, request }: { specSheetId: string; request: LinkDrawingsRequest }) =>
      linkDrawingsToSpecSheet(specSheetId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.specSheetId) });
      queryClient.invalidateQueries({
        queryKey: specSheetKeys.matchingDrawings(variables.specSheetId),
      });
    },
  });
};

/**
 * 部品の親を更新するフック
 */
export const useUpdateItemParent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      specSheetId,
      itemId,
      request,
    }: {
      specSheetId: string;
      itemId: string;
      request: UpdateItemParentRequest;
    }) => updateItemParent(specSheetId, itemId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.specSheetId) });
    },
  });
};

/**
 * 部品種別を一括更新するフック
 */
export const useBulkUpdatePartType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      specSheetId,
      request,
    }: {
      specSheetId: string;
      request: BulkUpdatePartTypeRequest;
    }) => bulkUpdatePartType(specSheetId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.specSheetId) });
    },
  });
};

/**
 * 部品に図面を紐づけるフック
 */
export const useLinkDrawingToItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      specSheetId,
      itemId,
      request,
    }: {
      specSheetId: string;
      itemId: string;
      request: LinkSingleDrawingRequest;
    }) => linkDrawingToItem(specSheetId, itemId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.specSheetId) });
      // 図面一覧も更新（摘要表情報が変わるため）
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};

/**
 * 部品から図面の紐づけを解除するフック
 */
export const useUnlinkDrawingFromItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      specSheetId,
      itemId,
    }: {
      specSheetId: string;
      itemId: string;
    }) => unlinkDrawingFromItem(specSheetId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.specSheetId) });
      // 図面一覧も更新（摘要表情報が変わるため）
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};

/**
 * 部品のWebリンクを更新するフック
 */
export const useUpdateItemWebLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      specSheetId,
      itemId,
      request,
    }: {
      specSheetId: string;
      itemId: string;
      request: UpdateWebLinkRequest;
    }) => updateItemWebLink(specSheetId, itemId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specSheetKeys.detail(variables.specSheetId) });
    },
  });
};
