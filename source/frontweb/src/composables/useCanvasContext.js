import { inject } from 'vue'

export const CANVAS_CONTEXT_KEY = Symbol('dramaCanvasContext')

export function useCanvasContext() {
  return inject(CANVAS_CONTEXT_KEY, null)
}
