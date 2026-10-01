import coreAutomationImage from "../../CoreAutomationSolution.png";

function SplashScreen() {
  return (
    <section className="splash-screen" aria-label="test Automater splash screen">
      <img className="splash-image" src={coreAutomationImage} alt="Playwright browser test automation workspace" />
      <div className="splash-vignette" />
      <div className="splash-copy">
        <span className="splash-kicker">PLAYWRIGHT TEST WORKSPACE</span>
        <h1>test🛺Mater</h1>
        <p>Record browser steps, build Playwright tests, and review each run.</p>
        <p className="splash-playful-line">Automate with Playwright. Play right here.</p>
      </div>
      <div className="splash-loader" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}

export default SplashScreen;