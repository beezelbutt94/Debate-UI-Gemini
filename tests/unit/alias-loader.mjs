import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT_ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const tsPath = path.join(PROJECT_ROOT, rel + '.ts');
    return nextResolve(pathToFileURL(tsPath).href, context);
  }
  return nextResolve(specifier, context);
}
