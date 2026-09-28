const { app, BrowserWindow, ipcMain } = require("electron");
const { chromium } = require("playwright");
const path = require("path");

let editorWindow;
let browser;
let page;
let selectionActive = false;
let waitingForPageChange = false;

function createEditor() {
  editorWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload-editor.js"),
      contextIsolation: true,
    },
  });

  editorWindow.loadFile("editor.html");
}

async function startChrome(url) {
  browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--start-maximized"] });
  page = await browser.newPage({ viewport: null });

  await page.exposeFunction("sendSelectedElement", function (data) {
    waitingForPageChange = true;
    if (editorWindow) editorWindow.webContents.send("element-selected", data);
  });

  await page.exposeFunction("sendPageChange", function (data) {
    if (!waitingForPageChange || !editorWindow) return;
    editorWindow.webContents.send(data.type, data.url);
  });

  await page.addInitScript(() => {
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
      const text = (element.innerText || '').trim().replace(/\s+/g, ' ');
      const classes = Array.from(element.classList || []).filter(Boolean);

      function add(name, xpath) {
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (result.snapshotLength === 1 && result.snapshotItem(0) === element && !list.some((item) => item.xpath === xpath)) {
          list.push({ name, xpath });
        }
      }

      if (id) add('By ID', `//*[@id=${xpathValue(id)}]`);
      classes.forEach((value) => add('By Class', `//${tag}[${classPart(value)}]`));
      if (text && text.length <= 100) add('By Text', `//${tag}[normalize-space(.)=${xpathValue(text)}]`);
      if (id && text && text.length <= 100) add('By ID + Text', `//${tag}[@id=${xpathValue(id)} and normalize-space(.)=${xpathValue(text)}]`);
      classes.forEach((value) => {
        if (id) add('By ID + Class', `//${tag}[@id=${xpathValue(id)} and ${classPart(value)}]`);
        if (text && text.length <= 100) add('By Class + Text', `//${tag}[${classPart(value)} and normalize-space(.)=${xpathValue(text)}]`);
      });
      if (classes.length > 1) add('By Classes', `//${tag}[${classes.map(classPart).join(' and ')}]`);
      ['data-testid', 'data-test', 'name', 'aria-label', 'placeholder', 'title'].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value) add(`By ${attribute}`, `//${tag}[@${attribute}=${xpathValue(value)}]`);
      });
      add('Full Path', getXPath(element));
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
      const path = event.composedPath ? event.composedPath() : [];
      for (const node of path) {
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

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && waitingForPageChange) {
      waitingForPageChange = false;
      editorWindow?.webContents.send("navigation-happened", frame.url());
    }
  });

  page.on("frameattached", (frame) => {
    if (selectionActive) {
      frame.evaluate(() => {
        window.__recorderSelecting = true;
      }).catch(() => {});
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  editorWindow?.webContents.send("page-opened", url);
}

async function selectInEveryFrame() {
  if (!page) return;
  selectionActive = true;

  for (const frame of page.frames()) {
    await frame.evaluate(() => {
      window.__recorderSelecting = true;
    }).catch(() => {});
  }
}

ipcMain.on("open-url", async (_, url) => {
  url = String(url || "").trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  if (!page) {
    await startChrome(url);
  } else {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    editorWindow?.webContents.send("page-opened", url);
  }
});

ipcMain.on("start-selection", selectInEveryFrame);

app.whenReady().then(async () => {
  createEditor();
});

app.on("window-all-closed", () => app.quit());
