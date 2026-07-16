const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("orion", {
  videos: {
    mediaUrl: (filePath) => ipcRenderer.invoke("videos:mediaUrl", filePath),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (payload) => ipcRenderer.invoke("settings:set", payload),
  },
  chat: {
    send: (payload) => ipcRenderer.invoke("chat:send", payload),
    pickMedia: () => ipcRenderer.invoke("chat:pickMedia"),
    analyzeMedia: (payload) => ipcRenderer.invoke("chat:analyzeMedia", payload),
  },
  memory: {
    get: (key) => ipcRenderer.invoke("memory:get", key),
    set: (payload) => ipcRenderer.invoke("memory:set", payload),
    clear: (key) => ipcRenderer.invoke("memory:clear", key),
  },
  inbox: {
    list: () => ipcRenderer.invoke("inbox:list"),
    get: (payload) => ipcRenderer.invoke("inbox:get", payload),
    sync: () => ipcRenderer.invoke("inbox:sync"),
    onSyncProgress: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("inbox:syncProgress", handler);
      return () => ipcRenderer.removeListener("inbox:syncProgress", handler);
    },
    create: (payload) => ipcRenderer.invoke("inbox:create", payload),
    addMessage: (payload) => ipcRenderer.invoke("inbox:addMessage", payload),
    markRead: (payload) => ipcRenderer.invoke("inbox:markRead", payload),
    analyze: (payload) => ipcRenderer.invoke("inbox:analyze", payload),
    send: (payload) => ipcRenderer.invoke("inbox:send", payload),
    delete: (payload) => ipcRenderer.invoke("inbox:delete", payload),
  },
  persona: {
    getFilePath: (file) => webUtils.getPathForFile(file),
    pickFolder: () => ipcRenderer.invoke("persona:pickFolder"),
    inspectFolder: (folderPath) =>
      ipcRenderer.invoke("persona:inspectFolder", folderPath),
    generate: (folderPath) =>
      ipcRenderer.invoke("persona:generate", { folderPath }),
  },
});
