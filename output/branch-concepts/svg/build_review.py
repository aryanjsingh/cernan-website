"""Build the standalone comparison without changing either source SVG."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent


def scoped_svg(filename, prefix):
    svg = (ROOT / filename).read_text()
    if 'role="img"' not in svg:
        svg = svg.replace('<svg ', '<svg role="img" aria-label="Original branch outline from Claude Code" ', 1)
    ids = set(re.findall(r'\bid="([^"]+)"', svg))
    svg = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{prefix}-{m[1]}"', svg)
    svg = re.sub(r'(href=")#([^"]+)', lambda m: m[1] + '#' + prefix + '-' + m[2], svg)
    svg = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{prefix}-{m[1]})', svg)
    svg = re.sub(r'(aria-labelledby|data-parent|data-branch)="([^"]*)"',
                 lambda m: m[1] + '="' + ' '.join(prefix + '-' + i if i in ids else i for i in m[2].split()) + '"', svg)
    return svg


if __name__ == '__main__':
    html = (ROOT / 'review-template.html').read_text()
    html = html.replace('__REFINED_SVG__', scoped_svg('tree-refined.svg', 'refined'))
    html = html.replace('__ORIGINAL_SVG__', scoped_svg('tree-7.svg', 'original'))
    (ROOT / 'review.html').write_text(html)
    print('Built review.html')
