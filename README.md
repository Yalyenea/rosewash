# Rosewash

Rosewash is a lightweight Manifest V3 browser extension that tints harsh white
web pages with restrained, curated color palettes. The current MVP ships with
Rose Pine Dawn and Moon.

The first version is intentionally small: it does not try to become a full
dynamic theme engine. It finds pure-white and near-white backgrounds, replaces
them with warm paper tones, adjusts neutral dark text, and leaves media and code
surfaces alone.

## Features

- Auto / Dawn / Moon mode.
- Global enable switch.
- Per-site block list.
- Near-white background and border tinting.
- Moon mode turns dark neutral text into Rose Pine Moon text, even when the
  text sits on a transparent child element.
- Media, canvas, SVG, inputs, editors, and code block protection.
- No runtime dependencies or build step.

## Screenshots

These examples use public pages captured from a fresh browser profile with no
personal account state.

| Site | Dawn | Moon |
| --- | --- | --- |
| [Wikipedia](https://en.wikipedia.org/wiki/Web_browser) | ![Rosewash Dawn on Wikipedia](docs/assets/screenshots/wikipedia-dawn.png) | ![Rosewash Moon on Wikipedia](docs/assets/screenshots/wikipedia-moon.png) |
| [GitHub Docs](https://docs.github.com/en/get-started/start-your-journey/hello-world) | ![Rosewash Dawn on GitHub Docs](docs/assets/screenshots/github-docs-dawn.png) | ![Rosewash Moon on GitHub Docs](docs/assets/screenshots/github-docs-moon.png) |
| [Python Docs](https://docs.python.org/3/tutorial/index.html) | ![Rosewash Dawn on Python Docs](docs/assets/screenshots/python-docs-dawn.png) | ![Rosewash Moon on Python Docs](docs/assets/screenshots/python-docs-moon.png) |
| [arXiv](https://arxiv.org/abs/1706.03762) | ![Rosewash Dawn on arXiv](docs/assets/screenshots/arxiv-dawn.png) | ![Rosewash Moon on arXiv](docs/assets/screenshots/arxiv-moon.png) |

## Install In Chromium

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked.
4. Select this project folder.

## Dev Loop

```sh
just test
just validate
just check
just package
```

`just package` writes `.tmp/rosewash.zip`.

## GitHub Release

GitHub Actions publishes a release zip whenever a version tag is pushed:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow runs `just package`, then uploads `rosewash-v0.1.0.zip` to the
matching GitHub Release. It can also be run manually against an existing tag
from the Actions tab.

After reloading the unpacked extension in `chrome://extensions`, reload any
already-open test tabs once. Chrome leaves old content scripts in existing page
contexts after extension reloads; Rosewash guards new scripts against that state
and clears stale Rosewash inline styles when the new script starts, but old
injected scripts cannot be patched in place.

## Palette

| Token | Dawn | Moon |
| --- | --- | --- |
| Base | `#faf4ed` | `#232136` |
| Surface | `#fffaf3` | `#2a273f` |
| Overlay | `#f2e9de` | `#393552` |
| Muted | `#9893a5` | `#6e6a86` |
| Text | `#575279` | `#e0def4` |

## Scope

Rosewash only changes the parts of a page that are likely to be eye-straining
white surfaces. Complex app-specific theme engines, filter inversion, and
site-specific rule packs are left for later versions. Future versions should add
more theme presets through a shared palette registry instead of site-specific or
theme-specific branches.

## License

MIT.
