function AboutPage({ onNavigate }) {
  return (
    <section className="about-page workspace-page">
      <div className="about-hero-panel">
        <span className="eyebrow">FRAMEWORK OVERVIEW</span>
        <h1>Core Automation Solution</h1>
        <p>Electron desktop runtime with a React 19 interface, Vite development flow, local workspace file access, and API-backed result browsing for MES testing workflows.</p>
      </div>

      <div className="about-stack-grid">
        <article className="about-stack-card">
          <span>01</span>
          <h2>Electron Shell</h2>
          <p>Runs the app as a desktop workspace and exposes controlled file and zoom APIs through the preload bridge.</p>
        </article>
        <article className="about-stack-card">
          <span>02</span>
          <h2>React Workspace</h2>
          <p>Manages user selection, version selection, editor state, dashboard navigation, and result rendering.</p>
        </article>
        <article className="about-stack-card">
          <span>03</span>
          <h2>Automation Results</h2>
          <p>Reads users, versions, and report files from the local API, then opens selected reports in the result viewer.</p>
        </article>
      </div>

      <div className="about-actions">
        <button className="primary-button" type="button" onClick={() => onNavigate("home")}>Back home</button>
        <button className="secondary-button" type="button" onClick={() => onNavigate("editor")}>Open editor</button>
      </div>
    </section>
  );
}

export default AboutPage;