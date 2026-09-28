import { useEffect, useState } from "react";

function hasRenderableContent(content) {
  const documentNode = new DOMParser().parseFromString(content, "text/html");
  return Boolean(documentNode.body.innerHTML.trim() || documentNode.querySelector("script"));
}

function ResultViewer({ result, onBack }) {
  const [isFrameLoading, setIsFrameLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const resultUrl = `http://localhost:7000/api/users/${encodeURIComponent(result.user)}/${encodeURIComponent(result.version)}/${encodeURIComponent(result.fileName)}`;

  useEffect(() => {
    let isCurrent = true;

    async function loadResult() {
      setIsLoading(true);
      setIsFrameLoading(true);
      setHasError(false);
      setIsEmpty(false);

      try {
        const content = await window.electronAPI?.getUserResult(result.user, result.version, result.fileName);
        if (!isCurrent) return;
        if (typeof content !== "string") setHasError(true);
        else setIsEmpty(!hasRenderableContent(content));
      } catch {
        if (isCurrent) {
          setHasError(true);
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadResult();
    return () => { isCurrent = false; };
  }, [result, refreshKey]);

  return (
    <section className="result-viewer-page">
      <header className="result-viewer-toolbar">
        <button className="viewer-back-button" onClick={onBack} aria-label="Back to result files" title="Back to results">&#8592;</button>
        <div className="viewer-file-copy">
          <strong>{result.fileName}</strong>
          <span>Version {result.version}</span>
        </div>
        <span className="result-user-tag">user:{result.user}</span>
        <button className="quiet-button" onClick={() => setRefreshKey((key) => key + 1)} disabled={isLoading}>Refresh &#8635;</button>
      </header>

      <div className="result-viewer-content">
        {(isLoading || isFrameLoading) && !hasError && !isEmpty ? (
          <div className="viewer-skeleton" aria-label="Loading result" aria-busy="true">
            <span className="skeleton-block viewer-skeleton-title" />
            <span className="skeleton-block viewer-skeleton-line wide" />
            <span className="skeleton-block viewer-skeleton-line" />
            <span className="skeleton-block viewer-skeleton-panel" />
          </div>
        ) : null}

        {hasError ? (
          <div className="viewer-unavailable">
            <strong>Data not available.</strong>
            <button className="quiet-button" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button>
          </div>
        ) : isEmpty ? (
          <div className="viewer-unavailable">
            <strong>HTML loaded, but the body is empty.</strong>
            <span>This result file does not contain visible content.</span>
          </div>
        ) : !isLoading ? (
          <iframe
            className="result-html-frame"
            title={`${result.fileName} result`}
            src={resultUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            onLoad={() => setIsFrameLoading(false)}
          />
        ) : null}
      </div>
    </section>
  );
}

export default ResultViewer;