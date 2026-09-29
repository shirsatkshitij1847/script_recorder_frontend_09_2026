import { useEffect, useRef, useState } from "react";
import "./App.css";
import AboutPage from "./components/AboutPage";
import DashboardPage from "./components/DashboardPage";
import EditorPage from "./components/EditorPage";
import HomePage from "./components/HomePage";
import NavigationBar from "./components/NavigationBar";
import ResultViewer from "./components/ResultViewer";
import ScriptRecorderPage from "./components/ScriptRecorderPage";
import SplashScreen from "./components/SplashScreen";
import TeamSetupPage from "./components/TeamSetupPage";
import WorkspaceSetupPage from "./components/WorkspaceSetupPage";

const minZoom = 0.8;
const maxZoom = 1.5;
const zoomStep = 0.1;
const splashDuration = 5000;

const initialContent = `# Welcome to your workspace

Build something thoughtful today. Write your ideas here and switch to Result to see a clean preview.

## A focused place to create

Use the editor for notes, drafts, and documentation. Your content stays ready while you move between views.`;

const initialRecorderScript = `const { test, expect } = require('@playwright/test');

test('recorded script', async ({ page }) => {
  await page.goto('');

});
`;

function escapeRecorderText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function clampZoom(value) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function getPageFromHash() {
  if (window.location.hash === "#/home") return "home";
  if (window.location.hash === "#/about") return "about";
  if (window.location.hash === "#/setup") return "setup";
  if (window.location.hash === "#/results") return "results";
  if (window.location.hash === "#/editor") return "editor";
  if (window.location.hash === "#/result") return "result";
  if (window.location.hash === "#/recorder") return "recorder";
  if (window.location.hash === "#/teamsetup") return "teamsetup";
  return "home";
}

function findFile(tree, filePath) {
  for (const node of tree.children || []) {
    if (node.path === filePath) return node;
    if (node.type === "folder") {
      const match = findFile(node, filePath);
      if (match) return match;
    }
  }
  return null;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activePage, setActivePage] = useState(getPageFromHash);
  const [selectedUser, setSelectedUser] = useState(() => window.localStorage.getItem("loadtest-user") || "");
  const [selectedVersion, setSelectedVersion] = useState(() => window.localStorage.getItem("loadtest-version") || "");
  const [selectedResult, setSelectedResult] = useState(null);
  const [content, setContent] = useState(initialContent);
  const [folder, setFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [editorContent, setEditorContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [treeVersion, setTreeVersion] = useState(0);
  const [appZoom, setAppZoom] = useState(() => clampZoom(Number(window.localStorage.getItem("loadtest-app-zoom")) || 1));
  const [recorderUrl, setRecorderUrl] = useState("");
  const [recorderCode, setRecorderCode] = useState(initialRecorderScript);
  const [recorderChooser, setRecorderChooser] = useState(null);
  const [isRecorderSelecting, setIsRecorderSelecting] = useState(false);
  const recorderFirstUrlRef = useRef(true);
  const recorderPendingCommentRef = useRef("");

  const changeAppZoom = (delta) => {
    setAppZoom((currentZoom) => clampZoom(Number((currentZoom + delta).toFixed(2))));
  };

  const resetAppZoom = () => setAppZoom(1);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), splashDuration);
    return () => window.clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) window.location.hash = "#/home";
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const savedFolderPath = window.localStorage.getItem("loadtest-folder-path");
    const savedDraft = window.localStorage.getItem("loadtest-editor-draft");
    if (savedDraft !== null) {
      setEditorContent(savedDraft);
      setContent(savedDraft);
    }

    if (savedFolderPath && window.electronAPI?.restoreFolder) {
      window.electronAPI.restoreFolder(savedFolderPath).then((restoredFolder) => {
        if (!restoredFolder) return;
        setFolder(restoredFolder);
        const savedFilePath = window.localStorage.getItem("loadtest-file-path");
        const restoredFile = savedFilePath ? findFile(restoredFolder, savedFilePath) : null;
        if (!restoredFile) return;
        setSelectedFile(restoredFile);
        setOpenFiles([restoredFile]);
        if (savedDraft === null && window.electronAPI?.readFile) {
          window.electronAPI.readFile(restoredFile.path).then((fileContent) => {
            setEditorContent(fileContent);
            setContent(fileContent);
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (folder?.path) window.localStorage.setItem("loadtest-folder-path", folder.path);
    if (selectedFile?.path) window.localStorage.setItem("loadtest-file-path", selectedFile.path);
    else window.localStorage.removeItem("loadtest-file-path");
    window.localStorage.setItem("loadtest-editor-draft", editorContent);
  }, [folder, selectedFile, editorContent]);

  useEffect(() => {
    if (selectedUser) window.localStorage.setItem("loadtest-user", selectedUser);
    else window.localStorage.removeItem("loadtest-user");
  }, [selectedUser]);

  useEffect(() => {
    if (selectedVersion) window.localStorage.setItem("loadtest-version", selectedVersion);
    else window.localStorage.removeItem("loadtest-version");
  }, [selectedVersion]);

  useEffect(() => {
    window.localStorage.setItem("loadtest-app-zoom", String(appZoom));
    if (window.electronAPI?.setZoomFactor) {
      window.electronAPI.setZoomFactor(appZoom);
      return;
    }
    document.documentElement.style.zoom = appZoom;
  }, [appZoom]);

  useEffect(() => {
    const handleZoomShortcut = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (["+", "="].includes(event.key)) {
        event.preventDefault();
        changeAppZoom(zoomStep);
      } else if (["-", "_"].includes(event.key)) {
        event.preventDefault();
        changeAppZoom(-zoomStep);
      } else if (event.key === "0") {
        event.preventDefault();
        resetAppZoom();
      }
    };
    window.addEventListener("keydown", handleZoomShortcut);
    return () => window.removeEventListener("keydown", handleZoomShortcut);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;

    const addRecorderPageUrl = (pageUrl) => {
      if (!recorderFirstUrlRef.current) return;
      recorderFirstUrlRef.current = false;

      setRecorderCode((currentCode) => {
        const lines = currentCode.split("\n");
        const index = lines.findIndex((line) => line.trim().startsWith("await page.goto("));
        if (index >= 0) lines[index] = `  await page.goto('${escapeRecorderText(pageUrl)}');`;
        return lines.join("\n");
      });
    };

    const addRecorderComment = (text) => {
      recorderPendingCommentRef.current = `    // ${text}\n\n`;
    };

    const unsubscribers = [
      api.onRecorderElementSelected?.((data) => { setIsRecorderSelecting(false); setRecorderChooser({ step: "locator", data }); }),
      api.onRecorderPageOpened?.((pageUrl) => addRecorderPageUrl(pageUrl)),
      api.onRecorderNavigationHappened?.((navUrl) => addRecorderComment(`Navigation happened after this step: ${navUrl}`)),
      api.onRecorderContentChanged?.((changedUrl) => addRecorderComment(`Page content changed after this step: ${changedUrl}`)),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, []);

  const navigate = (page) => {
    setActivePage(page);
    window.location.hash = `#/${page}`;
  };

  const openRecorderUrl = () => {
    const value = recorderUrl.trim();
    if (!value) return;
    window.electronAPI?.recorderOpenUrl(value);
  };

  const startRecorderSelection = () => {
    setIsRecorderSelecting(true);
    window.electronAPI?.recorderStartSelection();
  };

  const chooseRecorderLocator = (locator) => {
    setRecorderChooser((current) => ({ step: "action", data: current.data, locator }));
  };

  const chooseRecorderAction = (action) => {
    const comment = recorderPendingCommentRef.current;
    recorderPendingCommentRef.current = "";

    setRecorderCode((currentCode) => {
      const position = currentCode.lastIndexOf("});");
      const snippet = `    await ${action};\n\n${comment}`;
      return position < 0 ? currentCode + snippet : currentCode.slice(0, position) + snippet + currentCode.slice(position);
    });
    setRecorderChooser(null);
  };

  const changeSelectedUser = (user) => {
    setSelectedUser(user);
    setSelectedVersion("");
    setSelectedResult(null);
    if (activePage === "result") navigate("results");
  };

  const changeSelectedVersion = (version) => {
    setSelectedVersion(version);
    setSelectedResult(null);
    if (activePage === "result") navigate("results");
  };

  const openResult = (testExecutionId) => {
    setSelectedResult({ user: selectedUser, version: selectedVersion, testExecutionId });
    navigate("result");
  };

  if (showSplash) return <SplashScreen />;

  return (
    <div className={`app-shell ${activePage === "editor" ? "editor-shell" : "dashboard-shell"}`}>
      <NavigationBar activePage={activePage} onNavigate={navigate} appZoom={appZoom} onZoomIn={() => changeAppZoom(zoomStep)} onZoomOut={() => changeAppZoom(-zoomStep)} onZoomReset={resetAppZoom} />
      <main className="page-content">
        {activePage === "home" ? (
          <HomePage selectedUser={selectedUser} selectedVersion={selectedVersion} onSelectedUserChange={changeSelectedUser} onSelectedVersionChange={changeSelectedVersion} onNavigate={navigate} />
        ) : activePage === "about" ? (
          <AboutPage onNavigate={navigate} />
        ) : activePage === "teamsetup" ? (
          <TeamSetupPage onNavigate={navigate} />
        ) : activePage === "setup" ? (
          <WorkspaceSetupPage selectedUser={selectedUser} selectedVersion={selectedVersion} onSelectedUserChange={changeSelectedUser} onSelectedVersionChange={changeSelectedVersion} onNavigate={navigate} />
        ) : activePage === "dashboard" || activePage === "results" ? (
          <DashboardPage selectedUser={selectedUser} version={selectedVersion} onSelectedUserChange={changeSelectedUser} onSelectedVersionChange={changeSelectedVersion} onOpenResult={openResult} />
        ) : activePage === "result" && selectedResult ? (
          <ResultViewer result={selectedResult} onBack={() => navigate("results")} />
        ) : activePage === "recorder" ? (
          <ScriptRecorderPage
            url={recorderUrl}
            onUrlChange={setRecorderUrl}
            code={recorderCode}
            onCodeChange={setRecorderCode}
            chooser={recorderChooser}
            onChooseLocator={chooseRecorderLocator}
            onChooseAction={chooseRecorderAction}
            onCloseChooser={() => setRecorderChooser(null)}
            isSelecting={isRecorderSelecting}
            onOpenUrl={openRecorderUrl}
            onStartSelection={startRecorderSelection}
          />
        ) : (
          <EditorPage
            content={content}
            editorContent={editorContent}
            folder={folder}
            selectedFile={selectedFile}
            openFiles={openFiles}
            isDirty={isDirty}
            treeVersion={treeVersion}
            onContentChange={(nextContent) => { setContent(nextContent); setEditorContent(nextContent); }}
            onEditorContentChange={setEditorContent}
            onFolderChange={setFolder}
            onSelectedFileChange={setSelectedFile}
            onOpenFilesChange={setOpenFiles}
            onDirtyChange={setIsDirty}
            onTreeChange={() => setTreeVersion((version) => version + 1)}
            onBackToDashboard={() => navigate("dashboard")}
            onViewResult={() => navigate("dashboard")}
            appZoom={appZoom}
            onZoomIn={() => changeAppZoom(zoomStep)}
            onZoomOut={() => changeAppZoom(-zoomStep)}
            onZoomReset={resetAppZoom}
          />
        )}
      </main>
      <footer className="app-footer">
        <span className="status-dot" />
        <span>All changes saved locally</span>
        <span className="footer-divider" />
        <span>MES workspace</span>
      </footer>
    </div>
  );
}

export default App;