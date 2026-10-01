const { app, BrowserWindow, Menu } = require("electron");
const { dialog, ipcMain } = require("electron");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Avoids noisy "Unable to move/create cache" Windows errors when nodemon restarts Electron quickly in dev.
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-http-cache");

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

ipcMain.handle("get-user-result", async (_event, user, version, testExecutionId) => {
  if (!user || !version || !testExecutionId) throw new Error("User, version, and execution ID are required");

  const url = `${getBaseUrl()}/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}/${encodeURIComponent(testExecutionId)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`User result API returned ${response.status} for ${url}`);
  return { fileName: `${testExecutionId}.html`, content: await response.text() };
});

ipcMain.handle("get-execution-tags", async (_event, user, version, testExecutionId) => {
  if (!user || !version || !testExecutionId) throw new Error("User, version, and execution ID are required");

  const url = `${getBaseUrl()}/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}/${encodeURIComponent(testExecutionId)}/tags`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.tags) ? data.tags : [];
});

ipcMain.handle("get-trace-viewer", async (_event, user, version, testExecutionId) => {
  if (!user || !version || !testExecutionId) throw new Error("User, version, and execution ID are required");

  const url = `${getBaseUrl()}/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}/${encodeURIComponent(testExecutionId)}/trace/viewer`;

  // The first request for a new session can 500 while Playwright is still starting up;
  // a retry after a short delay reliably picks up the now-active (reused) session.
  const attemptDelaysMs = [0, 1500, 3000];
  let lastError;
  for (const delayMs of attemptDelaysMs) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`Trace viewer API returned ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
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
    let oldOutlinePriority;

    function xpathValue(value) {
      if (!value.includes("'")) return `'${value}'`;
      if (!value.includes('"')) return `"${value}"`;
      return `concat('${value.split("'").join("', \"'\", '")}')`;
    }

    const TEST_ATTRIBUTES = ["data-testid", "data-test", "data-test-id", "data-qa", "data-cy"];
    const STABLE_ATTRIBUTES = [...TEST_ATTRIBUTES, "name", "aria-label", "placeholder", "title", "alt", "for", "role", "href"];
    const ATTRIBUTE_INFO = {
      name: [90, "Form field name - tied to backend, rarely changes."],
      "aria-label": [85, "Accessibility label - meaningful and usually stable."],
      placeholder: [80, "Placeholder text shown inside the field."],
      title: [75, "Tooltip title attribute."],
      alt: [75, "Image alternative text."],
      for: [75, "Label linked to a field id."],
      role: [60, "ARIA role - stable, but often shared by many elements."],
      href: [70, "Link target - stable unless URLs change."],
    };
    const INTERACTIVE = "a,button,input,select,textarea,label,summary,option,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=option]";

    // Clicking an <svg>/<span> inside a button should record the button itself.
    function interactiveTarget(element) {
      return (element && element.closest && element.closest(INTERACTIVE)) || element;
    }

    // Skip framework-generated ids/classes like ":r1:", "ember123", "css-1x2y3z".
    function isStable(value) {
      return Boolean(value) && value.length <= 60 && !/^[:\d]|\d{3,}|^(css|sc|jsx|ng|ember)-/i.test(value);
    }

    function getText(element) {
      return (element.innerText || element.textContent || "").trim().replace(/\s+/g, " ");
    }

    function stablePredicate(element) {
      if (isStable(element.id)) return `@id=${xpathValue(element.id)}`;
      for (const attribute of STABLE_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (isStable(value)) return `@${attribute}=${xpathValue(value)}`;
      }
      return "";
    }

    // Relative path from the nearest ancestor with a stable attribute; indexes only when siblings share the tag.
    function getXPath(element) {
      const parts = [];
      let current = element;
      while (current && current.nodeType === 1 && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();
        const predicate = stablePredicate(current);
        if (predicate) {
          parts.unshift(`${tag}[${predicate}]`);
          return `//${parts.join("/")}`;
        }
        const sameTag = current.parentElement ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName) : [];
        parts.unshift(sameTag.length > 1 ? `${tag}[${sameTag.indexOf(current) + 1}]` : tag);
        current = current.parentElement;
      }
      return `//${parts.join("/")}`;
    }

    function classPart(value) {
      return `contains(@class,${xpathValue(value)})`;
    }

    function evaluate(xpath) {
      try {
        return document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      } catch {
        return null;
      }
    }

    // Cut long text at a word boundary for contains() matching.
    function textSnippet(text) {
      if (text.length <= 40) return text;
      const cut = text.slice(0, 40);
      return cut.slice(0, cut.lastIndexOf(" ") > 15 ? cut.lastIndexOf(" ") : 40).trim();
    }

    function getSuggestions(element) {
      const list = [];
      const tag = element.tagName.toLowerCase();
      const id = isStable(element.id) ? element.id : "";
      const rawText = getText(element);
      const text = rawText.length <= 60 ? rawText : "";
      const classes = Array.from(element.classList || []).filter(isStable);
      const type = element.getAttribute("type");

      // Only keep XPaths that match exactly one node: the selected element.
      function add(name, xpath, why, score) {
        if (list.some((item) => item.xpath === xpath)) return false;
        const result = evaluate(xpath);
        if (result && result.snapshotLength === 1 && result.snapshotItem(0) === element) {
          list.push({ name, xpath, why, score });
          return true;
        }
        return false;
      }

      TEST_ATTRIBUTES.forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (isStable(value)) add(`By ${attribute}`, `//${tag}[@${attribute}=${xpathValue(value)}]`, "Dedicated test attribute - added for automation, most reliable.", 100);
      });

      if (id) add("By ID", `//${tag}[@id=${xpathValue(id)}]`, "Unique element id - stable and fast.", 95);

      Object.entries(ATTRIBUTE_INFO).forEach(([attribute, [score, why]]) => {
        const value = element.getAttribute(attribute);
        if (!isStable(value)) return;
        if (!add(`By ${attribute}`, `//${tag}[@${attribute}=${xpathValue(value)}]`, why, score) && type) {
          add(`By ${attribute} + type`, `//${tag}[@${attribute}=${xpathValue(value)} and @type=${xpathValue(type)}]`, `${why} Combined with type to make it unique.`, score - 5);
        }
      });

      if ((tag === "input") && ["button", "submit", "reset"].includes(type) && element.value) {
        add("By button value", `//input[@type=${xpathValue(type)} and @value=${xpathValue(element.value)}]`, "Button caption stored in the value attribute.", 80);
      }

      const label = element.labels && element.labels[0];
      const labelText = label ? getText(label) : "";
      if (labelText && labelText.length <= 60) {
        const labelPath = `//label[normalize-space()=${xpathValue(labelText)}]`;
        if (label.contains(element)) add("By label", `${labelPath}//${tag}`, "Field found inside its visible label.", 85);
        else add("By label", `${labelPath}/following::${tag}[1]`, "First field after its visible label - matches how users see the form.", 82);
      }

      if (text) add("By text", `//${tag}[normalize-space()=${xpathValue(text)}]`, "Exact visible text (extra whitespace ignored).", 80);
      if (rawText && !text) add("By partial text", `//${tag}[contains(normalize-space(),${xpathValue(textSnippet(rawText))})]`, "Start of long visible text - tolerant to text edits at the end.", 65);

      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body && !stablePredicate(ancestor)) ancestor = ancestor.parentElement;
      if (ancestor && ancestor !== document.body) {
        const scope = `//${ancestor.tagName.toLowerCase()}[${stablePredicate(ancestor)}]`;
        if (text) add("Scoped text", `${scope}//${tag}[normalize-space()=${xpathValue(text)}]`, "Text made unique by searching inside a stable parent.", 75);
        classes.forEach((value) => add("Scoped class", `${scope}//${tag}[${classPart(value)}]`, "Class made unique by searching inside a stable parent.", 62));
        add("Scoped tag", `${scope}//${tag}`, "Only element of this type inside a stable parent.", 58);
      }

      if (text) classes.forEach((value) => add("By class + text", `//${tag}[${classPart(value)} and normalize-space()=${xpathValue(text)}]`, "Class and visible text together.", 70));
      classes.forEach((value) => add("By class", `//${tag}[${classPart(value)}]`, "CSS class - may change with styling updates.", 55));
      if (classes.length > 1) add("By classes", `//${tag}[${classes.slice(0, 2).map(classPart).join(" and ")}]`, "Two CSS classes combined.", 50);

      add("Relative path", getXPath(element), "Structural path from nearest stable parent - breaks if layout changes.", 30);

      if (!list.length) {
        const base = text ? `//${tag}[normalize-space()=${xpathValue(text)}]` : classes[0] ? `//${tag}[${classPart(classes[0])}]` : `//${tag}`;
        const all = evaluate(base);
        for (let i = 0; all && i < all.snapshotLength; i++) {
          if (all.snapshotItem(i) === element) {
            list.push({ name: "By index", xpath: `(${base})[${i + 1}]`, why: "Last resort: position-based, breaks if element order changes.", score: 10 });
            break;
          }
        }
      }
      return list.sort((a, b) => b.score - a.score).slice(0, 8);
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
      if (oldElement) oldElement.style.setProperty("outline", oldOutline, oldOutlinePriority);
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
      const element = interactiveTarget(deepestElementAt(event));
      if (!element || element === oldElement) return;
      clearHover();
      oldElement = element;
      oldOutline = element.style.getPropertyValue("outline");
      oldOutlinePriority = element.style.getPropertyPriority("outline");
      element.style.setProperty("outline", "2px solid #ef4444", "important");
    }, true);

    document.addEventListener("click", (event) => {
      if (!window.__recorderSelecting) return;
      const element = deepestElementAt(event) || event.target;
      window.__recorderSelecting = false;
      clearHover();
      event.preventDefault();
      event.stopPropagation();
      window.sendSelectedElement(elementData(interactiveTarget(element)));

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