const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function timeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** UC-50 — “12 a 14 de jul” / “12 de jul · 08:00”. */
export function formatEventDateRange(
  startsAt?: string | null,
  endsAt?: string | null
): string {
  if (!startsAt) {
    return '';
  }

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return '';
  }

  const startMonth = MONTHS_PT[start.getMonth()];
  const startDay = `${start.getDate()} de ${startMonth}`;

  if (!endsAt) {
    return `${startDay} · ${timeOf(start)}`;
  }

  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) {
    return `${startDay} · ${timeOf(start)}`;
  }

  if (sameDay(start, end)) {
    if (end.getTime() === start.getTime()) {
      return `${startDay} · ${timeOf(start)}`;
    }
    return `${startDay} · ${timeOf(start)} – ${timeOf(end)}`;
  }

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()} a ${end.getDate()} de ${startMonth}`;
  }

  const endMonth = MONTHS_PT[end.getMonth()];
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} de ${startMonth} a ${end.getDate()} de ${endMonth}`;
  }

  return `${startDay} ${start.getFullYear()} a ${end.getDate()} de ${endMonth} ${end.getFullYear()}`;
}
