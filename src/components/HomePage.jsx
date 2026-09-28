import { useEffect, useEffectEvent, useRef, useState } from "react";
import { callApi } from "../lib/apiClient";

async function getUsers() {
  if (window.electronAPI?.getUsers) return window.electronAPI.getUsers();
  const data = await callApi("/api/users");
  return Array.isArray(data.users) ? data.users : [];
}

async function createUser(user) {
  if (window.electronAPI?.createUser) return window.electronAPI.createUser(user);
  return callApi(`/api/users/${encodeURIComponent(user)}`, { method: "POST" });
}

async function createUserVersion(user, version) {
  if (window.electronAPI?.createUserVersion) return window.electronAPI.createUserVersion(user, version);
  return callApi(`/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}`, { method: "POST" });
}

async function getVersions(user) {
  if (!user) return [];
  if (window.electronAPI?.getUserVersions) return window.electronAPI.getUserVersions(user);
  const data = await callApi(`/api/users/${encodeURIComponent(user)}/versions`);
  return Array.isArray(data.versions) ? data.versions : [];
}

function HomePage({ selectedUser, selectedVersion, onSelectedUserChange, onSelectedVersionChange, onNavigate }) {
  const [users, setUsers] = useState([]);
  const [newUserName, setNewUserName] = useState("");
  const [versionUser, setVersionUser] = useState(selectedUser);
  const [newVersion, setNewVersion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState(null);
  const [userVersions, setUserVersions] = useState([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const successTimerRef = useRef(null);

  const showSuccess = (title, message, value) => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    setSuccessNotice({ title, message, value });
    successTimerRef.current = window.setTimeout(() => setSuccessNotice(null), 4200);
  };

  const applyUsers = useEffectEvent((availableUsers) => {
    setUsers(availableUsers);
    const nextUser = selectedUser && availableUsers.includes(selectedUser) ? selectedUser : availableUsers[0] || "";
    setVersionUser((currentUser) => currentUser && availableUsers.includes(currentUser) ? currentUser : nextUser);
  });

  async function loadUsers() {
    setIsLoading(true);
    try {
      const availableUsers = await getUsers();
      applyUsers(Array.isArray(availableUsers) ? availableUsers : []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    return () => {
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    if (!selectedUser) {
      setUserVersions([]);
      return undefined;
    }

    setIsLoadingVersions(true);
    getVersions(selectedUser)
      .then((availableVersions) => {
        if (isCurrent) setUserVersions(Array.isArray(availableVersions) ? availableVersions : []);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingVersions(false);
      });

    return () => { isCurrent = false; };
  }, [selectedUser]);

  async function submitNewUser(event) {
    event.preventDefault();
    const userName = newUserName.trim();
    if (!userName) return;

    setIsSaving(true);
    try {
      const result = await createUser(userName);
      const message = result.created === false ? result.message || "User already exists." : `Created user ${userName}.`;
      showSuccess(result.created === false ? "User already available" : "User created", message, userName);
      setNewUserName("");
      await loadUsers();
      onSelectedUserChange(userName);
      setVersionUser(userName);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitNewVersion(event) {
    event.preventDefault();
    const versionName = newVersion.trim();
    if (!versionUser || !versionName) return;

    setIsSaving(true);
    try {
      const result = await createUserVersion(versionUser, versionName);
      const message = result.created === false ? result.message || "Release version already exists." : `Created release version ${versionName} for ${versionUser}.`;
      showSuccess(result.created === false ? "Release version already available" : "Release version created", message, versionName);
      setNewVersion("");
      onSelectedUserChange(versionUser);
      onSelectedVersionChange(versionName);
      if (versionUser === selectedUser) {
        const refreshedVersions = await getVersions(versionUser);
        setUserVersions(Array.isArray(refreshedVersions) ? refreshedVersions : []);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="home-page workspace-page">
      <div className="home-heading">
        <span className="eyebrow">API CONTROL CENTER</span>
        <h1>Core Automation workspace launcher</h1>
        <p>Choose an area to work in. User setup and result files now open as separate pages from these tiles.</p>
      </div>

      <div className="home-command-layout">
        <section className="home-launchpad-section" aria-label="Workspace navigation">
          <div className="home-section-heading">
            <span className="panel-kicker">TOOLS</span>
            
          </div>

          <div className="home-tile-grid">
            <button className="home-tile nav-tile about-tile" type="button" onClick={() => onNavigate("about")}>
              <span className="home-tile-icon" aria-hidden="true">&#9432;</span>
              <span className="panel-kicker">ABOUT</span>
              <h3>Framework</h3>
              <p>Review the Electron, React, Vite, API, and result viewer architecture.</p>
            </button>
            <button className="home-tile nav-tile editor-tile" type="button" onClick={() => onNavigate("editor")}>
              <span className="home-tile-icon" aria-hidden="true">&#9998;</span>
              <span className="panel-kicker">EDITOR</span>
              <h3>Workspace files</h3>
              <p>Open a folder, edit scripts or notes, and save changes locally.</p>
            </button>
            <button className="home-tile nav-tile dashboard-tile" type="button" onClick={() => onNavigate("results")}>
              <span className="home-tile-icon" aria-hidden="true">&#128202;</span>
              <span className="panel-kicker">RESULTS</span>
              <h3>Result files</h3>
              <p>Open the result list page, choose user/release version, and inspect reports.</p>
            </button>
            <button className="home-tile nav-tile recorder-tile" type="button" onClick={() => onNavigate("recorder")}>
              <span className="home-tile-icon" aria-hidden="true">&#127909;</span>
              <span className="panel-kicker">SCRIPT RECORDER</span>
              <h3>Script recorder</h3>
              <p>Open a page, click elements, and build a Playwright script automatically.</p>
            </button>
            <button className="home-tile nav-tile teamsetup-tile" type="button" onClick={() => onNavigate("teamsetup")}>
              <span className="home-tile-icon" aria-hidden="true">&#9881;</span>
              <span className="panel-kicker">TEAM SETUP</span>
              <h3>Backend base URL</h3>
              <p>Point this app at your own backend. Falls back to the .env value if nothing is saved.</p>
            </button>
          </div>
        </section>

        <aside className="home-control-rail" aria-label="Create users and release versions">
          <div className="control-rail-hero">
            <span className="panel-kicker">ACTIVE WORKSPACE</span>
            <strong>{selectedUser || "No user selected"}</strong>
            <small>{selectedVersion ? `Release version ${selectedVersion}` : "Select results page release version"}</small>
          </div>

          <form className="compact-create-form" onSubmit={submitNewUser}>
            <span className="panel-kicker">CREATE USER</span>
            <label className="home-field">
              <span>Available users ({users.length})</span>
              <span className="home-select-wrap">
                <span className="home-select-icon" aria-hidden="true">&#128100;</span>
                <select value={selectedUser} onChange={(event) => onSelectedUserChange(event.target.value)} disabled={isLoading || !users.length}>
                  {users.length ? users.map((user) => <option key={user} value={user}>{user}</option>) : <option>No users available</option>}
                </select>
                <span className="home-select-chevron" aria-hidden="true">&#8964;</span>
              </span>
            </label>
            {selectedUser ? (
              <label className="home-field">
                <span>Available release versions</span>
                <span className="version-chip-list">
                  {isLoadingVersions ? (
                    <span className="version-empty-state">Loading versions...</span>
                  ) : userVersions.length ? (
                    userVersions.map((version) => (
                      <button
                        key={version}
                        type="button"
                        className={`version-chip ${version === selectedVersion ? "active" : ""}`}
                        onClick={() => onSelectedVersionChange(version)}
                      >
                        {version}
                      </button>
                    ))
                  ) : (
                    <span className="version-empty-state">No versions yet</span>
                  )}
                </span>
              </label>
            ) : null}
            <label className="home-field">
              <span>User name</span>
              <input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="kshitijshirsat1847" />
            </label>
            <button className="secondary-button" type="submit" disabled={isSaving || !newUserName.trim()}>Create user</button>
          </form>

          <form className="compact-create-form" onSubmit={submitNewVersion}>
            <span className="panel-kicker">CREATE RELEASE VERSION</span>
            <label className="home-field">
              <span>User from list</span>
              <span className="home-select-wrap">
                <span className="home-select-icon" aria-hidden="true">&#128100;</span>
                <select value={versionUser} onChange={(event) => setVersionUser(event.target.value)} disabled={isLoading || !users.length}>
                  {users.length ? users.map((user) => <option key={user} value={user}>{user}</option>) : <option>No users available</option>}
                </select>
                <span className="home-select-chevron" aria-hidden="true">&#8964;</span>
              </span>
            </label>
            <label className="home-field">
              <span>Release version name</span>
              <input value={newVersion} onChange={(event) => setNewVersion(event.target.value)} placeholder="2607" />
            </label>
            <button className="secondary-button" type="submit" disabled={isSaving || !versionUser || !newVersion.trim()}>Create release version</button>
          </form>
        </aside>
      </div>

      {successNotice ? (
        <div className="success-toast" role="status">
          <span className="success-toast-mark">&#10003;</span>
          <span className="success-toast-copy">
            <strong>{successNotice.title}</strong>
            <small>{successNotice.message}</small>
            <b>{successNotice.value}</b>
          </span>
        </div>
      ) : null}
    </section>
  );
}

export default HomePage;
