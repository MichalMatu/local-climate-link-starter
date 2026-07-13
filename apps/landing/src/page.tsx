import { useEffect, useState } from 'react';

import { landingMessages, resolveLandingLocale, type LandingLocale } from './content';
import {
  BetaSection,
  FaqSection,
  Footer,
  HardwareSection,
  Header,
  HeroSection,
  InstructionsSection,
  SafetySection,
  WorkflowSection
} from './sections';

type LandingPageProps = {
  initialLocale?: LandingLocale;
};

const updateMetaContent = (selector: string, content: string) => {
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (element) {
    element.content = content;
  }
};

const applyDocumentLocale = (locale: LandingLocale) => {
  const copy = landingMessages[locale];
  document.documentElement.lang = locale;
  document.title = copy.meta.title;
  updateMetaContent('meta[name="description"]', copy.meta.description);
  updateMetaContent('meta[property="og:title"]', copy.meta.title);
  updateMetaContent('meta[property="og:description"]', copy.meta.description);
};

export const LandingPage = ({
  initialLocale = resolveLandingLocale()
}: LandingPageProps = {}) => {
  const [locale, setLocale] = useState<LandingLocale>(initialLocale);
  const copy = landingMessages[locale];

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--landing-hero-image',
      `url("${import.meta.env.BASE_URL}assets/local-climate-hero.webp")`
    );
  }, []);

  useEffect(() => {
    const updateFromSystem = () => setLocale(resolveLandingLocale());
    window.addEventListener('languagechange', updateFromSystem);
    return () => window.removeEventListener('languagechange', updateFromSystem);
  }, []);

  return (
    <main>
      <Header copy={copy} />
      <HeroSection copy={copy} />
      <WorkflowSection copy={copy} />
      <HardwareSection copy={copy} />
      <SafetySection copy={copy} />
      <InstructionsSection copy={copy} />
      <BetaSection copy={copy} />
      <FaqSection copy={copy} />
      <Footer copy={copy} />
    </main>
  );
};
