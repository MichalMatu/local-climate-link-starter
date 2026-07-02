import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@lcl/design-tokens/styles.css';
import '@lcl/ui/styles.css';
import './theme/theme.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.js';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found.');
}

if (import.meta.env.DEV) {
  void import('./app/devConsole.js').then(({ installDevConsole }) => {
    installDevConsole();
  });
}

createRoot(root).render(<App />);
