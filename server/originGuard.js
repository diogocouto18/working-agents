export function allowedHosts(bindHost, port) {
  const hosts = new Set(['localhost', '127.0.0.1', '[::1]'].map((h) => `${h}:${port}`));
  if (bindHost && !['0.0.0.0', '::'].includes(bindHost)) hosts.add(`${bindHost}:${port}`);
  return hosts;
}

export function isRequestAllowed({ host, origin }, allowed) {
  if (!host || !allowed.has(host.toLowerCase())) return false;
  if (origin === undefined) return true;
  try {
    return allowed.has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}
