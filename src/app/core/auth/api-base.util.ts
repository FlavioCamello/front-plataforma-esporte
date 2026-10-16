/** Remove barras finais — contrato: `apiUrl` sem `/` no final (evita `//api/...`). */
export function normalizeApiBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
