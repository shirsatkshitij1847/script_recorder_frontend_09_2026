import { useEffect, useState } from "react";

function hasRenderableContent(content) {
  const documentNode = new DOMParser().parseFromString(content, "text/html");
  return Boolean(documentNode.body.innerHTML.trim() || documentNode.querySelector("script"));
}

function ResultViewer({ result, onBack }) {
  const [activeTab, setActiveTab] = useState("report");

  const [isFrameLoading, setIsFrameLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEmpty, setIsEmpty] = useState(false);
  const [fileName, setFileName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [isTraceLoading, setIsTraceLoading] = useState(false);
  const [isTraceFrameLoading, setIsTraceFrameLoading] = useState(true);
  const [hasTraceError, setHasTraceError] = useState(false);
  const [traceErrorMessage, setTraceErrorMessage] = useState("");
  const [traceUrl, setTraceUrl] = useState("");
  const [traceRefreshKey, setTraceRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadResult() {
      setIsLoading(true);
      setIsFrameLoading(true);
      setHasError(false);
      setErrorMessage("");
      setIsEmpty(false);
      setFileName("");
      setHtmlContent("");

      try {
        const resolved = await window.electronAPI?.getUserResult(result.user, result.version, result.testExecutionId);
        if (!isCurrent) return;
        if (!resolved || typeof resolved.content !== "string") setHasError(true);
        else {
          setFileName(resolved.fileName);
          setHtmlContent(resolved.content);
          setIsEmpty(!hasRenderableContent(resolved.content));
        }
      } catch (error) {
        if (isCurrent) {
          setHasError(true);
          setErrorMessage(error?.message || "");
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadResult();
    return () => { isCurrent = false; };
  }, [result, refreshKey]);

  useEffect(() => {
    if (activeTab !== "trace" || traceUrl) return undefined;
    let isCurrent = true;

    async function loadTrace() {
      setIsTraceLoading(true);
      setIsTraceFrameLoading(true);
      setHasTraceError(false);
      setTraceErrorMessage("");

      try {
        const session = await window.electronAPI?.getTraceViewer(result.user, result.version, result.testExecutionId);
        if (!isCurrent) return;
        if (!session?.url) setHasTraceError(true);
        else setTraceUrl(session.url);
      } catch (error) {
        if (isCurrent) {
          setHasTraceError(true);
          setTraceErrorMessage(error?.message || "");
        }
      } finally {
        if (isCurrent) setIsTraceLoading(false);
      }
    }

    loadTrace();
    return () => { isCurrent = false; };
  }, [activeTab, result, traceRefreshKey, traceUrl]);

  function retryTrace() {
    setTraceUrl("");
    setTraceRefreshKey((key) => key + 1);
  }

  return (
    <section className="result-viewer-page">
      <header className="result-viewer-toolbar">
        <button className="viewer-back-button" onClick={onBack} aria-label="Back to result files" title="Back to results">&#8592;</button>
        <div className="viewer-file-copy">
          <strong>{result.testExecutionId}</strong>
          <span>Version {result.version}</span>
        </div>
        <div className="view-toggle" role="tablist" aria-label="Result view">
          <span className={`view-toggle-thumb ${activeTab === "trace" ? "right" : ""}`} aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "report"}
            className={`view-toggle-option ${activeTab === "report" ? "active" : ""}`}
            onClick={() => setActiveTab("report")}
          >
            HTML Report
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "trace"}
            className={`view-toggle-option ${activeTab === "trace" ? "active" : ""}`}
            onClick={() => setActiveTab("trace")}
          >
            Trace Viewer
          </button>
        </div>
        <span className="result-user-tag">user:{result.user}</span>
        {activeTab === "report" ? (
          <button className="quiet-button" onClick={() => setRefreshKey((key) => key + 1)} disabled={isLoading}>Refresh &#8635;</button>
        ) : (
          <button className="quiet-button" onClick={retryTrace} disabled={isTraceLoading}>Refresh &#8635;</button>
        )}
      </header>

      {activeTab === "report" ? (
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
              {errorMessage ? <span>{errorMessage}</span> : null}
              <button className="quiet-button" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button>
            </div>
          ) : isEmpty ? (
            <div className="viewer-unavailable">
              <strong>HTML loaded, but the body is empty.</strong>
              <span>This result file does not contain visible content.</span>
            </div>
          ) : !isLoading && htmlContent ? (
            <iframe
              className="result-html-frame"
              title={`${fileName} result`}
              srcDoc={htmlContent}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              onLoad={() => setIsFrameLoading(false)}
            />
          ) : null}
        </div>
      ) : (
        <div className="result-viewer-content">
          {(isTraceLoading || isTraceFrameLoading) && !hasTraceError ? (
            <div className="trace-loading" aria-label="Loading trace" aria-busy="true">
              <span className="trace-loading-spinner" aria-hidden="true" />
              <strong>Loading trace…</strong>
              <span>Starting the Playwright trace viewer, this can take a few seconds.</span>
            </div>
          ) : null}

          {hasTraceError ? (
            <div className="viewer-unavailable">
              <strong>Trace not available.</strong>
              {traceErrorMessage ? <span>{traceErrorMessage}</span> : null}
              <button className="quiet-button" onClick={retryTrace}>Try again</button>
            </div>
          ) : !isTraceLoading && traceUrl ? (
            <iframe
              className="result-html-frame"
              title={`${result.testExecutionId} trace`}
              src={traceUrl}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              onLoad={() => setIsTraceFrameLoading(false)}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

export default ResultViewer;