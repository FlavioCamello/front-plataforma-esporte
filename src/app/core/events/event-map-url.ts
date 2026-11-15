import { EventAddress } from '../models/event.model';

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** UC-50 — `mapUrl` https ou busca no Google Maps pelo local + endereço. */
export function resolveMapUrl(
  mapUrl?: string | null,
  venueName?: string | null,
  address?: EventAddress | null
): string | null {
  const custom = mapUrl?.trim();
  if (custom && isHttpsUrl(custom)) {
    return custom;
  }

  const parts = [
    venueName,
    address?.street,
    address?.number,
    address?.neighborhood,
    address?.city,
    address?.state,
    address?.country,
  ]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);

  if (parts.length === 0) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}
