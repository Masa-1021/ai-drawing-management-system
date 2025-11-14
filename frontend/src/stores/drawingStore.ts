/**
 * 図面ストア
 */

import { create } from 'zustand';
import type { Drawing } from '../types/drawing';

interface DrawingState {
  drawings: Drawing[];
  selectedDrawing: Drawing | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setDrawings: (drawings: Drawing[]) => void;
  setSelectedDrawing: (drawing: Drawing | null) => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: number, updates: Partial<Drawing>) => void;
  removeDrawing: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDrawingStore = create<DrawingState>((set) => ({
  drawings: [],
  selectedDrawing: null,
  isLoading: false,
  error: null,

  setDrawings: (drawings) => set({ drawings }),

  setSelectedDrawing: (drawing) => set({ selectedDrawing: drawing }),

  addDrawing: (drawing) =>
    set((state) => ({
      drawings: [drawing, ...state.drawings],
    })),

  updateDrawing: (id, updates) =>
    set((state) => ({
      drawings: state.drawings.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      selectedDrawing:
        state.selectedDrawing?.id === id
          ? { ...state.selectedDrawing, ...updates }
          : state.selectedDrawing,
    })),

  removeDrawing: (id) =>
    set((state) => ({
      drawings: state.drawings.filter((d) => d.id !== id),
      selectedDrawing: state.selectedDrawing?.id === id ? null : state.selectedDrawing,
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
