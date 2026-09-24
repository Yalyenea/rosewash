default:
    just --list

test:
    npm test

validate:
    npm run validate

check: test validate

# Stage a Chrome-loadable folder (manifest + html + src only)
dist:
    mkdir -p dist
    find dist -mindepth 1 -delete
    cp manifest.json popup.html options.html dist/
    cp -R src dist/src
    find dist -name .DS_Store -delete
    @echo "staged dist/ — Load unpacked this folder"

# Check, stage dist/, and zip it for the Chrome Web Store
package: check dist
    #!/usr/bin/env bash
    set -euo pipefail
    version="$(node -p "require('./package.json').version")"
    mkdir -p release
    rm -f "release/rosewash-v${version}.zip"
    cd dist && zip -r "../release/rosewash-v${version}.zip" . -x "*.DS_Store"
    echo "release/rosewash-v${version}.zip"

# Remove local debug artifacts (Chrome profiles, screenshots, logs)
clean:
    rm -rf .tmp .playwright-cli
