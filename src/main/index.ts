import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ndiMatrix } from './services/ndiMatrix'
import { startAutomationApi, stopAutomationApi } from './services/automationApi'
import { startClientHub, stopClientHub } from './services/clientHub'
import type { AutomationCommand, NewSourceInput, Source, SceneLayer } from '../shared/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#15161a',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  ndiMatrix.on('state-changed', (state) => {
    mainWindow.webContents.send('matrix:state-changed', state)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.livemaster.orchestrator')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('matrix:get-state', () => ndiMatrix.getState())
  ipcMain.handle('matrix:route', (_e, outputId: string, sourceId: string | null) =>
    ndiMatrix.route(outputId, sourceId)
  )
  ipcMain.handle('automation:execute', (_e, command: AutomationCommand) =>
    ndiMatrix.executeCommand(command)
  )

  ipcMain.handle('sources:add', (_e, input: NewSourceInput) => ndiMatrix.addSource(input))
  ipcMain.handle('sources:update', (_e, id: string, patch: Partial<Omit<Source, 'kind' | 'id'>>) =>
    ndiMatrix.updateSource(id, patch)
  )
  ipcMain.handle('sources:remove', (_e, id: string) => ndiMatrix.removeSource(id))

  ipcMain.handle('scenes:add', (_e, name: string) => ndiMatrix.addScene(name))
  ipcMain.handle('scenes:rename', (_e, id: string, name: string) => ndiMatrix.renameScene(id, name))
  ipcMain.handle('scenes:remove', (_e, id: string) => ndiMatrix.removeScene(id))
  ipcMain.handle('scenes:layer:add', (_e, sceneId: string, sourceId: string) =>
    ndiMatrix.addLayer(sceneId, sourceId)
  )
  ipcMain.handle(
    'scenes:layer:update',
    (_e, sceneId: string, layerId: string, patch: Partial<Omit<SceneLayer, 'id' | 'sourceId'>>) =>
      ndiMatrix.updateLayer(sceneId, layerId, patch)
  )
  ipcMain.handle('scenes:layer:front', (_e, sceneId: string, layerId: string) =>
    ndiMatrix.bringLayerToFront(sceneId, layerId)
  )
  ipcMain.handle('scenes:layer:remove', (_e, sceneId: string, layerId: string) =>
    ndiMatrix.removeLayer(sceneId, layerId)
  )

  startAutomationApi()
  startClientHub()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopAutomationApi()
  stopClientHub()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
