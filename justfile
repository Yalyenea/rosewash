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
    test -f dist/src/shared/pdf-open.js
    find dist -name .DS_Store -delete
    @echo "staged dist/ — Load unpacked this folder"

# Check, stage dist/, and zip it
package: check dist
    mkdir -p .tmp
    rm -f .tmp/rosewash.zip
    cd dist && zip -r ../.tmp/rosewash.zip . -x "*.DS_Store"

# Remove local debug artifacts (Chrome profiles, screenshots, logs)
clean:
    rm -rf .tmp .playwright-cli
