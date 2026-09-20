import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/i18n.js';
import { AppShell } from '../components/AppShell.js';
import { AppToastViewport } from '../components/AppToastViewport.js';

const noop = vi.fn();

describe('AppToastViewport', () => {
  it('portals an initial toast into the shell host without rendering it in page content', () => {
    render(
      <I18nProvider>
        <AppShell
          activeKind="climate"
          onOpenClimate={noop}
          onOpenTime={noop}
          onOpenSettings={noop}
        >
          <section className="demo-panel">
            <AppToastViewport
              autoDismissMs={0}
              dismissLabel="Zamknij"
              label="Powiadomienia"
              onDismiss={noop}
              toasts={[
                {
                  id: 'initial-toast',
                  tone: 'ok',
                  title: 'Gotowe'
                }
              ]}
            />
          </section>
        </AppShell>
      </I18nProvider>
    );

    expect(
      document.querySelector('#app-toast-host > .lcl-toast-viewport')
    ).not.toBeNull();
    expect(
      document.querySelector('.app-root-shell__content .lcl-toast-viewport')
    ).toBeNull();
  });
});
