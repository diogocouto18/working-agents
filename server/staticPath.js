import { resolve, sep } from 'node:path';

export function resolveClientPath(clientRoot, rawUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  if (pathname === '/') pathname = '/index.html';
  const root = resolve(clientRoot);
  const filePath = resolve(root, '.' + pathname);
  return filePath.startsWith(root + sep) ? filePath : null;
}
