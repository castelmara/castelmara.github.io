const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const source = read('assets/atlas-mood.js');
const migration = read('supabase/migrations/20261008024708_atlas_mood_variety.sql');
const seed = JSON.parse(migration.split('$moods$')[1]);
const oldTitles = [...source.matchAll(/^    '([^']+)':/gm)].map(m => m[1]);
assert.equal(seed.length, 300);
assert.equal(new Set(seed.map(row => row.phrase)).size, 300);
assert(seed.every(row => row.explanation.trim() && !oldTitles.includes(row.phrase)));
const restored = JSON.parse(migration.split('$explanations$')[1]);
assert.equal(restored.length, 11);
assert(restored.every(row => oldTitles.includes(row.phrase) && row.explanation.trim()));

function browser(user, rpc) {
  const elements = Object.fromEntries(['atlasMoodDate', 'atlasMoodResult', 'atlasMoodExplain'].map(id => [id, {
    textContent: '', children: [], replaceChildren() { this.children = []; },
    append(...nodes) { this.children.push(...nodes); }
  }]));
  const events = {};
  const window = {
    ATLAS_CURRENT_SESSION: { user: { id: user } },
    ATLAS_SUPABASE: { rpc },
    addEventListener: (event, fn) => { events[event] = fn; }
  };
  vm.runInNewContext(source, {
    window, document: { getElementById: id => elements[id], createElement: () => ({ textContent: '' }), addEventListener() {} },
    Intl, Date, setTimeout, clearTimeout, setInterval() {}
  });
  return { window, elements, events };
}

(async () => {
  let calls = 0;
  const response = { data: [{ phrase: seed[0].phrase, explanation: seed[0].explanation }] };
  const first = browser('A', async () => { calls++; return response; });
  await first.window.atlasRenderMoodCheck();
  assert(first.elements.atlasMoodExplain.textContent.startsWith(seed[0].explanation));
  await first.window.atlasRenderMoodCheck();
  assert.equal(calls, 1, 'Same-day cache does not request a new draw');
  const second = browser('A', async () => response);
  await second.window.atlasRenderMoodCheck();
  assert.equal(second.elements.atlasMoodResult.children[1].textContent, first.elements.atlasMoodResult.children[1].textContent);
  const guest = browser('', () => { throw Error('Guest must not draw'); });
  await guest.window.atlasRenderMoodCheck();
  assert.match(guest.elements.atlasMoodResult.children[1].textContent, /войдите/);

  let finish;
  const stale = browser('A', () => new Promise(resolve => { finish = resolve; }));
  const pending = stale.window.atlasRenderMoodCheck();
  stale.window.ATLAS_CURRENT_SESSION = null;
  stale.events.atlasPlayerAuthReady();
  finish(response);
  await pending;
  assert.match(stale.elements.atlasMoodResult.children[1].textContent, /войдите/, 'Old account response cannot replace guest state');
  const malicious = browser('A', async () => ({ data: [{ phrase: '<img onerror=boom>', explanation: '<script>boom</script>' }] }));
  await malicious.window.atlasRenderMoodCheck();
  assert.equal(malicious.elements.atlasMoodResult.children[1].textContent, '<img onerror=boom>');
  assert(malicious.elements.atlasMoodExplain.textContent.startsWith('<script>boom</script>'), 'Explanation is assigned as plain text');
  console.log('PASS mood: 300 unique additions, 11 restorations, server explanations, daily cache, second browser, guest, stale response, plain text');
})().catch(error => { console.error(error); process.exitCode = 1; });
