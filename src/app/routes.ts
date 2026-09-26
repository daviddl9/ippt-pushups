import type { Mode } from '../core/mode';

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'live'; readonly mode: Mode }
  | { readonly name: 'summary'; readonly id: string }
  | { readonly name: 'history' }
  | { readonly name: 'debug' };

const MODES: readonly string[] = ['ippt60', 'untimed'];

export function parseRoute(hash: string): Route {
  const [name, arg] = hash.replace(/^#\/?/, '').split('/');
  if (name === 'live' && MODES.includes(arg)) return { name, mode: arg as Mode };
  if (name === 'summary' && arg) return { name, id: decodeURIComponent(arg) };
  if (name === 'history' || name === 'debug') return { name };
  return { name: 'home' };
}

export function routeHash(route: Route): string {
  if (route.name === 'live') return `#/live/${route.mode}`;
  if (route.name === 'summary') return `#/summary/${encodeURIComponent(route.id)}`;
  return route.name === 'home' ? '#/' : `#/${route.name}`;
}
