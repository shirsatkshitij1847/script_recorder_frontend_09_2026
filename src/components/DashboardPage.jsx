import ResultFileList from "./ResultFileList";
import UserSelector from "./UserSelector";
import VersionSelector from "./VersionSelector";

function DashboardPage({ selectedUser, version, onSelectedUserChange, onSelectedVersionChange, onOpenResult }) {
  return (
    <section className="dashboard-page workspace-page">
      <div className="result-filter-bar">
        <div>
          <span className="panel-kicker">RESULT WORKSPACE</span>
          <p>Choose a user and version to view result files.</p>
        </div>
        <div className="result-filter-controls">
          <UserSelector selectedUser={selectedUser} onSelectedUserChange={onSelectedUserChange} />
          <VersionSelector user={selectedUser} selectedVersion={version} onSelectedVersionChange={onSelectedVersionChange} />
        </div>
      </div>
      <ResultFileList user={selectedUser} version={version} onOpenResult={onOpenResult} />
    </section>
  );
}

export default DashboardPage;