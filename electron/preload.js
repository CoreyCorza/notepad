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
    saveLastOpenFiles: (files) => ipcRenderer.invoke('save-last-open-files', files),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    getFilePath: (file) => require('electron').webUtils.getPathForFile(file),
    onExternalFileOpen: (callback) => ipcRenderer.on('open-external-file', (event, file) => callback(file)),
});
