import coreAutomationImage from "../../CoreAutomationSolution.png";

function SplashScreen() {
  return (
    <section className="splash-screen" aria-label="Core Automation Solution splash screen">
      <img className="splash-image" src={coreAutomationImage} alt="Core Automation Solution" />
      <div className="splash-vignette" />
      <div className="splash-copy">
        <span className="splash-kicker">MES CORE TESTING</span>
        <h1>Core Automation Solution</h1>
        <p>Electron desktop shell with a React 19 interface, Vite runtime, local workspace editing, execution result browsing, and AWS-ready automation reporting.</p>
        <div className="splash-stack" aria-label="Framework stack">
          <span>Electron</span>
          <span>React</span>
          <span>Vite</span>
          <span>Workspace IO</span>
          <span>Result Viewer</span>
        </div>
      </div>
      <div className="splash-loader" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}

export default SplashScreen;