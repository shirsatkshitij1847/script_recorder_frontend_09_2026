import { useEffect, useRef, useState } from "react";

const SKELETON_ROWS = 6;
const AUTO_REFRESH_INTERVAL_MS = 30000;

function ResultFileList({ user, version, onOpenResult }) {
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedKeyRef = useRef(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadFolders() {
      if (!user || !version) {
        setFolders([]);
        setHasError(false);
        setIsLoading(false);
        loadedKeyRef.current = null;
        return;
      }

      const selectionKey = `${user}::${version}`;
      if (loadedKeyRef.current !== selectionKey) setFolders([]);
      loadedKeyRef.current = selectionKey;
      setIsLoading(true);
      setHasError(false);

      try {
        const folderList = await window.electronAPI?.getUserFolders(user, version);
        if (isCurrent) setFolders(Array.isArray(folderList) ? folderList : []);
      } catch {
        if (isCurrent) {
          setFolders([]);
          setHasError(true);
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadFolders();
    return () => { isCurrent = false; };
  }, [user, version, refreshKey]);

  useEffect(() => {
    if (!user || !version) return undefined;
    const timer = setInterval(() => setRefreshKey((key) => key + 1), AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, version]);

  const showSkeleton = (isLoading && folders.length === 0) || (!user && !hasError);

  return (
    <section className="results-panel">
      <header className="results-heading">
        <div>
          <span className="panel-kicker">USER RESULTS</span>
          {showSkeleton ? (
            <div className="results-heading-skeleton" aria-label="Loading user results">
              <span className="skeleton-block skeleton-title" />
              <span className="skeleton-block skeleton-subtitle" />
            </div>
          ) : (
            <>
              <h1>{user}</h1>
              <p>{version ? `${folders.length} execution folders · Version ${version}` : "Select a version to view available folders."}</p>
            </>
          )}
        </div>
        <button
          className="quiet-button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={!user || !version || isLoading}
        >
          Refresh &#8635;
        </button>
      </header>

      {showSkeleton ? (
        <ul className="result-file-list result-skeleton-list" aria-label="Loading result folders" aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} aria-hidden="true">
              <span className="skeleton-block skeleton-status" />
              <span className="result-file-details">
                <span className="skeleton-block skeleton-file-name" />
                <span className="skeleton-block skeleton-file-meta" />
              </span>
              <span className="skeleton-block skeleton-user-tag" />
            </li>
          ))}
        </ul>
      ) : !version ? (
        <div className="result-list-state">Select a version to view available folders.</div>
      ) : hasError ? (
        <div className="result-list-state">Data not available.</div>
      ) : folders.length ? (
        <ul className="result-file-list">
          {folders.map((folderName) => (
            <li key={folderName}>
              <button className="result-file-button" onClick={() => onOpenResult(folderName)}>
                <span className="result-file-status" aria-hidden="true">&#128193;</span>
                <span className="result-file-details">
                  <strong>{folderName}</strong>
                  <small>Execution folder · Version {version}</small>
                </span>
                <span className="result-user-tag">user:{user}</span>
                <span className="result-open-icon" aria-hidden="true">&#8250;</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="result-list-state">No execution folders are available for this user.</div>
      )}
    </section>
  );
}

export default ResultFileList;