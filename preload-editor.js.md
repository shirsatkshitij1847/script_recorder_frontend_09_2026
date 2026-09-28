const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("recorderAPI", {
  openUrl(url) {
    ipcRenderer.send("open-url", url);
  },

  startSelection() {
    ipcRenderer.send("start-selection");
  },

  onElementSelected(callback) {
    ipcRenderer.on("element-selected", (_, data) => callback(data));
  },

  onPageOpened(callback) {
    ipcRenderer.on("page-opened", (_, url) => callback(url));
  },

  onNavigationHappened(callback) {
    ipcRenderer.on("navigation-happened", (_, url) => callback(url));
  },

  onContentChanged(callback) {
    ipcRenderer.on("content-changed", (_, url) => callback(url));
  },
});