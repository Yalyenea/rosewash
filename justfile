default:
    just --list

test:
    npm test

validate:
    npm run validate

check: test validate

package: check
    mkdir -p .tmp
    rm -f .tmp/rosewash.zip
    zip -r .tmp/rosewash.zip manifest.json popup.html options.html src -x "*.DS_Store"
