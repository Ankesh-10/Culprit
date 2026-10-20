import './styles.css';
import { mountApp } from './ui/app';
import { mountLanding } from './ui/landing';
import { mountRouter } from './ui/router';
import type { Router } from './ui/router';

// The router does not exist yet while the views mount; both callbacks run only after a user action.
let router: Router | null = null;

const consoleApi = mountApp(document, { onOpenConsole: () => router?.navigate('app') });
const landing = mountLanding(document, {
  onTryCase: (id) => {
    router?.navigate('app');
    consoleApi.loadCase(id);
  },
});

router = mountRouter(document, {
  onEnter: (route) => {
    if (route === 'app') {
      landing.hide();
      consoleApi.activate();
    } else {
      consoleApi.deactivate();
      landing.show();
    }
  },
});
