import { useEffect, useEffectEvent, useRef, useState } from "react";
import { callApi } from "../lib/apiClient";

async function getUsers() {
  if (window.electronAPI?.getUsers) return window.electronAPI.getUsers();
  const data = await callApi("/api/users");
  return Array.isArray(data.users) ? data.users : [];
}

async function getVersions(user) {
  if (!user) return [];
  if (window.electronAPI?.getUserVersions) return window.electronAPI.getUserVersions(user);
  const data = await callApi(`/api/users/${encodeURIComponent(user)}/versions`);
  return Array.isArray(data.versions) ? data.versions : [];
}

async function createUser(user) {
  if (window.electronAPI?.createUser) return window.electronAPI.createUser(user);
  return callApi(`/api/users/${encodeURIComponent(user)}`, { method: "POST" });
}

async function createUserVersion(user, version) {
  if (window.electronAPI?.createUserVersion) return window.electronAPI.createUserVersion(user, version);
  return callApi(`/api/users/${encodeURIComponent(user)}/${encodeURIComponent(version)}`, { method: "POST" });
}

function WorkspaceSetupPage({ selectedUser, selectedVersion, onSelectedUserChange, onSelectedVersionChange, onNavigate }) {
  const [users, setUsers] = useState([]);
  const [versions, setVersions] = useState([]);
  const [newUserName, setNewUserName] = useState("");
  const [versionUser, setVersionUser] = useState(selectedUser);
  const [newVersion, setNewVersion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("Ready to connect to the local API.");
  const [successNotice, setSuccessNotice] = useState(null);
  const successTimerRef = useRef(null);

  const showSuccess = (title, message, value) => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    setSuccessNotice({ title, message, value });
    successTimerRef.current = window.setTimeout(() => setSuccessNotice(null), 4200);
  };

  const applyUsers = useEffectEvent((availableUsers) => {
    setUsers(availableUsers);
    const nextUser = selectedUser && availableUsers.includes(selectedUser) ? selectedUser : availableUsers[0] || "";
    if (nextUser !== selectedUser) onSelectedUserChange(nextUser);
    setVersionUser((currentUser) => currentUser && availableUsers.includes(currentUser) ? currentUser : nextUser);
  });

  const applyVersions = useEffectEvent((availableVersions) => {
    setVersions(availableVersions);
    if (!availableVersions.includes(selectedVersion)) onSelectedVersionChange(availableVersions[0] || "");
  });

  async function loadUsers() {
    setIsLoading(true);
    try {
      const availableUsers = await getUsers();
      applyUsers(Array.isArray(availableUsers) ? availableUsers : []);
      setStatus("Users loaded from API.");
    } catch (error) {
      setStatus(error.message);
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

    async function loadVersions() {
      if (!selectedUser) {
        applyVersions([]);
        return;
      }

      try {
        const availableVersions = await getVersions(selectedUser);
        if (isCurrent) applyVersions(Array.isArray(availableVersions) ? availableVersions : []);
      } catch (error) {
        if (isCurrent) {
          applyVersions([]);
          setStatus(error.message);
        }
      }
    }

    loadVersions();
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
      setStatus(message);
      showSuccess(result.created === false ? "User already available" : "User created", message, userName);
      setNewUserName("");
      await loadUsers();
      onSelectedUserChange(userName);
      setVersionUser(userName);
    } catch (error) {
      setStatus(error.message);
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
      const message = result.created === false ? result.message || "Version already exists." : `Created version ${versionName} for ${versionUser}.`;
      setStatus(message);
      showSuccess(result.created === false ? "Version already available" : "Version created", message, versionName);
      setNewVersion("");
      onSelectedUserChange(versionUser);
      onSelectedVersionChange(versionName);
      const availableVersions = await getVersions(versionUser);
      applyVersions(Array.isArray(availableVersions) ? availableVersions : []);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="setup-page workspace-page">
      <div className="setup-heading">
        <span className="eyebrow">WORKSPACE SETUP</span>
        <h1>User and version control</h1>
        <p>Create users, add versions under a selected user, and choose the active workspace before opening results.</p>
      </div>

      <div className="setup-grid">
        <article className="setup-active-card">
          <span className="panel-kicker">ACTIVE WORKSPACE</span>
          <strong>{selectedUser || "No user selected"}</strong>
          <small>{selectedVersion ? `Version ${selectedVersion}` : "No version selected"}</small>
          <button className="primary-button" type="button" onClick={() => onNavigate("dashboard")} disabled={!selectedUser || !selectedVersion}>Open results</button>
        </article>

        <section className="setup-card">
          <span className="panel-kicker">SELECT FROM API</span>
          <label className="home-field">
            <span>User</span>
            <select value={selectedUser} onChange={(event) => onSelectedUserChange(event.target.value)} disabled={isLoading || !users.length}>
              {users.length ? users.map((user) => <option key={user} value={user}>{user}</option>) : <option>No users available</option>}
            </select>
          </label>
          <label className="home-field">
            <span>Version</span>
            <select value={selectedVersion} onChange={(event) => onSelectedVersionChange(event.target.value)} disabled={!selectedUser || !versions.length}>
              {versions.length ? versions.map((version) => <option key={version} value={version}>{version}</option>) : <option>No versions available</option>}
            </select>
          </label>
          <div className="version-chip-list" aria-label="Available versions">
            {versions.length ? versions.slice(0, 10).map((version) => (
              <button key={version} type="button" className={selectedVersion === version ? "version-chip active" : "version-chip"} onClick={() => onSelectedVersionChange(version)}>
                <span>{version}</span>
              </button>
            )) : <span className="version-empty-state">Choose a user to load versions</span>}
          </div>
        </section>

        <form className="setup-card" onSubmit={submitNewUser}>
          <span className="panel-kicker">CREATE USER</span>
          <label className="home-field">
            <span>User name</span>
            <input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="kshitijshirsat1847" />
          </label>
          <button className="secondary-button" type="submit" disabled={isSaving || !newUserName.trim()}>Create user</button>
        </form>

        <form className="setup-card" onSubmit={submitNewVersion}>
          <span className="panel-kicker">CREATE VERSION</span>
          <label className="home-field">
            <span>User from list</span>
            <select value={versionUser} onChange={(event) => setVersionUser(event.target.value)} disabled={isLoading || !users.length}>
              {users.length ? users.map((user) => <option key={user} value={user}>{user}</option>) : <option>No users available</option>}
            </select>
          </label>
          <label className="home-field">
            <span>Version name</span>
            <input value={newVersion} onChange={(event) => setNewVersion(event.target.value)} placeholder="2607" />
          </label>
          <button className="secondary-button" type="submit" disabled={isSaving || !versionUser || !newVersion.trim()}>Create version</button>
        </form>
      </div>

      <div className="home-status" aria-live="polite">{status}</div>
      {successNotice ? (
        <div className="success-toast" role="status">
          <span className="success-toast-mark">OK</span>
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

export default WorkspaceSetupPage;
