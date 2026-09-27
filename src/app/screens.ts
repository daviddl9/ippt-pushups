import type { Mode } from '../core/mode';
import { loadSessions } from '../store/history';
import { renderDebug } from '../ui/debug';
import { renderHistory } from '../ui/history';
import { renderHome } from '../ui/home';
import { renderLive } from '../ui/live';
import { renderSummary } from '../ui/summary';
import { startDebugScreen } from './debugScreen';
import type { AppDeps } from './deps';
import { startLiveScreen } from './liveScreen';
import { routeHash, type Route } from './routes';
import { photosFor } from './sessionPhotos';
import { analyzeUpload } from './uploadFlow';

const START_LINE = 'Get into position, side-on to the camera';
const NO_CLEANUP = () => {};

/** Renders the screen for a route into root; returns its cleanup. */
export function showScreen(route: Route, root: HTMLElement, deps: AppDeps): () => void {
  switch (route.name) {
    case 'live':
      return startLiveScreen(route.mode, renderLive(root, route.mode, deps.settings.camera), deps);
    case 'summary':
      renderSummary(root, loadSessions(deps.storage).find((s) => s.id === route.id), photosFor(route.id), (mode) => startSet(deps, mode));
      return NO_CLEANUP;
    case 'debug':
      return startDebugScreen(renderDebug(root), deps);
    case 'history':
      renderHistory(root, loadSessions(deps.storage));
      return NO_CLEANUP;
    case 'home':
      return showHome(root, deps);
  }
}

/** Must run inside a tap: the first spoken line unlocks speech on iOS. */
function startSet(deps: AppDeps, mode: Mode): void {
  deps.voice.say(START_LINE);
  deps.navigate(routeHash({ name: 'live', mode }));
}

function showHome(root: HTMLElement, deps: AppDeps): () => void {
  const view = renderHome(root, {
    startIppt: () => startSet(deps, 'ippt60'),
    startUntimed: () => startSet(deps, 'untimed'),
    upload: (file) =>
      void analyzeUpload(file, deps, view.showProgress).catch((error: unknown) =>
        view.showError(error instanceof Error ? error.message : String(error)),
      ),
  });
  return NO_CLEANUP;
}
