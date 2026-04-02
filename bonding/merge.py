import codecs

with codecs.open('app.js', 'r', 'utf-8') as f:
    js = f.read()

with codecs.open('index.html', 'r', 'utf-8') as f:
    html = f.read()

html = html.replace('<script type="module" src="app.js"></script>', f'<script type="module">\n{js}\n</script>')

with codecs.open('index.html', 'w', 'utf-8') as f:
    f.write(html)
