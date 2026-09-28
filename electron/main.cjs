const { app, BrowserWindow, Menu } = require("electron");
const { dialog, ipcMain } = require("electron");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const ignoredNames = new Set([".git", "node_modules", "dist", "build"]);
const selectedRoots = new Set();

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readAppConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeAppConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

// Team Setup tile lets each user override this; falls back to .env (PORT) if never set.
function getBaseUrl() {
  const saved = readAppConfig().baseUrl;
  if (saved) return saved;
  return process.env.BASE_URL || `http://localhost:${process.env.PORT || 7000}`;
}

ipcMain.handle("get-base-url", () => getBaseUrl());

ipcMain.handle("set-base-url", (_event, url) => {
  const trimmed = String(url || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Base URL is required");
  writeAppConfig({ ...readAppConfig(), baseUrl: trimmed });
  return trimmed;
});

// Runs in the main process (Node fetch) so it isn't blocked by browser CORS rules.
ipcMain.handle("check-health", async (_event, url) => {
  const target = String(url || getBaseUrl()).trim().replace(/\/+$/, "");
  if (!target) return { ok: false, error: "Base URL is required" };
  try {
    const response = await fetch(`${target}/api/health`);
    if (!response.ok) return { ok: false, error: `Server responded with status ${response.status}` };
    const data = await response.json().catch(() => ({}));
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: `Could not reach ${target}. Check the host, port, and that the backend is running.` };
  }
});

let mainWindow;
let recorderBrowser;
let recorderPage;
let recorderSelectionActive = false;
let recorderWaitingForPageChange = false;

ipcMain.handle("get-users", async () => {
  const response = await fetch(`${getBaseUrl()}/api/users`);
  if (!response.ok) throw new Error(`Users API returned ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.users) ? data.users : [];
});

ipcMain.handle("get-user-versions", async (_event, user) => {
  if (!user) throw new Error("User is required");

  const response = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(user)}/versions`);
  if (!response.ok) throw new Error(`User versions API returned ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.versions)) throw new Error("User versions API returned an invalid response");
  return data.versions;
});

ipcMain.handle("create-user", async (_event, user) => {
  if (!user) throw new Error("User is required");

  const response = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(user)}`, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Create user API returned ${response.status}`);
  return data;
});

ipcMain.handle("create-user-version", async (_event, user, version) => {
  if (!user || !version) throw new Error("User and version are required");

  const response = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}`, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Create version API returned ${response.status}`);
  return data;
});

ipcMain.handle("get-user-folders", async (_event, user, version) => {
  if (!user || !version) throw new Error("User and version are required");

  const response = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}/folders`);
  if (!response.ok) throw new Error(`User folders API returned ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.folders) ? data.folders : [];
});

ipcMain.handle("get-user-result", async (_event, user, version, testExecutionId, fileName) => {
  if (!user || !version || !testExecutionId || !fileName) throw new Error("User, version, execution ID, and file name are required");

  const response = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}/${encodeURIComponent(testExecutionId)}/${encodeURIComponent(fileName)}`);
  if (!response.ok) throw new Error(`User result API returned ${response.status}`);
  return response.text();
});

function readFolderTree(folderPath, depth = 0) {
  if (depth > 3) return [];

  return fs.readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => !ignoredNames.has(entry.name) && !entry.name.startsWith("."))
    .sort((first, second) => {
      if (first.isDirectory() !== second.isDirectory()) return first.isDirectory() ? -1 : 1;
      return first.name.localeCompare(second.name);
    })
    .map((entry) => {
      const entryPath = path.join(folderPath, entry.name);
      return {
        name: entry.name,
        type: entry.isDirectory() ? "folder" : "file",
        path: entryPath,
        children: entry.isDirectory() ? readFolderTree(entryPath, depth + 1) : [],
      };
    });
}

ipcMain.handle("choose-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;

  const folderPath = result.filePaths[0];
  selectedRoots.add(path.resolve(folderPath));
  return {
    name: path.basename(folderPath),
    path: folderPath,
    children: readFolderTree(folderPath),
  };
});

function isAllowedPath(filePath) {
  const resolvedPath = path.resolve(filePath);
  return [...selectedRoots].some((rootPath) => resolvedPath === rootPath || resolvedPath.startsWith(`${rootPath}${path.sep}`));
}

ipcMain.handle("read-file", async (_event, filePath) => {
  if (!isAllowedPath(filePath)) throw new Error("File is outside the selected workspace");
  return fs.readFileSync(filePath, "utf8");
});

ipcMain.handle("write-file", async (_event, filePath, content) => {
  if (!isAllowedPath(filePath)) throw new Error("File is outside the selected workspace");
  fs.writeFileSync(filePath, content, "utf8");
  return true;
});

ipcMain.handle("create-file", async (_event, folderPath, fileName) => {
  if (!isAllowedPath(folderPath) || !fileName || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("Invalid file location");
  }

  const filePath = path.join(folderPath, fileName);
  if (fs.existsSync(filePath)) throw new Error("A file with that name already exists");
  fs.writeFileSync(filePath, "", "utf8");
  return { name: fileName, type: "file", path: filePath, children: [] };
});

ipcMain.handle("delete-path", async (_event, targetPath) => {
  if (!isAllowedPath(targetPath)) throw new Error("Path is outside the selected workspace");
  const resolvedPath = path.resolve(targetPath);
  if ([...selectedRoots].some((rootPath) => rootPath === resolvedPath)) {
    throw new Error("The opened workspace cannot be deleted");
  }
  fs.rmSync(resolvedPath, { recursive: true, force: false });
  return true;
});

ipcMain.handle("refresh-folder", async (_event, folderPath) => {
  if (!isAllowedPath(folderPath) || !fs.existsSync(folderPath)) return null;
  return { name: path.basename(folderPath), path: folderPath, children: readFolderTree(folderPath) };
});

async function startRecorderChrome(url) {
  recorderBrowser = await chromium.launch({ channel: "chrome", headless: false, args: ["--start-maximized"] });
  recorderPage = await recorderBrowser.newPage({ viewport: null });

  recorderBrowser.on("disconnected", () => {
    recorderBrowser = null;
    recorderPage = null;
    recorderSelectionActive = false;
    recorderWaitingForPageChange = false;
  });

  await recorderPage.exposeFunction("sendSelectedElement", (data) => {
    recorderWaitingForPageChange = true;
    mainWindow?.webContents.send("recorder-element-selected", data);
  });

  await recorderPage.exposeFunction("sendPageChange", (data) => {
    if (!recorderWaitingForPageChange || !mainWindow) return;
    mainWindow.webContents.send(`recorder-${data.type}`, data.url);
  });

  await recorderPage.addInitScript(() => {
    window.__recorderSelecting = false;
    let oldElement;
    let oldOutline;

    function xpathValue(value) {
      if (!value.includes("'")) return `'${value}'`;
      if (!value.includes('"')) return `"${value}"`;
      return `concat('${value.split("'").join("', \"'\", '")}')`;
    }

    function getXPath(element) {
      const id = element.id;
      if (id) return `//*[@id=${xpathValue(id)}]`;

      const parts = [];
      let current = element;
      while (current && current.nodeType === 1) {
        let position = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === current.tagName) position++;
          sibling = sibling.previousElementSibling;
        }
        parts.unshift(`${current.tagName.toLowerCase()}[${position}]`);
        current = current.parentElement;
      }
      return `/${parts.join("/")}`;
    }

    function classPart(value) {
      return `contains(concat(' ', normalize-space(@class), ' '), ${xpathValue(` ${value} `)})`;
    }

    function getSuggestions(element) {
      const list = [];
      const tag = element.tagName.toLowerCase();
      const id = element.id;
      const text = (element.innerText || "").trim().replace(/\s+/g, " ");
      const classes = Array.from(element.classList || []).filter(Boolean);

      function add(name, xpath) {
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (result.snapshotLength === 1 && result.snapshotItem(0) === element && !list.some((item) => item.xpath === xpath)) {
          list.push({ name, xpath });
        }
      }

      if (id) add("By ID", `//*[@id=${xpathValue(id)}]`);
      classes.forEach((value) => add("By Class", `//${tag}[${classPart(value)}]`));
      if (text && text.length <= 100) add("By Text", `//${tag}[normalize-space(.)=${xpathValue(text)}]`);
      if (id && text && text.length <= 100) add("By ID + Text", `//${tag}[@id=${xpathValue(id)} and normalize-space(.)=${xpathValue(text)}]`);
      classes.forEach((value) => {
        if (id) add("By ID + Class", `//${tag}[@id=${xpathValue(id)} and ${classPart(value)}]`);
        if (text && text.length <= 100) add("By Class + Text", `//${tag}[${classPart(value)} and normalize-space(.)=${xpathValue(text)}]`);
      });
      if (classes.length > 1) add("By Classes", `//${tag}[${classes.map(classPart).join(" and ")}]`);
      ["data-testid", "data-test", "name", "aria-label", "placeholder", "title"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value) add(`By ${attribute}`, `//${tag}[@${attribute}=${xpathValue(value)}]`);
      });
      add("Full Path", getXPath(element));
      return list;
    }

    function elementData(element) {
      return {
        tagName: element.tagName,
        xpath: getXPath(element),
        xpathSuggestions: getSuggestions(element),
        text: (element.innerText || "").trim().replace(/\s+/g, " ").slice(0, 100),
        id: element.id || "",
        css: element.id ? `#${CSS.escape(element.id)}` : element.tagName.toLowerCase(),
        label: element.labels && element.labels[0] ? element.labels[0].innerText.trim() : element.getAttribute("aria-label") || "",
        name: element.getAttribute("name") || "",
        placeholder: element.getAttribute("placeholder") || "",
        testId: element.getAttribute("data-testid") || "",
      };
    }

    function clearHover() {
      if (oldElement) oldElement.style.outline = oldOutline;
      oldElement = null;
    }

    function deepestElementAt(event) {
      const eventPath = event.composedPath ? event.composedPath() : [];
      for (const node of eventPath) {
        if (node && node.nodeType === 1) return node;
      }
      return event.target && event.target.nodeType === 1 ? event.target : null;
    }

    document.addEventListener("mousemove", (event) => {
      if (!window.__recorderSelecting) return;
      const element = deepestElementAt(event);
      if (!element || element === oldElement) return;
      clearHover();
      oldElement = element;
      oldOutline = element.style.outline;
      element.style.outline = "2px solid #ef4444";
    }, true);

    document.addEventListener("click", (event) => {
      if (!window.__recorderSelecting) return;
      const element = deepestElementAt(event) || event.target;
      window.__recorderSelecting = false;
      clearHover();
      event.preventDefault();
      event.stopPropagation();
      window.sendSelectedElement(elementData(element));

      const observer = new MutationObserver(() => {
        window.sendPageChange({ type: "content-changed", url: window.location.href });
        observer.disconnect();
      });
      if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      setTimeout(() => element.click(), 0);
    }, true);
  });

  recorderPage.on("framenavigated", (frame) => {
    if (frame === recorderPage.mainFrame() && recorderWaitingForPageChange) {
      recorderWaitingForPageChange = false;
      mainWindow?.webContents.send("recorder-navigation-happened", frame.url());
    }
  });

  recorderPage.on("frameattached", (frame) => {
    if (recorderSelectionActive) {
      frame.evaluate(() => {
        window.__recorderSelecting = true;
      }).catch(() => {});
    }
  });

  await recorderPage.goto(url, { waitUntil: "domcontentloaded" });
  mainWindow?.webContents.send("recorder-page-opened", url);
}

async function selectInEveryRecorderFrame() {
  if (!recorderPage) return;
  recorderSelectionActive = true;

  for (const frame of recorderPage.frames()) {
    await frame.evaluate(() => {
      window.__recorderSelecting = true;
    }).catch(() => {});
  }
}

ipcMain.on("recorder-open-url", async (_event, rawUrl) => {
  let url = String(rawUrl || "").trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  if (!recorderPage) {
    await startRecorderChrome(url);
    return;
  }

  try {
    await recorderPage.goto(url, { waitUntil: "domcontentloaded" });
    mainWindow?.webContents.send("recorder-page-opened", url);
  } catch {
    recorderBrowser = null;
    recorderPage = null;
    recorderSelectionActive = false;
    recorderWaitingForPageChange = false;
    await startRecorderChrome(url);
  }
});

ipcMain.on("recorder-start-selection", selectInEveryRecorderFrame);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "..", "public", "logo.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("restore-folder", async (_event, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return null;
  const resolvedPath = path.resolve(folderPath);
  selectedRoots.add(resolvedPath);
  return { name: path.basename(resolvedPath), path: resolvedPath, children: readFolderTree(resolvedPath) };
});