const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  ping: () => "Hello from Electron!",
  chooseFolder: () => ipcRenderer.invoke("choose-folder"),
  restoreFolder: (folderPath) => ipcRenderer.invoke("restore-folder", folderPath),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("write-file", filePath, content),
  createFile: (folderPath, fileName) => ipcRenderer.invoke("create-file", folderPath, fileName),
  deletePath: (targetPath) => ipcRenderer.invoke("delete-path", targetPath),
  refreshFolder: (folderPath) => ipcRenderer.invoke("refresh-folder", folderPath),
  getUsers: () => ipcRenderer.invoke("get-users"),
  getUserVersions: (user) => ipcRenderer.invoke("get-user-versions", user),
  createUser: (user) => ipcRenderer.invoke("create-user", user),
  createUserVersion: (user, version) => ipcRenderer.invoke("create-user-version", user, version),
  getUserFiles: (user, version) => ipcRenderer.invoke("get-user-files", user, version),
  getUserResult: (user, version, fileName) => ipcRenderer.invoke("get-user-result", user, version, fileName),
  getBaseUrl: () => ipcRenderer.invoke("get-base-url"),
  setBaseUrl: (url) => ipcRenderer.invoke("set-base-url", url),
  checkHealth: (url) => ipcRenderer.invoke("check-health", url),
  setZoomFactor: (zoomFactor) => webFrame.setZoomFactor(zoomFactor),
  getZoomFactor: () => webFrame.getZoomFactor(),
  recorderOpenUrl: (url) => ipcRenderer.send("recorder-open-url", url),
  recorderStartSelection: () => ipcRenderer.send("recorder-start-selection"),
  onRecorderElementSelected: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("recorder-element-selected", listener);
    return () => ipcRenderer.removeListener("recorder-element-selected", listener);
  },
  onRecorderPageOpened: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("recorder-page-opened", listener);
    return () => ipcRenderer.removeListener("recorder-page-opened", listener);
  },
  onRecorderNavigationHappened: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("recorder-navigation-happened", listener);
    return () => ipcRenderer.removeListener("recorder-navigation-happened", listener);
  },
  onRecorderContentChanged: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("recorder-content-changed", listener);
    return () => ipcRenderer.removeListener("recorder-content-changed", listener);
  },
});