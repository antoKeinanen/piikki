"""Build the offline HTML guide from docs/usage-guide.md using only Python's standard library."""

import base64
import html
from pathlib import Path
import re
import struct

DOCS = Path(__file__).resolve().parent.parent
source = DOCS / 'usage-guide.md'
image_count = 0
headings = []
parts = []


def inline(text):
    text = html.escape(text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)


for block in re.split(r'\n\s*\n', source.read_text().strip()):
    if block.startswith('# '):
        parts.append(f'<h1>{inline(block[2:])}</h1>')
    elif block.startswith('## '):
        title = block[3:]
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        headings.append((slug, title))
        parts.append(f'<h2 id="{slug}">{inline(title)}</h2>')
    elif match := re.fullmatch(r'!\[([^\]]*)\]\(([^)]+)\)', block):
        alt, relative = match.groups()
        path = DOCS / relative
        data = path.read_bytes()
        assert data.startswith(b'\x89PNG\r\n\x1a\n'), path
        width, height = struct.unpack('>II', data[16:24])
        small = ' class="mobile"' if width < 1000 else ''
        encoded = base64.b64encode(data).decode()
        parts.append(f'<figure{small}><img width="{width}" height="{height}" alt="{html.escape(alt)}" src="data:image/png;base64,{encoded}"></figure>')
        image_count += 1
    elif re.match(r'^\d+\. ', block):
        items = [re.sub(r'^\d+\. ', '', line) for line in block.splitlines()]
        parts.append('<ol>' + ''.join(f'<li>{inline(item)}</li>' for item in items) + '</ol>')
    else:
        parts.append(f'<p>{inline(block)}</p>')

assert image_count == 16, f'Expected 16 images, found {image_count}'
nav = '<details class="contents"><summary>Jump to a section</summary><ul>' + ''.join(f'<li><a href="#{slug}">{html.escape(title)}</a></li>' for slug, title in headings) + '</ul></details>'
parts.insert(2, nav)
css = '''
:root { color-scheme: light dark; font-family: var(--font-sans, system-ui, sans-serif); }
html,body { margin:0; }
body { color:var(--foreground, #232522); line-height:1.65; }
main { max-width:960px; margin:0 auto; }
h1 { font-size:30px; line-height:1.2; margin:24px 0; }
h2 { font-size:22px; line-height:1.35; margin:56px 0 20px; scroll-margin-top:20px; }
p { margin:16px 0; }
li { margin:10px 0; }
figure { margin:24px 0; }
figure.mobile { max-width:390px; }
img { display:block; width:100%; height:auto; }
code { background:var(--code-background, #8882); padding:1px 4px; border-radius:3px; }
a { color:var(--primary, #3549d8); }
.contents { border-bottom:1px solid var(--border, #8885); padding:16px 0; }
summary { cursor:pointer; }
@media print { :root { color-scheme:light; } h2 { break-before:page; } img { max-height:60vh; object-fit:contain; object-position:left; } .contents { display:none; } }
'''
output = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Customer balance app usage guide</title><style>' + css + '</style></head><body><main>' + '\n'.join(parts) + '</main></body></html>'
(DOCS / 'usage-guide.html').write_text(output)
print(f'Built docs/usage-guide.html with {image_count} embedded screenshots and {len(headings)} sections.')
