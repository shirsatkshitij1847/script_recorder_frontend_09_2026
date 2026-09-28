import { useEffect, useState } from "react";

const SKELETON_ROWS = 6;

function ResultFileList({ user, version, onOpenResult }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadFiles() {
      if (!user || !version) {
        setFiles([]);
        setHasError(false);
        setIsLoading(false);
        return;
      }

      setFiles([]);
      setIsLoading(true);
      setHasError(false);

      try {
        const fileList = await window.electronAPI?.getUserFiles(user, version);
        if (isCurrent) setFiles(Array.isArray(fileList) ? fileList : []);
      } catch {
        if (isCurrent) {
          setFiles([]);
          setHasError(true);
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadFiles();
    return () => { isCurrent = false; };
  }, [user, version, refreshKey]);

  const showSkeleton = isLoading || (!user && !hasError);

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
              <p>{version ? `${files.length} available files · Version ${version}` : "Select a version to view available results."}</p>
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
        <ul className="result-file-list result-skeleton-list" aria-label="Loading result files" aria-busy="true">
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
        <div className="result-list-state">Select a version to view available results.</div>
      ) : hasError ? (
        <div className="result-list-state">Data not available.</div>
      ) : files.length ? (
        <ul className="result-file-list">
          {files.map((fileName) => (
            <li key={fileName}>
              <button className="result-file-button" onClick={() => onOpenResult(fileName)}>
                <span className="result-file-status" aria-hidden="true">&#10003;</span>
                <span className="result-file-details">
                  <strong>{fileName}</strong>
                  <small>{fileName.toLowerCase().includes(".html") ? "HTML result" : "JSON result"} · Version {version}</small>
                </span>
                <span className="result-user-tag">user:{user}</span>
                <span className="result-open-icon" aria-hidden="true">&#8250;</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="result-list-state">No result files are available for this user.</div>
      )}
    </section>
  );
}

export default ResultFileList;