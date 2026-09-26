import { renderDebug } from '../ui/debug';
import { renderHome } from '../ui/home';
import { startDebugScreen } from './debugScreen';
import type { AppDeps } from './deps';
import type { Route } from './routes';

const NO_CLEANUP = () => {};

/** Renders the screen for a route into root; returns its cleanup. */
export function showScreen(route: Route, root: HTMLElement, deps: AppDeps): () => void {
  if (route.name === 'debug') return startDebugScreen(renderDebug(root), deps);
  renderHome(root);
  return NO_CLEANUP;
}
