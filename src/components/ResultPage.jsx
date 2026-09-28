function renderMarkdown(content) {
  return content.split("\n").map((line, index) => {
    if (line.startsWith("## ")) return <h2 key={index}>{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={index}>{line.slice(2)}</h1>;
    if (!line.trim()) return <div className="preview-space" key={index} />;
    return <p key={index}>{line}</p>;
  });
}

function ResultPage({ content, onBackToEditor }) {
  return (
    <section className="workspace-page result-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PREVIEW / UNTITLED</p>
          <h1>Your finished thought.</h1>
          <p className="heading-copy">A clean reading view of your document, ready to share or refine.</p>
        </div>
        <button className="secondary-button" onClick={onBackToEditor}><span aria-hidden="true">&#8592;</span> Back to editor</button>
      </div>

      <article className="result-card">
        <div className="result-meta"><span>UNTITLED.MD</span><span>PREVIEW</span></div>
        <div className="preview-content">{renderMarkdown(content)}</div>
        <div className="result-footer"><span>Monument workspace</span><span>Updated just now</span></div>
      </article>
    </section>
  );
}

export default ResultPage;