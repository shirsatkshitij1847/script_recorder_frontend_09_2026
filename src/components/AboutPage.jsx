import { useEffect, useState } from "react";

const workflowImages = {
  setup: `${import.meta.env.BASE_URL}userCreationImage.png`,
  writer: `${import.meta.env.BASE_URL}scriptRecorder.png`,
  results: `${import.meta.env.BASE_URL}ResultViwer.png`,
};

function AboutPage({ onNavigate }) {
  const [expandedImage, setExpandedImage] = useState(null);

  useEffect(() => {
    if (!expandedImage) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setExpandedImage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expandedImage]);

  return (
    <section className="about-page workspace-page">
      <header className="about-hero">
        <div className="about-hero-copy">
          <span className="eyebrow">YOUR TESTING WORKFLOW / 01—03</span>
          <h1>From setup to test insight.</h1>
          <p>Choose a user, create its release version, write your Playwright script, then review a completed run. Follow the steps below in order.</p>
          <div className="about-hero-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate("home")}>Set up your workspace <span className="about-button-icon" aria-hidden="true">&#8594;</span></button>
            <button className="secondary-button" type="button" onClick={() => onNavigate("recorder")}>Write a script <span className="about-button-icon" aria-hidden="true">&#8599;</span></button>
          </div>
        </div>
        <ol className="about-route" aria-label="Workflow overview">
          <li><span>01</span><div><strong>Set up</strong><small>Create or choose a user and version</small></div></li>
          <li><span>02</span><div><strong>Write</strong><small>Record and edit Playwright steps</small></div></li>
          <li><span>03</span><div><strong>Review</strong><small>Open the report or trace for a run</small></div></li>
        </ol>
      </header>

      <ol className="about-visual-flow" aria-label="Testing workflow">
        <li className="about-visual-step setup-visual-step">
          <span className="about-visual-kicker"><b>01</b> GET READY</span>
          <figure>
            <button className="about-image-trigger" type="button" aria-label="View larger: User and release version setup screen" onClick={() => setExpandedImage({ src: workflowImages.setup, alt: "User and release version setup screen" })}>
              <img src={workflowImages.setup} alt="" />
            </button>
            <figcaption><strong>User + version</strong><span>Choose who owns the run, then create its release version.</span></figcaption>
          </figure>
        </li>
        <li className="about-visual-step writer-visual-step">
          <span className="about-visual-kicker"><b>02</b> BUILD THE TEST</span>
          <figure>
            <button className="about-image-trigger" type="button" aria-label="View larger: Playwright Script Writer screen" onClick={() => setExpandedImage({ src: workflowImages.writer, alt: "Playwright Script Writer screen" })}>
              <img src={workflowImages.writer} alt="" />
            </button>
            <figcaption><strong>Script Writer</strong><span>Capture browser steps and shape them into a test.</span></figcaption>
          </figure>
        </li>
        <li className="about-visual-step results-visual-step">
          <span className="about-visual-kicker"><b>03</b> SEE WHAT HAPPENED</span>
          <figure>
            <button className="about-image-trigger" type="button" aria-label="View larger: Test result viewer screen" onClick={() => setExpandedImage({ src: workflowImages.results, alt: "Test result viewer screen" })}>
              <img src={workflowImages.results} alt="" />
            </button>
            <figcaption><strong>Result Viewer</strong><span>Open a report or trace and inspect the run.</span></figcaption>
          </figure>
        </li>
      </ol>

      <section className="about-setup-section" aria-labelledby="about-setup-heading">
        <div className="about-section-heading">
          <div><span className="panel-kicker">STEP 01 / SET YOUR CONTEXT</span><h2 id="about-setup-heading">Choose a user. Then create a version.</h2></div>
          <p>A release version belongs to a user. Create or select the user before adding its version.</p>
        </div>

        <div className="about-setup-grid">
          <article className="about-setup-step">
            <span className="about-setup-index">01</span>
            <div><h3>Create or choose a user</h3><p>On Home, choose a name under Available users. To add one, enter a User name and select Create user. That user becomes active.</p></div>
          </article>
          <article className="about-setup-step">
            <span className="about-setup-index">02</span>
            <div><h3>Create that user’s release version</h3><p>Under Create Release Version, select the user, enter a Release version name, and select Create release version.</p></div>
          </article>
        </div>
        <div className="about-setup-footer">
          <span><strong>Use the same pair later.</strong> You’ll need this user and release version to find the run in Results.</span>
          <button className="primary-button" type="button" onClick={() => onNavigate("home")}>Open setup <span className="about-button-icon" aria-hidden="true">&#8599;</span></button>
        </div>
      </section>

      <section className="about-guide-section" aria-labelledby="about-tools-heading">
        <div className="about-section-heading">
          <div><span className="panel-kicker">STEPS 02 + 03 / MAKE AND REVIEW</span><h2 id="about-tools-heading">Write the test. Inspect the run.</h2></div>
          <p>The Script Writer prepares editable code; it does not execute tests. Run your test separately before opening its results.</p>
        </div>

        <div className="about-guide-grid">
          <article className="about-guide-panel about-writer-panel">
            <div className="about-panel-meta"><span>02 / WRITE</span><span>PLAYWRIGHT</span></div>
            <h3>Script Writer</h3>
            <p className="about-panel-intro">Turn browser actions into editable Playwright code.</p>
            <ol className="about-step-list">
              <li><strong>Open your application</strong><span>Enter its URL and select Open. The page opens in Chrome.</span></li>
              <li><strong>Pick an element</strong><span>Select Select element, then click the outlined item in Chrome.</span></li>
              <li><strong>Choose a locator and action</strong><span>Choose a unique XPath, then select an action such as Click, Fill, or Press Enter.</span></li>
              <li><strong>Review the script</strong><span>Edit the generated code in the writer. Run it separately with your test setup.</span></li>
            </ol>
            <button className="about-text-action" type="button" onClick={() => onNavigate("recorder")}>Open Script Writer <span className="about-button-icon" aria-hidden="true">&#8594;</span></button>
          </article>

          <article className="about-guide-panel about-results-panel">
            <div className="about-panel-meta"><span>03 / REVIEW</span><span>REPORTS + TRACES</span></div>
            <h3>Result Viewer</h3>
            <p className="about-panel-intro">Find a completed run, then inspect its report or browser trace.</p>
            <ol className="about-step-list">
              <li><strong>Open Results</strong><span>Choose the same user and release version you used for the run.</span></li>
              <li><strong>Choose the test run</strong><span>Select the matching execution from the available results.</span></li>
              <li><strong>Inspect what happened</strong><span>Open HTML Report for results or Trace Viewer for browser actions. Select Refresh to reload.</span></li>
            </ol>
            <button className="about-text-action" type="button" onClick={() => onNavigate("results")}>Open Results <span className="about-button-icon" aria-hidden="true">&#8594;</span></button>
          </article>
        </div>
      </section>

      {expandedImage ? (
        <div className="about-image-lightbox" onClick={() => setExpandedImage(null)}>
          <div className="about-image-dialog" role="dialog" aria-modal="true" aria-label={expandedImage.alt} onClick={(event) => event.stopPropagation()}>
            <button className="about-image-close" type="button" autoFocus aria-label="Close enlarged image" onClick={() => setExpandedImage(null)}>&times;</button>
            <img src={expandedImage.src} alt={expandedImage.alt} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AboutPage;