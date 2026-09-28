import { useEffect, useState } from "react";
import CodeEditor from "./CodeEditor";
import FileTree from "./FileTree";

function getFileKind(fileName = "") {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (["js", "jsx", "ts", "tsx"].includes(extension)) return "javascript";
  if (["css", "scss", "less"].includes(extension)) return "stylesheet";
  if (["html", "htm"].includes(extension)) return "markup";
  if (["json", "yaml", "yml"].includes(extension)) return "data";
  if (["md", "txt"].includes(extension)) return "text";
  return "file";
}

function EditorPage({ editorContent, folder, selectedFile, openFiles, isDirty, treeVersion, onContentChange, onEditorContentChange, onFolderChange, onSelectedFileChange, onOpenFilesChange, onDirtyChange, onTreeChange, onBackToDashboard, appZoom, onZoomIn, onZoomOut, onZoomReset }) {
  const [contextMenu, setContextMenu] = useState(null);
  const [newFileTarget, setNewFileTarget] = useState(null);
  const [newFileName, setNewFileName] = useState("untitled.js");
  const [isEditorMaximized, setIsEditorMaximized] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(window.localStorage.getItem("loadtest-sidebar-width")) || 250);

  const startSidebarResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let currentWidth = startWidth;
    const handlePointerMove = (moveEvent) => {
      const nextWidth = Math.min(440, Math.max(190, startWidth + moveEvent.clientX - startX));
      currentWidth = nextWidth;
      setSidebarWidth(nextWidth);
    };
    const stopSidebarResize = () => {
      window.localStorage.setItem("loadtest-sidebar-width", String(currentWidth));
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopSidebarResize);
      document.body.classList.remove("resizing-sidebar");
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopSidebarResize);
    document.body.classList.add("resizing-sidebar");
  };

  const chooseFolder = async () => {
    if (!window.electronAPI?.chooseFolder) return;
    const selectedFolder = await window.electronAPI.chooseFolder();
    if (selectedFolder) {
      onFolderChange(selectedFolder);
      onSelectedFileChange(null);
      onOpenFilesChange([]);
      onEditorContentChange("");
      onDirtyChange(false);
    }
  };

  const selectFile = async (file) => {
    if (!window.electronAPI?.readFile) return;
    try {
      const fileContent = await window.electronAPI.readFile(file.path);
      onSelectedFileChange(file);
      onOpenFilesChange((currentFiles) => currentFiles.some((openFile) => openFile.path === file.path) ? currentFiles : [...currentFiles, file]);
      onEditorContentChange(fileContent);
      onContentChange(fileContent);
      onDirtyChange(false);
    } catch (error) {
      window.alert(`Unable to open ${file.name}: ${error.message}`);
    }
  };

  const closeFile = async (file, event) => {
    event?.stopPropagation();
    const remainingFiles = openFiles.filter((openFile) => openFile.path !== file.path);
    onOpenFilesChange(remainingFiles);

    if (selectedFile?.path !== file.path) return;
    const nextFile = remainingFiles[remainingFiles.length - 1];
    if (nextFile) {
      await selectFile(nextFile);
      return;
    }

    onSelectedFileChange(null);
    onEditorContentChange("");
    onContentChange("");
    onDirtyChange(false);
  };

  const saveFile = async () => {
    if (!selectedFile || !window.electronAPI?.writeFile) return;
    try {
      await window.electronAPI.writeFile(selectedFile.path, editorContent);
      onDirtyChange(false);
      onContentChange(editorContent);
    } catch (error) {
      window.alert(`Unable to save ${selectedFile.name}: ${error.message}`);
    }
  };

  const openNewFileDialog = (targetFolder = folder) => {
    setContextMenu(null);
    if (!targetFolder || !window.electronAPI?.createFile) {
      window.alert("Choose a folder first");
      return;
    }

    setNewFileName("untitled.js");
    setNewFileTarget(typeof targetFolder === "string" ? targetFolder : targetFolder.path);
  };

  const createFile = async (event) => {
    event?.preventDefault();
    const targetPath = newFileTarget;
    const trimmedName = newFileName.trim();
    if (!targetPath || !trimmedName) return;

    try {
      const newFile = await window.electronAPI.createFile(targetPath, trimmedName);
      const refreshedFolder = await window.electronAPI.refreshFolder(folder.path);
      if (refreshedFolder) {
        onFolderChange(refreshedFolder);
      }
      onTreeChange();
      setNewFileTarget(null);
      await selectFile(newFile);
    } catch (error) {
      window.alert(`Unable to create file: ${error.message}`);
    }
  };

  const deleteNode = async (node) => {
    if (!window.electronAPI?.deletePath) return;
    const confirmed = window.confirm(`Delete ${node.type === "folder" ? "folder" : "file"} "${node.name}"?`);
    if (!confirmed) return;
    try {
      await window.electronAPI.deletePath(node.path);
      const refreshedFolder = await window.electronAPI.refreshFolder(folder.path);
      if (refreshedFolder) onFolderChange(refreshedFolder);
      onOpenFilesChange((currentFiles) => currentFiles.filter((openFile) => openFile.path !== node.path && !openFile.path.startsWith(`${node.path}\\`)));
      if (selectedFile?.path === node.path || selectedFile?.path.startsWith(`${node.path}\\`)) {
        onSelectedFileChange(null);
        onEditorContentChange("");
        onDirtyChange(false);
      }
      onTreeChange();
      setContextMenu(null);
    } catch (error) {
      window.alert(`Unable to delete ${node.name}: ${error.message}`);
    }
  };

  useEffect(() => {
    const handleSaveShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("click", closeContextMenu);
    return () => {
      window.removeEventListener("keydown", handleSaveShortcut);
      window.removeEventListener("click", closeContextMenu);
    };
  });

  return (
    <section className="full-editor-page">
      <div className="editor-workbench">
        <div
          className={`editor-layout ${isEditorMaximized ? "editor-layout-maximized" : ""}`}
          style={{ "--editor-sidebar-width": `${sidebarWidth}px` }}
        >
        <aside className="editor-sidebar">
          <div className="sidebar-topline">
            <div className="sidebar-label">Explorer</div>
            <div className="explorer-actions">
              <button className="folder-button" onClick={() => openNewFileDialog()} title="Create a new file">+ File</button>
              <button className="folder-button" onClick={chooseFolder} title="Choose a folder">Open</button>
            </div>
          </div>
          {folder ? <div className="folder-path" title={folder.path}>{folder.path}</div> : null}
          <FileTree root={folder} onSelectFile={selectFile} onContextMenu={(node) => setContextMenu(node)} refreshKey={treeVersion} />
          {selectedFile ? <div className="selected-path" title={selectedFile.path}>Selected: {selectedFile.name}</div> : null}
        </aside>
        <div className="sidebar-resizer" onPointerDown={startSidebarResize} role="separator" aria-label="Resize explorer" aria-orientation="vertical" />

        <div className="editor-card">
          <div className="editor-tabs" role="tablist" aria-label="Open files">
            {openFiles.map((file) => (
              <button key={file.path} className={`editor-tab ${getFileKind(file.name)} ${selectedFile?.path === file.path ? "active" : ""}`} onClick={() => selectFile(file)}>
                <span className="tab-file-icon">{file.name.split(".").pop()?.slice(0, 1).toUpperCase() || "F"}</span>
                <span className="tab-file-name">{file.name}</span>
                <span className="tab-close" onClick={(event) => closeFile(file, event)} aria-label={`Close ${file.name}`}>×</span>
              </button>
            ))}
          </div>
          <div className="editor-breadcrumbs"><span>workspace</span><b>›</b><span>{folder?.name || "No folder"}</span><b>›</b><strong>{selectedFile?.name || "No file opened"}</strong></div>
          <div className="editor-toolbar">
            <span className="toolbar-title"><span className={`language-orb ${getFileKind(selectedFile?.name)}`} /> <span>{selectedFile?.name || "No file selected"}</span><span className="breadcrumb-separator">/</span><span className="toolbar-muted">workspace</span></span>
            <div className="editor-actions">
              <span className={isDirty ? "toolbar-hint dirty" : "toolbar-hint"}>{isDirty ? "Unsaved changes" : "Saved"}</span>
              <button className="save-button" onClick={saveFile} disabled={!selectedFile || !isDirty}>Save</button>
              <div className="view-size-control app-zoom-control" aria-label="App zoom controls">
                <button className="view-size-button" onClick={onZoomOut} disabled={appZoom <= 0.8} title="Zoom out">-</button>
                <button className="view-size-value" onClick={onZoomReset} title="Reset zoom">{Math.round(appZoom * 100)}%</button>
                <button className="view-size-button" onClick={onZoomIn} disabled={appZoom >= 1.5} title="Zoom in">+</button>
              </div>
              <button className="dashboard-button" onClick={() => setIsEditorMaximized((currentValue) => !currentValue)}>{isEditorMaximized ? "Restore" : "Maximize"}</button>
              <button className="dashboard-button" onClick={onBackToDashboard}>Dashboard</button>
            </div>
          </div>
          <div className="code-editor-surface">
            <CodeEditor
              value={editorContent}
              onChange={(event) => { onEditorContentChange(event.target.value); onDirtyChange(true); }}
              language={getFileKind(selectedFile?.name)}
              placeholder="No file opened. Select a file from the explorer to open it."
            />
          </div>
          <div className="editor-status"><span>{selectedFile?.name.split(".").pop()?.toUpperCase() || "TEXT"}</span><span>Ln {editorContent.split("\n").length}, Col 1</span></div>
        </div>
      </div>
      </div>
      {contextMenu ? (
        <div className="file-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => openNewFileDialog(contextMenu.type === "folder" ? contextMenu.path : contextMenu.parentPath)}>New file</button>
          <button className="danger-action" onClick={() => deleteNode(contextMenu)}>Delete</button>
        </div>
      ) : null}
      {newFileTarget ? (
        <div className="new-file-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewFileTarget(null); }}>
          <form className="new-file-dialog" onSubmit={createFile}>
            <div className="new-file-kicker">EXPLORER</div>
            <h2>New file</h2>
            <p>Create a file in the opened project.</p>
            <input
              autoFocus
              value={newFileName}
              onChange={(event) => setNewFileName(event.target.value)}
              aria-label="New file name"
              placeholder="example.js"
            />
            <div className="new-file-actions">
              <button type="button" className="cancel-button" onClick={() => setNewFileTarget(null)}>Cancel</button>
              <button type="submit" className="create-button">Create file</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default EditorPage;