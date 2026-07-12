import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { MatrixOutput } from '../shared/types'

const api = {
  matrix: {
    getState: () => ipcRenderer.invoke('matrix:get-state'),
    route: (outputId: MatrixOutput['id'], sourceId: string | null) =>
      ipcRenderer.invoke('matrix:route', outputId, sourceId),
    onStateChanged: (callback: (state: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: unknown): void => callback(state)
      ipcRenderer.on('matrix:state-changed', listener)
      return (): void => {
        ipcRenderer.removeListener('matrix:state-changed', listener)
      }
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
