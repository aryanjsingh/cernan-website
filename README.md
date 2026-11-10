# Cernan website

Static single-page site. No build step and no backend.

## Run locally

```sh
python3 -m http.server 4173
```

Then open http://localhost:4173. The 3D scenes use ES modules, so open it through a server rather than `file://`.

## Structure

- `index.html`: the page
- `assets/site.css`, `assets/site.js`: styles, navigation, reveals, operations console, contact form
- `assets/field.js`: three.js scenes (data field, security map, software ribbons, aurora bands)
- `assets/attention-*.js`, `assets/self-attention-model.js`: the hero's self-attention tree
- `assets/cards/`: card artwork
- `assets/vendor/`: three.js r170 and Lenis 1.1.20 (MIT, licences included)

## Not connected yet

The contact form validates input but has no endpoint. Point it at a form service or serverless function before launch.
