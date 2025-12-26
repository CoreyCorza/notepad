const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

Menu.setApplicationMenu(null);

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
let mainWindow = null;
let filesToOpen = [];

// Handle CLI arguments (for "Open with")
function parseArgs(args) {
  const filePath = args.find(arg => {
    return arg !== process.execPath && !arg.startsWith('--') && fs.existsSync(arg) && fs.lstatSync(arg).isFile();
  });
  if (filePath) {
    if (mainWindow) {
      mainWindow.webContents.send('open-external-file', readFile(filePath));
    } else {
      filesToOpen.push(readFile(filePath));
    }
  }
}

function readFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return { path: filePath, name: path.basename(filePath), content };
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) { console.error(e); }
  return { windowBounds: { width: 1000, height: 700 }, theme: {} };
}

function saveConfig(config) {
  try {
    const current = loadConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  } catch (e) { console.error(e); }
}

function createWindow() {
  const config = loadConfig();
  const { x, y, width, height } = config.windowBounds;

  mainWindow = new BrowserWindow({
    x, y, width, height,
    backgroundColor: '#111111',
    icon: path.join(__dirname, '../build/icon.png'),
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // If there were files requested before window was ready
    filesToOpen.forEach(file => {
      mainWindow.webContents.send('open-external-file', file);
    });
    filesToOpen = [];
  });

  mainWindow.on('resize', () => saveConfig({ windowBounds: mainWindow.getBounds() }));
  mainWindow.on('move', () => saveConfig({ windowBounds: mainWindow.getBounds() }));

  // Enable Reload (F5/Ctrl+R) and DevTools (F12/Ctrl+Shift+I) in dev
  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
        mainWindow.reload();
        event.preventDefault();
      }
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      parseArgs(commandLine);
    }
  });

  app.whenReady().then(() => {
    parseArgs(process.argv);
    createWindow();
  });
}

// IPC Handlers
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-theme-config', (e, theme) => saveConfig({ theme }));
ipcMain.handle('save-last-open-files', (e, files) => saveConfig({ lastOpenFiles: files }));
ipcMain.handle('read-file', async (e, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return readFile(filePath);
});

ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt', 'md', 'js', 'css', 'html', 'json'] }]
  });
  if (canceled) return null;
  return readFile(filePaths[0]);
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


ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

