// src/panel/tabs/image/model.ts
export type imageTabState = {
  loadedImageName: string | null;
  hasImage: boolean;
  lastError?: string;
};

export function createInitialMageTabState(): imageTabState {
  return { loadedImageName: null, hasImage: false, lastError: undefined };
}

export function resetMageTabState(state: imageTabState): void {
  state.loadedImageName = null;
  state.hasImage = false;
  state.lastError = undefined;
}
