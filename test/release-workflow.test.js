import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname;
const workflow = await readFile(join(root, ".github/workflows/release.yml"), "utf8");
const lines = workflow.split("\n");
const start = lines.findIndex((line) => line.includes("- name: Select store uploads"));
const run = lines.findIndex((line, index) => index > start && line === "        run: |");
assert.ok(start >= 0 && run > start, "release workflow must select store uploads");
const scriptLines = [];
for (const line of lines.slice(run + 1)) {
  if (!line.startsWith("          ") && line.trim()) break;
  scriptLines.push(line.slice(10));
}
const script = scriptLines.join("\n");

async function fixture(t) {
  await mkdir(join(root, ".tmp"), { recursive: true });
  const directory = await mkdtemp(join(root, ".tmp/release-workflow-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repo = join(directory, "repo.git");
  // A local bare clone tests real tag objects without changing release refs.
  const clone = spawnSync("git", ["clone", "--bare", "--shared", "--quiet", root, repo], { encoding: "utf8" });
  assert.ifError(clone.error);
  assert.equal(clone.status, 0, clone.stderr);
  const git = (...args) => {
    const result = spawnSync("git", [
      "-c", "user.name=Release tests", "-c", "user.email=tests@rosewash.invalid",
      "-c", "tag.gpgSign=false", ...args
    ], { cwd: repo, encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  };
  let counter = 0;
  const route = async (event, tag, store = "") => {
    const output = join(directory, `output-${counter++}`);
    await writeFile(output, "");
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script], {
      cwd: repo, encoding: "utf8",
      env: { ...process.env, EVENT_NAME: event, TAG_NAME: tag, STORE_INPUT: store, GITHUB_OUTPUT: output }
    });
    return { ...result, output: (await readFile(output, "utf8")).trim() };
  };
  return { git, route, directory };
}

test("tag annotations can skip every store and unreadable tags stop release routing", async (t) => {
  const { git, route, directory } = await fixture(t);
  git("tag", "-a", "fixture-skip", "-m", "GitHub archives only\n\n[skip stores]");
  git("tag", "-a", "fixture-normal", "-m", "Normal release");
  git("tag", "-a", "fixture-prose", "-m", "Mention [skip stores] in prose");
  // Files avoid Linux's per-argument size limit for large annotations.
  const annotationFile = join(directory, "long-annotation.txt");
  await writeFile(annotationFile, `${"Release notes\n".repeat(10000)}\n[skip stores]`);
  git("tag", "-a", "fixture-long", "-F", annotationFile);
  git("tag", "fixture-lightweight");
  for (const [tag, expected] of [
    ["fixture-skip", "none"], ["fixture-long", "none"], ["fixture-normal", "all"],
    ["fixture-prose", "all"], ["fixture-lightweight", "all"]
  ]) {
    const result = await route("push", tag);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, `store=${expected}`, tag);
  }
  const missing = await route("push", "fixture-missing");
  assert.notEqual(missing.status, 0);
  assert.equal(missing.output, "");
});

test("manual releases retain explicit store choices without reading tag annotations", async (t) => {
  const { route } = await fixture(t);
  for (const store of ["none", "chrome", "edge", "firefox", "all"]) {
    const result = await route("workflow_dispatch", "fixture-missing", store);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, `store=${store}`);
  }
  const invalid = await route("workflow_dispatch", "fixture-missing", "invalid");
  assert.notEqual(invalid.status, 0);
  assert.equal(invalid.output, "");
});

test("every store job uses the resolved release output and skips when it is none", () => {
  assert.match(workflow, /store: \$\{\{ steps\.stores\.outputs\.store \}\}/);
  for (const job of ["chrome", "edge", "firefox"]) {
    const section = workflow.slice(workflow.indexOf(`\n  ${job}:\n`));
    assert.match(section, /needs: release/);
    const condition = section.match(/^    if: \$\{\{ (.+) \}\}$/m)?.[1];
    assert.ok(condition, `${job} must have a store condition`);
    for (const store of ["none", "chrome", "edge", "firefox", "all"]) {
      const enabled = vm.runInNewContext(condition, { needs: { release: { outputs: { store } } } });
      assert.equal(enabled, store === "all" || store === job, `${job}: ${store}`);
    }
  }
});
