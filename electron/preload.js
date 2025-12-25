const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('open-file'),
    saveFile: (content, filePath) => ipcRenderer.invoke('save-file', content, filePath),
    saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveThemeConfig: (theme) => ipcRenderer.invoke('save-theme-config', theme),
});
