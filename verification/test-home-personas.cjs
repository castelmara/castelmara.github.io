const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.match(/<script id="atlas-home-personalization">([\s\S]*?)<\/script>/)[1];
function node() {
  return { children: [], dataset: {}, textContent: '', querySelector() { return null; },
    replaceChildren(...items) { this.children = items; }, appendChild(item) { this.children.push(item); } };
}
const nodes = Object.fromEntries(['atlas-page-inicio', 'atlas-home-personal', 'atlasHomePersonalCopy', 'atlasHomePersonas'].map(id => [id, node()]));
const requests = [];
const window = { ATLAS_CURRENT_SESSION: { user: { id: 'A' } }, addEventListener() {},
  ATLAS_SUPABASE: { from() { const q = { select() { return q; }, eq() { return q; }, order() { return q; },
    limit() { return new Promise((resolve, reject) => requests.push({ resolve, reject })); } }; return q; } } };
vm.runInNewContext(source, { window, document: { getElementById: id => nodes[id], createElement: node, addEventListener() {} }, console, setTimeout, Set });
const render = window.atlasRenderHomePersonalization;
const response = (...ids) => ({ data: ids.map(character_id => ({ character_id, display_name: character_id })) });
const ids = () => nodes.atlasHomePersonas.children.map(n => n.dataset.homePersona);
(async () => {
  const old = render(), latest = render();
  requests[1].resolve(response('a', 'b', 'a')); await latest;
  assert.deepEqual(ids(), ['a', 'b'], 'Duplicate character IDs collapse');
  requests[0].resolve(response('old')); await old;
  assert.deepEqual(ids(), ['a', 'b'], 'Late response cannot append or overwrite');
  const early = render(), newer = render();
  requests[2].resolve(response('old')); await early;
  assert.deepEqual(ids(), [], 'Older response is ignored even if it resolves first');
  requests[3].resolve(response('a', 'b')); await newer;
  assert.deepEqual(ids(), ['a', 'b']);
  const failed = render(), success = render();
  requests[5].resolve(response('b')); await success;
  requests[4].reject(Error('Late failure')); await failed;
  assert.deepEqual(ids(), ['b'], 'Late failure cannot replace current content');
  const beforeLogout = render(); window.ATLAS_CURRENT_SESSION = null; await render();
  requests[6].resolve(response('a')); await beforeLogout;
  assert.equal(nodes['atlas-home-personal'].hidden, true);
  window.ATLAS_CURRENT_SESSION = { user: { id: 'B' } };
  const accountB = render(); requests[7].resolve(response('c')); await accountB;
  assert.deepEqual(ids(), ['c']);
  console.log('PASS home personas: overlapping requests in both orders, duplicate IDs, stale errors, logout, account switch');
})().catch(error => { console.error(error); process.exitCode = 1; });
