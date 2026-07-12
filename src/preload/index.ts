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
