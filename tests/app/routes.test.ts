import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from '../../src/app/routes';

const ROUTES: Route[] = [
  { name: 'home' },
  { name: 'live', mode: 'ippt60' },
  { name: 'live', mode: 'untimed' },
  { name: 'summary', id: '2026-09-26T09:00:00.000Z' },
  { name: 'history' },
  { name: 'debug' },
];

describe('routes', () => {
  it.each(ROUTES)('round-trips %j', (route) => {
    expect(parseRoute(routeHash(route))).toEqual(route);
  });

  it.each(['', '#', '#/', '#/nope', '#/live/bogus', '#/summary'])('treats %j as home', (hash) => {
    expect(parseRoute(hash)).toEqual({ name: 'home' });
  });
});
