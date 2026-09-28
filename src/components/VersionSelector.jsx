import { useEffect, useEffectEvent, useRef, useState } from "react";

function VersionSelector({ user, selectedVersion, onSelectedVersionChange }) {
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectorRef = useRef(null);

  const applyVersions = useEffectEvent((availableVersions) => {
    setVersions(availableVersions);
    onSelectedVersionChange(availableVersions.includes(selectedVersion) ? selectedVersion : availableVersions[0] || "");
  });

  useEffect(() => {
    let isCurrent = true;

    async function loadVersions() {
      if (!user) {
        setVersions([]);
        setHasError(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const versionList = await window.electronAPI?.getUserVersions(user);
        if (!isCurrent) return;
        const availableVersions = Array.isArray(versionList) ? versionList : [];
        applyVersions(availableVersions);
      } catch {
        if (isCurrent) {
          setHasError(true);
          applyVersions([]);
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadVersions();
    return () => { isCurrent = false; };
  }, [user, refreshKey]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!selectorRef.current?.contains(event.target)) setIsOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function selectVersion(version) {
    onSelectedVersionChange(version);
    setIsOpen(false);
  }

  let triggerLabel = selectedVersion || "Select version";
  if (!user) triggerLabel = "Select user first";
  else if (isLoading) triggerLabel = "Loading versions";
  else if (hasError) triggerLabel = "Versions unavailable";
  else if (!versions.length) triggerLabel = "No versions available";

  return (
    <div className={`version-selector ${isOpen ? "open" : ""}`} ref={selectorRef}>
      <div className="version-badge" aria-hidden="true">Versions</div>
      <div className="version-selector-copy">
        <span className="user-selector-label">RESULT VERSION</span>
        <div className="version-menu-control">
          <button
            className={`version-menu-trigger ${isLoading ? "loading" : ""}`}
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            disabled={!user || isLoading || hasError || !versions.length}
            aria-label="Select result version"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-busy={isLoading}
          >
            <span className="version-value">{triggerLabel}</span>
            <span className="version-chevron" aria-hidden="true">🔽</span>
          </button>
          {isOpen ? (
            <div className="version-menu" role="listbox" aria-label="Available result versions">
              <span className="version-menu-caption">AVAILABLE VERSIONS</span>
              {versions.map((version) => (
                <button
                  className={`version-option ${version === selectedVersion ? "selected" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={version === selectedVersion}
                  key={version}
                  onClick={() => selectVersion(version)}
                >
                  <span>{version}</span>
                    {version === selectedVersion ? <span className="version-check" aria-hidden="true">&#10003; </span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <button className="user-refresh" onClick={() => setRefreshKey((key) => key + 1)} disabled={!user || isLoading} aria-label="Refresh versions" title="Refresh versions">&#8635;</button>
    </div>
  );
}

export default VersionSelector;