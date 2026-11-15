import { markdownToPlainText, renderSafeMarkdown } from './safe-markdown';

describe('renderSafeMarkdown', () => {
  it('keeps plain text as a paragraph', () => {
    expect(renderSafeMarkdown('Corrida no parque.')).toBe('<p>Corrida no parque.</p>');
  });

  it('escapes raw HTML and script payloads', () => {
    const html = renderSafeMarkdown('<script>alert(1)</script> **ok**');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<strong>ok</strong>');
  });

  it('keeps only https links and drops javascript urls', () => {
    const html = renderSafeMarkdown(
      'Veja [site](https://www.participando.com.br) e [x](javascript:alert(1))'
    );
    expect(html).toContain(
      '<a href="https://www.participando.com.br/" target="_blank" rel="noopener noreferrer">site</a>'
    );
    expect(html).not.toContain('javascript:');
    expect(html).toContain('e x');
  });

  it('renders lists and headings', () => {
    const html = renderSafeMarkdown('## Premiação\n- 1º lugar\n- 2º lugar');
    expect(html).toContain('<h3>Premiação</h3>');
    expect(html).toContain('<ul><li>1º lugar</li><li>2º lugar</li></ul>');
  });

  it('strips markup for SEO plain text', () => {
    expect(markdownToPlainText('**Noite** no [parque](https://exemplo.com)')).toBe(
      'Noite no parque'
    );
  });
});
