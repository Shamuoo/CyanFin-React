'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  version:      () => ipcRenderer.invoke('app-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  dataDir:      () => ipcRenderer.invoke('data-dir'),
  minimize:     () => ipcRenderer.invoke('minimize'),
  maximize:     () => ipcRenderer.invoke('maximize'),
  close:        () => ipcRenderer.invoke('close'),
  isElectron:   true,
});
