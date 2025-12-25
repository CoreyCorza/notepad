const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Remove native menu
Menu.setApplicationMenu(null);

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load config', e);
  }
  return {
    windowBounds: { width: 1000, height: 700 },
    theme: {}
  };
}

function saveConfig(config) {
  try {
    const current = loadConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  } catch (e) {
    console.error('Failed to save config', e);
  }
}

function createWindow() {
  const config = loadConfig();
  const { x, y, width, height } = config.windowBounds;

  const win = new BrowserWindow({
    x, y,
    width, height,
    backgroundColor: '#111111',
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
  });

  // Save window bounds on change
  const updateBounds = () => {
    saveConfig({ windowBounds: win.getBounds() });
  };
  win.on('resize', updateBounds);
  win.on('move', updateBounds);
}

// IPC handlers for config
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-theme-config', (event, theme) => {
  saveConfig({ theme });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for file operations
ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt', 'md', 'js', 'css', 'html', 'json'] }]
  });
  if (canceled) return null;

  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { path: filePaths[0], name: path.basename(filePaths[0]), content };
});

ipcMain.handle('save-file', async (event, content, filePath) => {
  if (!filePath) {
    const { canceled, filePath: newPath } = await dialog.showSaveDialog({
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (canceled) return null;
    filePath = newPath;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return { path: filePath, name: path.basename(filePath) };
});

ipcMain.handle('save-file-as', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (canceled) return null;

  fs.writeFileSync(filePath, content, 'utf-8');
  return { path: filePath, name: path.basename(filePath) };
});

ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});
