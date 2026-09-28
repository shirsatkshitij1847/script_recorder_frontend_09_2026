function NavigationBar({ activePage, onNavigate, appZoom, onZoomIn, onZoomOut, onZoomReset }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNavigate("home")} aria-label="Go to home">
        <span className="brand-mark">L</span>
        <span>
          <strong>LoadTest</strong>
          <small>performance console</small>
        </span>
      </button>

      <nav className="main-nav" aria-label="Main navigation">
        <button className={activePage === "home" ? "nav-link active" : "nav-link"} onClick={() => onNavigate("home")}>
          <span className="nav-icon">⌂</span>
          Home
        </button>
        <button className={activePage === "dashboard" || activePage === "results" || activePage === "result" ? "nav-link active" : "nav-link"} onClick={() => onNavigate("results")}>
          <span className="nav-icon">&#9632;</span>
          Results
        </button>
        <button className={activePage === "editor" ? "nav-link active" : "nav-link"} onClick={() => onNavigate("editor")}>
          <span className="nav-icon">&#9998;</span>
          Editor
        </button>
        <button className={activePage === "recorder" ? "nav-link active" : "nav-link"} onClick={() => onNavigate("recorder")}>
          <span className="nav-icon">&#9908;</span>
          Script Recorder
        </button>
      </nav>

      <div className="topbar-actions">
        <div className="view-size-control app-zoom-control" aria-label="App zoom controls">
          <button className="view-size-button" onClick={onZoomOut} disabled={appZoom <= 0.8} title="Zoom out">-</button>
          <button className="view-size-value" onClick={onZoomReset} title="Reset zoom">{Math.round(appZoom * 100)}%</button>
          <button className="view-size-button" onClick={onZoomIn} disabled={appZoom >= 1.5} title="Zoom in">+</button>
        </div>
      </div>
    </header>
  );
}

export default NavigationBar;