// src/panel/tabs/image/model.ts
export type imageTabState = {
  loadedImageName: string | null;        // keeps backward compatibility (first image)
  loadedImageNames: string[];            // new
  loadedCount: number;                   // new
  hasImage: boolean;
  lastError?: string;
};

export function createInitialMageTabState(): imageTabState {
  return {
    loadedImageName: null,
    loadedImageNames: [],
    loadedCount: 0,
    hasImage: false,
    lastError: undefined,
  };
}

export function resetMageTabState(state: imageTabState): void {
  state.loadedImageName = null;
  state.loadedImageNames = [];
  state.loadedCount = 0;
  state.hasImage = false;
  state.lastError = undefined;
}