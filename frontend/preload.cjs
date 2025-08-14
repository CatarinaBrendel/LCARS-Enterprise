const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('api', {
  // add safe APIs later
});
