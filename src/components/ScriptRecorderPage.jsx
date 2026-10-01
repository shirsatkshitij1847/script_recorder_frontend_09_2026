import CodeEditor from "./CodeEditor";

function escapeTemplateLiteral(value) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function getLocatorChoices(data) {
  return (data.xpathSuggestions || []).map((item) => [item.name, `page.locator(` + "`" + `xpath=${escapeTemplateLiteral(item.xpath)}` + "`" + `)`, item.why]);
}

function getActionChoices(data, locator) {
  const actions = [
    ["Click", `${locator}.click()`],
    ["Wait for visible", `${locator}.waitFor({ state: 'visible' })`],
    ["Assert visible", `expect(${locator}).toBeVisible()`],
  ];
  if (data.tagName === "INPUT" || data.tagName === "TEXTAREA") actions.splice(1, 0, ["Fill", `${locator}.fill('')`]);
  actions.push(...["Enter", "Tab", "Escape", "Backspace", "ArrowDown", "ArrowUp"].map((key) => [`Press ${key}`, `${locator}.press('${key}')`]));
  if (data.text) actions.push(["Assert text", `expect(${locator}).toContainText(${JSON.stringify(data.text)})`]);
  return actions;
}

function ScriptRecorderPage({ url, onUrlChange, code, onCodeChange, chooser, onChooseLocator, onChooseAction, onCloseChooser, isSelecting, onOpenUrl, onStartSelection }) {
  return (
    <section className="workspace-page recorder-page">
      <div className="page-heading recorder-heading">
        <div>
          <p className="eyebrow">PLAYWRIGHT / RECORDER</p>
          <h1>Script recorder</h1>
          <p className="heading-copy">Open a page, click elements, and build a Playwright script automatically.</p>
        </div>
      </div>

      <div className="recorder-toolbar">
        <input
          className="recorder-url-input"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onOpenUrl()}
          placeholder="https://example.com"
          aria-label="Page URL"
        />
        <button className="primary-button" onClick={onOpenUrl}>Open</button>
        <button className={`secondary-button ${isSelecting ? "recorder-selecting" : ""}`} onClick={onStartSelection}>
          {isSelecting ? "Selecting..." : "Select element"}
        </button>
      </div>

      <div className="recorder-card editor-card">
        <CodeEditor value={code} onChange={(event) => onCodeChange(event.target.value)} language="javascript" placeholder="Recorded steps will appear here..." />
      </div>

      {chooser ? (
        <div className="recorder-chooser-overlay">
          <div className="recorder-chooser-dialog">
            <span className="new-file-kicker">RECORDER</span>
            <h3>{chooser.step === "locator" ? "Choose locator" : "Choose action"}</h3>
            <p className="recorder-chooser-subtitle">
              &lt;{chooser.data.tagName?.toLowerCase()}&gt; {chooser.data.text || chooser.data.placeholder || chooser.data.testId || "Selected element"}
            </p>
            <div className="recorder-chooser-options">
              {(chooser.step === "locator" ? getLocatorChoices(chooser.data) : getActionChoices(chooser.data, chooser.locator)).map(([name, value, why], index) => (
                <button
                  key={`${name}-${index}`}
                  type="button"
                  className={`recorder-choice ${index === 0 ? "recommended" : ""}`}
                  onClick={() => (chooser.step === "locator" ? onChooseLocator(value) : onChooseAction(value))}
                >
                  <span className="recorder-choice-name">{name}</span>
                  <span className="recorder-choice-code">{value}</span>
                  {why ? <span className="recorder-choice-why">{why}</span> : null}
                </button>
              ))}
            </div>
            <div className="new-file-actions">
              <button className="cancel-button" type="button" onClick={onCloseChooser}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ScriptRecorderPage;
