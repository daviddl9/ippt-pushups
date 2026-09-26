import type { AppDeps } from './app/deps';
import { parseRoute } from './app/routes';
import { showScreen } from './app/screens';
import { readSettings } from './app/settings';
import { createVoice } from './io/voice';
import './ui/styles.css';

const root = document.getElementById('app')!;
const deps: AppDeps = {
  get settings() {
    return readSettings(location.search, localStorage);
  },
  voice: createVoice(),
  storage: localStorage,
  navigate: (hash) => {
    location.hash = hash;
  },
  refresh: () => render(),
};

let cleanup = () => {};
function render(): void {
  cleanup();
  root.replaceChildren();
  cleanup = showScreen(parseRoute(location.hash), root, deps);
}

window.addEventListener('hashchange', render);
render();
