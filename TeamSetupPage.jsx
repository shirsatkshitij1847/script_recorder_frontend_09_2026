import { useEffect, useState } from "react";
import { getBaseUrl, setBaseUrl, checkHealth } from "../lib/apiClient";

function TeamSetupPage({ onNavigate }) {
  const [value, setValue] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [status, setStatus] = useState("");
  const [health, setHealth] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    getBaseUrl().then(async (url) => {
      setActiveUrl(url);
      setValue(url);
      setHealth(await checkHealth(url));
    });
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("");
    try {
      const saved = await setBaseUrl(value);
      setActiveUrl(saved);
      setValue(saved);
      setStatus("Base URL saved. It will be used for every API call from now on.");
      setHealth(await checkHealth(saved));
    } catch (error) {
      setStatus(error.message || "Failed to save base URL.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    const target = value.trim().replace(/\/+$/, "");
    if (!target) return;
    setIsTesting(true);
    setStatus("Testing connection...");
    const result = await checkHealth(target);
    setHealth(result);
    setStatus(result.ok ? "Connected successfully (backend is healthy)." : result.error);
    setIsTesting(false);
  }

  return (
    <section className="team-setup-page">
      <div className="team-setup-hero">
        <span className="team-setup-hero-icon" aria-hidden="true">&#9881;</span>
        <div className="team-setup-hero-copy">
          <span className="eyebrow">TEAM SETUP</span>
          <h1>Backend base URL</h1>
          <p>
            Every teammate can run this app against their own backend. Set your base URL below and it is saved
            locally on this machine. If nothing is saved yet, the app falls back to the <code>BASE_URL</code>/
            <code>PORT</code> value from the project's <code>.env</code> file.
          </p>
        </div>
      </div>

      <div className="team-setup-grid">
        <article className="team-setup-status-card">
          <span className="panel-kicker">ACTIVE CONNECTION</span>
          <div className={`team-setup-status-ring ${health?.ok ? "ok" : health ? "error" : "idle"}`}>
            <span aria-hidden="true">{health ? (health.ok ? "\u2713" : "\u2715") : "\u2026"}</span>
          </div>
          <strong>{activeUrl || "Not set"}</strong>
          <small>
            <span className={`status-dot-inline ${health?.ok ? "ok" : health ? "error" : "idle"}`} aria-hidden="true" />
            {health ? (health.ok ? "Backend reachable" : "Backend unreachable") : "Checking..."}
          </small>

          <ol className="team-setup-steps">
            <li>Ask your backend owner for their host and port.</li>
            <li>Enter it on the right and hit Save.</li>
            <li>Use Test connection any time to confirm it's healthy.</li>
          </ol>
        </article>

        <form className="team-setup-form-card" onSubmit={handleSave}>
          <span className="panel-kicker">API BASE URL</span>
          <label className="home-field">
            <span>Base URL</span>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="http://localhost:7000"
            />
          </label>

          {health ? (
            <p className={health.ok ? "health-status ok" : "health-status error"}>
              <span aria-hidden="true">{health.ok ? "\u2713" : "\u2715"}</span>{" "}
              {health.ok ? "Backend is reachable and healthy." : health.error}
            </p>
          ) : null}

          <div className="about-actions">
            <button className="primary-button" type="submit" disabled={isSaving || !value.trim()}>
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button className="secondary-button" type="button" onClick={handleTestConnection} disabled={isTesting || !value.trim()}>
              {isTesting ? "Testing..." : "Test connection"}
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate("home")}>
              Back home
            </button>
          </div>

          {status ? <p className="team-setup-note">{status}</p> : null}
        </form>
      </div>
    </section>
  );
}

export default TeamSetupPage;
