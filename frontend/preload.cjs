// frontend/preload.js
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('env', {
  isElectron: true,
})
