const navItems = [
  { href: '#jak-dziala', label: 'Jak działa' },
  { href: '#sprzet', label: 'Sprzęt' },
  { href: '#bezpieczenstwo', label: 'Bezpieczeństwo' },
  { href: '#beta', label: 'Beta' }
] as const;

const workflowSteps = [
  {
    title: 'Aplikacja znajduje sprzęt',
    text: 'Skanujesz termometr BLE i sprawdzasz Shelly po lokalnym adresie IP.'
  },
  {
    title: 'Ustawiasz regułę',
    text: 'Wybierasz grzanie, chłodzenie, nawilżanie, osuszanie albo VPD w znanym zakresie wilgotności.'
  },
  {
    title: 'Shelly pracuje sam',
    text: 'Aplikacja wgrywa skrypt. Telefon może zniknąć z sieci, a automatyzacja działa lokalnie.'
  }
] as const;

const hardware = [
  {
    name: 'Shelly Plug S Gen3',
    role: 'lokalny przekaźnik i kontroler runtime',
    detail: 'Skrypt działa na stock firmware Shelly, bez Home Assistant i bez MQTT.',
    href: 'https://www.shelly.com/products/shelly-plug-s-gen3-1'
  },
  {
    name: 'Xiaomi LYWSD03MMC / PVVX',
    role: 'termometr BLE z BTHome v2',
    detail: 'Najlepszy profil MVP: lekki beacon BLE i stabilny parser po stronie Shelly.',
    href: 'https://github.com/pvvx/ATC_MiThermometer'
  },
  {
    name: 'TP357 custom BLE',
    role: 'drugi wspierany czujnik',
    detail: 'Osobny profil i parser dla użytkowników z gotowym beaconem TP357.',
    href: 'https://github.com/atc1441/ATC_MiThermometer'
  }
] as const;

const safeguards = [
  'Start i awaria czujnika ustawiają przekaźnik w OFF.',
  'Minimalny czas zmiany chroni przed szybkim pstrykaniem gniazdkiem.',
  'Diagnostyka pokazuje ostatni odczyt, RSSI, firmware Shelly i powód decyzji.'
] as const;

const faq = [
  {
    question: 'Czy telefon musi działać cały czas?',
    answer:
      'Nie. Telefon jest tylko konfiguratoriem. Po wgraniu reguły lokalny skrypt działa na Shelly.'
  },
  {
    question: 'Czy potrzebuję chmury albo Home Assistant?',
    answer:
      'Nie w domyślnym scenariuszu. Local Climate Link celowo omija huby, MQTT i serwer 24/7.'
  },
  {
    question: 'Czy to jest gotowe dla każdego sprzętu BLE?',
    answer:
      'Nie. MVP celowo wspiera wąską ścieżkę: Xiaomi/PVVX BTHome v2, TP357 i Shelly Plug S Gen3.'
  }
] as const;

const AppPreview = () => (
  <div className="phone-preview" aria-label="Podgląd aplikacji Local Climate Link">
    <div className="phone-preview__bar" />
    <div className="phone-preview__screen">
      <div className="app-tabs" aria-hidden="true">
        <span>Shelly</span>
        <span>Termometry</span>
        <span>Reguła</span>
      </div>
      <div className="app-card">
        <div>
          <p className="app-label">Odczyt</p>
          <strong>24.1°C · 55%</strong>
        </div>
        <span className="app-state">lokalnie</span>
      </div>
      <div className="app-rule">
        <span>Wilgotność poniżej 50%</span>
        <strong>ON</strong>
      </div>
      <div className="app-rule">
        <span>Wilgotność powyżej 60%</span>
        <strong>OFF</strong>
      </div>
      <div className="app-log">
        <span>lastSeen 8 s</span>
        <span>RSSI -58 dBm</span>
        <span>script OK</span>
      </div>
    </div>
  </div>
);

export const LandingPage = () => (
  <main>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Local Climate Link">
        <span className="brand__mark" aria-hidden="true">
          L
        </span>
        <span>Local Climate Link</span>
      </a>
      <nav className="site-nav" aria-label="Sekcje strony">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <a className="header-cta" href="#beta">
        Pobierz betę
      </a>
    </header>

    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero__content">
        <h1 id="hero-title">Termostat bez huba</h1>
        <p>
          Termometr BLE + gniazdko Shelly. Konfigurujesz raz w aplikacji, działa lokalnie
          bez chmury, MQTT i telefonu w tle.
        </p>
        <div className="hero__actions" aria-label="Główne akcje">
          <a className="button button--primary" href="#beta">
            Pobierz betę Android
          </a>
          <a className="button button--secondary" href="#sprzet">
            Zobacz kompatybilność
          </a>
        </div>
      </div>
    </section>

    <section id="jak-dziala" className="section section--tight">
      <div className="section-heading">
        <h2>Lokalna automatyzacja w trzech krokach</h2>
        <p>
          Aplikacja nie steruje klimatem w tle. Ona przygotowuje Shelly do samodzielnej
          pracy.
        </p>
      </div>
      <div className="step-grid">
        {workflowSteps.map((step, index) => (
          <article className="step" key={step.title}>
            <span className="step__number">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>

    <section id="sprzet" className="section section--split">
      <div className="section-heading section-heading--sticky">
        <h2>Wąska lista sprzętu, mniej zgadywania</h2>
        <p>
          MVP celowo wspiera mało urządzeń. Dzięki temu reguły, parser BLE i diagnostyka
          są testowane na konkretnym zestawie.
        </p>
      </div>
      <div className="hardware-list">
        {hardware.map((item) => (
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

    <section id="bezpieczenstwo" className="section safety-section">
      <div className="safety-copy">
        <h2>Projektowany pod realne gniazdko, nie demo w chmurze</h2>
        <p>
          Domyślny kierunek bezpieczeństwa to OFF. To ważne przy grzałkach, nawilżaczach i
          testach z prawdziwym obciążeniem.
        </p>
        <ul className="safety-list">
          {safeguards.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <AppPreview />
    </section>

    <section className="section instruction-section" aria-labelledby="setup-title">
      <div className="section-heading">
        <h2 id="setup-title">Instrukcja startu</h2>
        <p>
          Pierwsza wersja strony ma prowadzić do bety Android i testów sprzętu, zanim
          produkt trafi do sklepów.
        </p>
      </div>
      <ol className="instruction-list">
        <li>Wgraj PVVX/BTHome v2 albo użyj wspieranego TP357.</li>
        <li>Dodaj Shelly Plug S Gen3 z wyłączonym Matter dla Shelly Scripts.</li>
        <li>Ustaw regułę i wykonaj bezpieczny test przekaźnika.</li>
        <li>Podłącz docelowe urządzenie dopiero po poprawnym teście.</li>
      </ol>
    </section>

    <section id="beta" className="section beta-section" aria-labelledby="beta-title">
      <div>
        <h2 id="beta-title">Beta dla Androida i lista oczekujących</h2>
        <p>
          Najpierw testujemy APK i zestawy sprzętowe. Oficjalne sklepy dołączą, gdy
          zamkniemy checklistę release candidate.
        </p>
      </div>
      <div className="beta-actions">
        <a className="button button--primary" href="mailto:hello@localclimatelink.com">
          Dołącz do bety
        </a>
        <a className="button button--secondary" href="#faq">
          Pytania i odpowiedzi
        </a>
      </div>
    </section>

    <section id="faq" className="section faq-section" aria-labelledby="faq-title">
      <h2 id="faq-title">FAQ</h2>
      <div className="faq-grid">
        {faq.map((item) => (
          <article className="faq-item" key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </article>
        ))}
      </div>
    </section>

    <footer className="site-footer">
      <p>Local Climate Link — lokalny klimat bez huba.</p>
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
      </div>
    </footer>
  </main>
);
