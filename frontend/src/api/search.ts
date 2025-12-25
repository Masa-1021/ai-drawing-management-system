/**
 * 検索API
 */

import apiClient from './client';
import type { Drawing } from '../types/drawing';

interface SimilaritySearchResult {
  drawing: Drawing;
  similarity_score: number;
  reason: string;
  common_features: string[];
  differences: string[];
}

export const searchApi = {
  /**
   * 自然言語検索
   */
  naturalLanguageSearch: async (query: string): Promise<Drawing[]> => {
    const response = await apiClient.post<Drawing[]>('/v1/search/natural', {
      query,
    });
    return response.data;
  },

  /**
   * 類似図面検索
   */
  similaritySearch: async (
    drawingId: number,
    limit = 10
  ): Promise<SimilaritySearchResult[]> => {
    const response = await apiClient.post<SimilaritySearchResult[]>(
      '/v1/search/similar',
      null,
      {
        params: { drawing_id: drawingId, limit },
      }
    );
    return response.data;
  },
};
