import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AutomationCommand,
  DiscoveredNdiSource,
  MatrixOutput,
  NewSourceInput,
  OrchestratorState,
  SceneLayer,
  Source
} from '../shared/types'

interface NdiPreviewFrame {
  width: number
  height: number
  strideBytes: number
  data: Uint8Array
}

const api = {
  matrix: {
    getState: (): Promise<OrchestratorState> => ipcRenderer.invoke('matrix:get-state'),
    route: (outputId: MatrixOutput['id'], sourceId: string | null) =>
      ipcRenderer.invoke('matrix:route', outputId, sourceId),
    onStateChanged: (callback: (state: OrchestratorState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: OrchestratorState): void =>
        callback(state)
      ipcRenderer.on('matrix:state-changed', listener)
      return (): void => {
        ipcRenderer.removeListener('matrix:state-changed', listener)
      }
    }
  },
  automation: {
    execute: (command: AutomationCommand) => ipcRenderer.invoke('automation:execute', command)
  },
  sources: {
    add: (input: NewSourceInput) => ipcRenderer.invoke('sources:add', input),
    update: (id: string, patch: Partial<Omit<Source, 'kind' | 'id'>>) =>
      ipcRenderer.invoke('sources:update', id, patch),
    remove: (id: string) => ipcRenderer.invoke('sources:remove', id)
  },
  scenes: {
    add: (name: string) => ipcRenderer.invoke('scenes:add', name),
    rename: (id: string, name: string) => ipcRenderer.invoke('scenes:rename', id, name),
    remove: (id: string) => ipcRenderer.invoke('scenes:remove', id),
    addLayer: (sceneId: string, sourceId: string) =>
      ipcRenderer.invoke('scenes:layer:add', sceneId, sourceId),
    updateLayer: (
      sceneId: string,
      layerId: string,
      patch: Partial<Omit<SceneLayer, 'id' | 'sourceId'>>
    ) => ipcRenderer.invoke('scenes:layer:update', sceneId, layerId, patch),
    bringLayerToFront: (sceneId: string, layerId: string) =>
      ipcRenderer.invoke('scenes:layer:front', sceneId, layerId),
    removeLayer: (sceneId: string, layerId: string) =>
      ipcRenderer.invoke('scenes:layer:remove', sceneId, layerId)
  },
  discovery: {
    getSources: (): Promise<DiscoveredNdiSource[]> => ipcRenderer.invoke('discovery:get-sources'),
    onChanged: (callback: (sources: DiscoveredNdiSource[]) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, sources: DiscoveredNdiSource[]): void =>
        callback(sources)
      ipcRenderer.on('discovery:changed', listener)
      return (): void => {
        ipcRenderer.removeListener('discovery:changed', listener)
      }
    }
  },
  ndiPreview: {
    start: (sourceId: string, host: string, port: number): Promise<void> =>
      ipcRenderer.invoke('ndi-preview:start', sourceId, host, port),
    stop: (sourceId: string): Promise<void> => ipcRenderer.invoke('ndi-preview:stop', sourceId),
    onFrame: (callback: (sourceId: string, frame: NdiPreviewFrame) => void) => {
      const listener = (
        _e: Electron.IpcRendererEvent,
        sourceId: string,
        frame: NdiPreviewFrame
      ): void => callback(sourceId, frame)
      ipcRenderer.on('ndi-preview:frame', listener)
      return (): void => {
        ipcRenderer.removeListener('ndi-preview:frame', listener)
      }
    }
  },
  ndiOutput: {
    toggle: (name: string): Promise<boolean> => ipcRenderer.invoke('ndi-output:toggle', name),
    isActive: (): Promise<boolean> => ipcRenderer.invoke('ndi-output:is-active'),
    pushFrame: (data: Uint8Array, width: number, height: number): Promise<void> =>
      ipcRenderer.invoke('ndi-output:push-frame', data, width, height)
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
