default:
    just --list

test:
    npm test

validate:
    npm run validate

check: test validate

# Stage an extension: just dist [chrome|edge|firefox]
dist browser="chrome":
    node scripts/dist.mjs "{{browser}}"

# Stage and reload the unpacked extension in Helium on macOS.
[positional-arguments]
reload url="": dist
    uv run --with pyobjc-framework-ApplicationServices python scripts/reload-helium.py "$1"

# Check and package for one store: just package [chrome|edge|firefox]
package browser="chrome": check
    node scripts/dist.mjs "{{browser}}" --package

# Stage Chromium frame themes for every tinted palette
themes:
    node scripts/themes.mjs

package-all: check
    node scripts/dist.mjs chrome --package
    node scripts/dist.mjs edge --package
    node scripts/dist.mjs firefox --package
    node scripts/themes.mjs --package

# Remove local debug artifacts (Chrome profiles, screenshots, logs)
clean:
    rm -rf .tmp .playwright-cli
