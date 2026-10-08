const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const targets = [...html.matchAll(/<details class="foro-rules-item atlas-search-target" id="([^"]+)"\s+data-search-title="([^"]+)"\s+data-search-keywords="([^"]+)"/g)].map(([, id, title, keywords]) => ({
  id, textContent: title, getAttribute: name => name === 'data-search-title' ? title : keywords,
  closest: () => null, matches: selector => selector === 'details', querySelector: () => null,
  style: {}, scrollIntoView() { this.scrolled = true; }
}));
assert.equal(targets.length, 5);
let mounted = false, opened;
const results = {};
const page = { id: 'atlas-page-foro', querySelector: () => null, querySelectorAll: () => targets };
const template = { getAttribute: () => 'foro', content: { querySelectorAll: () => targets } };
const context = { window: { ATLAS_CHARACTERS: [] }, document: {
  querySelectorAll: selector => selector.startsWith('template') ? [template] : mounted ? [page] : [],
  getElementById: id => id === 'atlasSearchResults' ? results : mounted ? targets.find(t => t.id === id) : null
}, openPage(name) { opened = name; mounted = true; }, setTimeout(fn) { fn(); } };
const search = html.slice(html.indexOf('  function shouldSkipSearchTarget('), html.indexOf('  function renderSearch('));
const pick = html.slice(html.indexOf('  function handleSearchPick('), html.indexOf('  function toggleTopButton('));
vm.runInNewContext(search + pick, context);
const before = context.collectSearchItems().filter(item => item.title.includes('правила'));
assert.equal(before.length, 5, 'Rules found before foro is mounted');
results._atlasMatches = before;
context.handleSearchPick(0);
assert.equal(opened, 'foro');
assert.equal(targets[0].open, true, 'Chosen rule expands');
assert.equal(targets[0].scrolled, true, 'Chosen rule scrolls into view');
assert.equal(context.collectSearchItems().filter(item => item.title.includes('правила')).length, 5, 'Mounted page does not duplicate template results');
console.log('PASS rules search: unopened templates, five rule anchors, navigation, expansion, scroll, deduplication');
