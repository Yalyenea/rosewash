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

# Check and package for one store: just package [chrome|edge|firefox]
package browser="chrome": check
    node scripts/dist.mjs "{{browser}}" --package

package-all: check
    node scripts/dist.mjs chrome --package
    node scripts/dist.mjs edge --package
    node scripts/dist.mjs firefox --package

# Remove local debug artifacts (Chrome profiles, screenshots, logs)
clean:
    rm -rf .tmp .playwright-cli
