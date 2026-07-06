import type { LandingLocale, landingMessages } from './content';

type LandingCopy = (typeof landingMessages)[LandingLocale];

const androidReleaseUrl =
  'https://github.com/MichalMatu/local-climate-link-starter/releases/tag/v2.0.5';
const contactEmail = 'meehow939@gmail.com';
const privacyUrl = `${import.meta.env.BASE_URL}privacy.html`;

const navItems = (copy: LandingCopy) =>
  [
    { href: '#jak-dziala', label: copy.nav.howItWorks },
    { href: '#sprzet', label: copy.nav.hardware },
    { href: '#bezpieczenstwo', label: copy.nav.safety },
    { href: '#beta', label: copy.nav.beta }
  ] as const;

export const Header = ({ copy }: { copy: LandingCopy }) => (
  <header className="site-header">
    <a className="brand" href="#top" aria-label={copy.common.brand}>
      <span className="brand__mark" aria-hidden="true">
        L
      </span>
      <span>{copy.common.brand}</span>
    </a>
    <nav className="site-nav" aria-label={copy.nav.sectionsAria}>
      {navItems(copy).map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
    <a className="header-cta" href="#beta">
      {copy.common.betaCta}
    </a>
  </header>
);

export const HeroSection = ({ copy }: { copy: LandingCopy }) => (
  <section id="top" className="hero" aria-labelledby="hero-title">
    <div className="hero__content">
      <h1 id="hero-title">{copy.hero.title}</h1>
      <p>{copy.hero.body}</p>
      <div className="hero__actions" aria-label={copy.hero.actionsAria}>
        <a className="button button--primary" href="#beta">
          {copy.common.androidBetaCta}
        </a>
        <a className="button button--secondary" href="#sprzet">
          {copy.common.compatibilityCta}
        </a>
      </div>
    </div>
  </section>
);

export const WorkflowSection = ({ copy }: { copy: LandingCopy }) => (
  <section id="jak-dziala" className="section section--tight">
    <div className="section-heading">
      <h2>{copy.workflow.title}</h2>
      <p>{copy.workflow.body}</p>
    </div>
    <div className="step-grid">
      {copy.workflow.steps.map((step, index) => (
        <article className="step" key={step.title}>
          <span className="step__number">{index + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </article>
      ))}
    </div>
  </section>
);

export const HardwareSection = ({ copy }: { copy: LandingCopy }) => (
  <section id="sprzet" className="section section--split">
    <div className="section-heading section-heading--sticky">
      <h2>{copy.hardware.title}</h2>
      <p>{copy.hardware.body}</p>
    </div>
    <div className="hardware-list">
      {copy.hardware.items.map((item) => (
        <a
          className="hardware-row"
          href={item.href}
          key={item.name}
          rel="noreferrer"
          target="_blank"
        >
          <span>
            <strong>{item.name}</strong>
            <small>{item.role}</small>
          </span>
          <span>{item.detail}</span>
        </a>
      ))}
    </div>
  </section>
);

const AppPreviewSparkline = ({ points }: { points: string }) => (
  <svg
    className="app-sparkline"
    viewBox="0 0 100 32"
    aria-hidden="true"
    focusable="false"
  >
    <path d={points} />
  </svg>
);

export const AppPreview = ({ copy }: { copy: LandingCopy }) => (
  <div className="phone-preview" aria-label={copy.preview.aria}>
    <div className="phone-preview__bar" />
    <div className="phone-preview__screen">
      <div className="app-tabs" aria-hidden="true">
        <span>{copy.preview.tabs.shelly}</span>
        <span>{copy.preview.tabs.sensors}</span>
        <span>{copy.preview.tabs.rule}</span>
        <span>{copy.preview.tabs.diag}</span>
      </div>
      <div className="app-sensor-panel">
        <div className="app-add">{`+${copy.preview.addThermometer}`}</div>
        <article className="app-sensor-card">
          <div className="app-sensor-header">
            <h3>{copy.preview.sensorName}</h3>
            <span aria-hidden="true">⚙</span>
          </div>
          <div className="app-chart-stack">
            <div className="app-chart-card">
              <strong>24.7°C</strong>
              <AppPreviewSparkline points="M2 20 C12 17 18 21 28 18 S43 15 54 18 S70 12 86 17 S94 12 98 10" />
            </div>
            <div className="app-chart-card">
              <strong>44%</strong>
              <AppPreviewSparkline points="M2 19 C15 18 24 21 34 20 S51 17 61 13 S74 16 86 12 S94 13 98 15" />
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
);

export const SafetySection = ({ copy }: { copy: LandingCopy }) => (
  <section id="bezpieczenstwo" className="section safety-section">
    <div className="safety-copy">
      <h2>{copy.safety.title}</h2>
      <p>{copy.safety.body}</p>
      <ul className="safety-list">
        {copy.safety.safeguards.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
    <AppPreview copy={copy} />
  </section>
);

export const InstructionsSection = ({ copy }: { copy: LandingCopy }) => (
  <section className="section instruction-section" aria-labelledby="setup-title">
    <div className="section-heading">
      <h2 id="setup-title">{copy.instructions.title}</h2>
      <p>{copy.instructions.body}</p>
    </div>
    <ol className="instruction-list">
      {copy.instructions.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  </section>
);

export const BetaSection = ({ copy }: { copy: LandingCopy }) => (
  <section id="beta" className="section beta-section" aria-labelledby="beta-title">
    <div>
      <h2 id="beta-title">{copy.beta.title}</h2>
      <p>{copy.beta.body}</p>
    </div>
    <div className="beta-actions">
      <a
        className="button button--primary"
        href={androidReleaseUrl}
        rel="noreferrer"
        target="_blank"
      >
        {copy.beta.joinCta}
      </a>
      <a className="button button--secondary" href="#faq">
        {copy.common.faqCta}
      </a>
    </div>
  </section>
);

export const FaqSection = ({ copy }: { copy: LandingCopy }) => (
  <section id="faq" className="section faq-section" aria-labelledby="faq-title">
    <h2 id="faq-title">{copy.faq.title}</h2>
    <div className="faq-grid">
      {copy.faq.items.map((item) => (
        <article className="faq-item" key={item.question}>
          <h3>{item.question}</h3>
          <p>{item.answer}</p>
        </article>
      ))}
    </div>
  </section>
);

export const Footer = ({ copy }: { copy: LandingCopy }) => (
  <footer className="site-footer">
    <p>{copy.footer.tagline}</p>
    <div>
      <a
        href="https://github.com/pvvx/ATC_MiThermometer"
        rel="noreferrer"
        target="_blank"
      >
        PVVX
      </a>
      <a href="https://www.shelly.com/" rel="noreferrer" target="_blank">
        Shelly
      </a>
      <a href={privacyUrl}>{copy.footer.privacy}</a>
      <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
    </div>
  </footer>
);
