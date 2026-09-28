import { useEffect, useEffectEvent, useState } from "react";

function getInitials(userName) {
  if (!userName) return "?";
  return userName.slice(0, 2).toUpperCase();
}

function UserSelector({ selectedUser, onSelectedUserChange }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const applyInitialUsers = useEffectEvent((availableUsers) => {
    setUsers(availableUsers);
    if (!availableUsers.includes(selectedUser)) onSelectedUserChange(availableUsers[0] || "");
  });

  async function loadUsers() {
    setIsLoading(true);
    setHasError(false);

    try {
      const userList = await window.electronAPI?.getUsers();
      const availableUsers = Array.isArray(userList) ? userList : [];
      setUsers(availableUsers);
      if (!availableUsers.includes(selectedUser)) onSelectedUserChange(availableUsers[0] || "");
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    window.electronAPI?.getUsers()
      .then((userList) => {
        if (!isCurrent) return;
        const availableUsers = Array.isArray(userList) ? userList : [];
        applyInitialUsers(availableUsers);
      })
      .catch(() => {
        if (isCurrent) setHasError(true);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, []);

  function handleUserChange(event) {
    onSelectedUserChange(event.target.value);
  }

  const showSkeleton = isLoading;
  const label = `${users.length} users online`;

  return (
    <div className="user-selector">
      <div className={`user-avatar ${showSkeleton ? "loading" : ""}`}>
        {showSkeleton ? <span className="skeleton-block" /> : hasError ? "--" : getInitials(selectedUser)}
      </div>
      <div className="user-selector-copy">
        <span className="user-selector-label">ACTIVE USER</span>
        {showSkeleton ? (
          <span className="user-selector-skeleton" aria-label="Loading users" aria-busy="true">
            <span className="skeleton-block skeleton-user-name" />
            <span className="skeleton-block skeleton-user-status" />
          </span>
        ) : hasError ? (
          <span className="user-unavailable">Data not available</span>
        ) : (
          <>
            <span className="user-select-control">
              <select value={selectedUser} onChange={handleUserChange} disabled={!users.length} aria-label="Select active user">
                {users.length ? users.map((user) => <option key={user} value={user}>{user}</option>) : <option>No users available</option>}
              </select>
              <span className="user-select-chevron" aria-hidden="true">&#8964;</span>
            </span>
            <span className="user-selector-status"><i />{label}</span>
          </>
        )}
      </div>
      <button className="user-refresh" onClick={loadUsers} disabled={isLoading} aria-label="Refresh users" title="Refresh users">&#8635;</button>
    </div>
  );
}

export default UserSelector;
