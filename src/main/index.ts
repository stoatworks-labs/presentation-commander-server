import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ndiMatrix } from './services/ndiMatrix'
import { startAutomationApi, stopAutomationApi } from './services/automationApi'

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
  ipcMain.handle('matrix:route', (_event, outputId: string, sourceId: string | null) =>
    ndiMatrix.route(outputId, sourceId)
  )

  startAutomationApi()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopAutomationApi()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
