import { useEffect, useRef, useState } from "react";

const SKELETON_ROWS = 6;
const TAG_COLOR_COUNT = 12;

function getTagColorIndex(key) {
  const text = String(key || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % TAG_COLOR_COUNT;
}

function ResultFileList({ user, version, onOpenResult }) {
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tagsByFolder, setTagsByFolder] = useState({});
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
    if (!user || !version || !folders.length) {
      setTagsByFolder({});
      return undefined;
    }

    let isCurrent = true;
    setTagsByFolder({});

    folders.forEach((folderName) => {
      window.electronAPI?.getExecutionTags(user, version, folderName)
        .then((tags) => {
          if (isCurrent) setTagsByFolder((current) => ({ ...current, [folderName]: Array.isArray(tags) ? tags : [] }));
        })
        .catch(() => {
          if (isCurrent) setTagsByFolder((current) => ({ ...current, [folderName]: [] }));
        });
    });

    return () => { isCurrent = false; };
  }, [user, version, folders]);

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
          {folders.map((folderName) => {
            const tags = tagsByFolder[folderName];
            return (
              <li key={folderName}>
                <button className="result-file-button" onClick={() => onOpenResult(folderName)}>
                  <span className="result-file-status" aria-hidden="true">&#128193;</span>
                  <span className="result-file-details">
                    <span className="result-file-name-row">
                      <strong>{folderName}</strong>
                      {tags?.length ? (
                        <span className="result-tag-list">
                          {tags.map((tag, index) => (
                            <span className={`result-tag-chip result-tag-chip-${getTagColorIndex(tag.Key)}`} key={`${tag.Key}-${index}`}>{tag.Key}: {tag.Value}</span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <small>Execution folder · Version {version}</small>
                  </span>
                  <span className="result-user-tag">user:{user}</span>
                  <span className="result-open-icon" aria-hidden="true">&#8250;</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="result-list-state">No execution folders are available for this user.</div>
      )}
    </section>
  );
}

export default ResultFileList;