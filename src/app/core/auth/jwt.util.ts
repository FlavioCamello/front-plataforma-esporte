interface JwtPayload {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  account_type?: string;
  profile_complete?: string;
  exp?: number;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Token sem `exp` (mock de dev) não expira. Os demais vencem 30s antes do prazo. */
export function isAccessTokenExpired(token: string, nowMs = Date.now()): boolean {
  const exp = decodeJwtPayload(token)?.exp;
  if (typeof exp !== 'number') {
    return false;
  }
  return exp * 1000 <= nowMs + 30_000;
}
