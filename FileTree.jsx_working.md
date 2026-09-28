import { useState } from "react";

function getFileIcon(fileName = "") {
  const lowerName = fileName.toLowerCase();
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (lowerName.startsWith("readme")) return { kind: "info", symbol: "i" };
  if (lowerName === ".gitignore") return { kind: "git", symbol: "\u2387" };
  if (lowerName.includes("config") && ["js", "ts", "cjs", "mjs"].includes(extension)) return { kind: "config", symbol: "\u2699" };
  if (extension === "json") return { kind: "data", symbol: "{}" };
  if (["yaml", "yml"].includes(extension)) return { kind: "data", symbol: "YML" };
  if (["jsx", "tsx"].includes(extension)) return { kind: "react", symbol: "\u269B" };
  if (extension === "js") return { kind: "javascript", symbol: "JS" };
  if (extension === "ts") return { kind: "javascript", symbol: "TS" };
  if (["css", "scss", "less"].includes(extension)) return { kind: "stylesheet", symbol: "#" };
  if (["html", "htm"].includes(extension)) return { kind: "markup", symbol: "<>" };
  if (extension === "env") return { kind: "env", symbol: "\u2699" };
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(extension)) return { kind: "image", symbol: "\u25A3" };
  if (["md", "txt"].includes(extension)) return { kind: "text", symbol: "\u2261" };
  return { kind: "file", symbol: (extension || fileName).slice(0, 1).toUpperCase() || "F" };
}

function FileTreeNode({ node, onSelectFile, onContextMenu, parentPath, level = 0 }) {
  const [isOpen, setIsOpen] = useState(level < 1);
  const isFolder = node.type === "folder";

  function toggleFolder() {
    if (isFolder) setIsOpen((open) => !open);
    else onSelectFile(node);
  }

  function showContextMenu(event) {
    event.preventDefault();
    onContextMenu({
      ...node,
      parentPath,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function renderChildren() {
    if (!isFolder || !isOpen) return null;
    if (!node.children.length) return <div className="tree-empty-folder">Empty folder</div>;

    return node.children.map((child) => (
      <FileTreeNode
        key={child.path}
        node={child}
        onSelectFile={onSelectFile}
        onContextMenu={onContextMenu}
        parentPath={node.path}
        level={level + 1}
      />
    ));
  }

  const fileIcon = isFolder ? null : getFileIcon(node.name);

  return (
    <div className="tree-node">
      <button
        className={`tree-item ${isFolder ? "tree-folder" : "tree-file"}`}
        style={{ paddingLeft: `${10 + level * 13}px` }}
        onClick={toggleFolder}
        aria-expanded={isFolder ? isOpen : undefined}
        aria-label={isFolder ? `${isOpen ? "Collapse" : "Expand"} ${node.name}` : `Open ${node.name}`}
        onContextMenu={showContextMenu}
        title={node.path}
      >
        <span className={`tree-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">{isFolder ? "\u25B8" : ""}</span>
        {isFolder ? (
          <span className={`tree-folder-icon ${isOpen ? "open" : ""}`} aria-hidden="true" />
        ) : (
          <span className={`tree-file-icon ${fileIcon.kind}`} aria-hidden="true">{fileIcon.symbol}</span>
        )}
        <span className="tree-name">{node.name}</span>
      </button>
      {isFolder && isOpen ? <div className="tree-children">{renderChildren()}</div> : null}
    </div>
  );
}

function FileTree({ root, onSelectFile, onContextMenu, refreshKey }) {
  if (!root) return <div className="tree-empty">Choose a folder to browse files</div>;

  return (
    <div className="file-tree">
      <FileTreeNode
        node={{ ...root, type: "folder" }}
        onSelectFile={onSelectFile}
        onContextMenu={onContextMenu}
        key={refreshKey}
      />
    </div>
  );
}

export default FileTree;