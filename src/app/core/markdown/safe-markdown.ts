/**
 * UC-45 — markdown limitado, sem HTML cru e sem `window`.
 * Textos puros (legado) saem como parágrafos.
 */
export function renderSafeMarkdown(source: string | null | undefined): string {
  if (!source?.trim()) {
    return '';
  }

  const lines = escapeHtml(source.replace(/\r\n/g, '\n')).split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^#{1,3} /.test(line)) {
      blocks.push(`<h3>${formatInline(line.replace(/^#{1,3} /, ''))}</h3>`);
      index += 1;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index])) {
        items.push(`<li>${formatInline(lines[index].replace(/^[-*] /, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(`<li>${formatInline(lines[index].replace(/^\d+\. /, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,3} /.test(lines[index]) &&
      !/^[-*] /.test(lines[index]) &&
      !/^\d+\. /.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${formatInline(paragraph.join('<br>'))}</p>`);
  }

  return blocks.join('');
}

export function markdownToPlainText(source: string | null | undefined): string {
  if (!source?.trim()) {
    return '';
  }
  return source
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*#_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatInline(text: string): string {
  const withLinks = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, rawUrl: string) => {
    const href = sanitizeHref(unescapeHtml(rawUrl));
    return href
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
  });

  return withLinks
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
}

function sanitizeHref(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') {
      return null;
    }
    return escapeHtml(url.href);
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
