const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {load} = require('./test-courses.cjs');

const base = path.join(__dirname, '..');
const ids = `maylo-barrios cayetana-rivas-alonso laurence-abernethy dietrich-otto-van-dijk theodor-arden annike-vermeer ricardo-montes havana-byeol-marin nana-nishimura nael-benali virginia-georgia-benali juliette-valcourt veronica-munoz jia-song edgar-castelo domingo-raul-barboza magnus-falk anton-sokolskikh sam-yamazaki emmett-osborne roberta-alicia-suarez elizabeth-kaplan magdalena-lanvin alberto-bonaventura ruby-wright samantha-grey mallory-falcone valentine-varela edmond-atticus-deschamps vittoria-moretti candela-varela roxanne-pierce leopoldo-dante-raventos christopher-torres-diaz arthur-takagi cameron-ashford luca-valenti evan-morrow nora-aguilar matthias-abel`.split(' ');
assert.equal(ids.length, 40);

const {all, records} = load();
for (const id of ids) {
  const matches = records.filter(record => record.id === id);
  assert.equal(matches.length, 1, `${id}: exactly one directory card`);
  const record = matches[0];
  assert.equal(record.existing, 'new', `${id}: card-only profile`);
  assert.ok(record.name && record.nameRu && record.face && record.category, `${id}: required metadata`);
  assert.ok(fs.existsSync(path.join(base, record.image)), `${id}: image exists (${record.image})`);
}

assert.equal(all.some(character => character.id === 'veronica-andrade'), false, 'Veronica Andrade removed');
const byId = id => all.find(character => character.id === id);
const pablo = byId('pablo-de-longa');
assert.equal(pablo.status, 'active');
assert.equal(pablo.player?.id, 'sofya-shtangey');
assert.equal(pablo.cardImage, 'assets/media-originals/61a131396606661bbc31d17d.jpg');
assert.equal(records.find(record => record.id === 'pablo-de-longa').existing, 'full');
assert.ok(fs.existsSync(path.join(base, pablo.cardImage)));
for (const id of ['alina-zakharova', 'jonas-eriksson']) {
  const character = byId(id);
  assert.equal(character.status, 'active', `${id}: occupied status`);
  assert.equal(character.player?.id, 'velvetka', `${id}: Velvet owner`);
}
const evelina = byId('evelina-de-la-rosa');
assert.equal(evelina.status, 'active');
assert.equal(evelina.player?.id, 'estrelly');
assert.equal(evelina.profile.overview.mainInfo.faceclaim, 'florence hunt');
assert.equal(evelina.cardImage, 'assets/characters/Evelina de la Rosa.jpg');
assert.ok(fs.existsSync(path.join(base, evelina.cardImage)));

const siena = byId('siena-sinclair');
assert.equal(siena.profile.overview.mainInfo.faceclaim, 'Barbara Palvin');
assert.equal(records.find(record => record.id === 'siena-sinclair').face, 'barbara palvin');
assert.ok(fs.existsSync(path.join(base, siena.cardImage)));

console.log('PASS character import: 40 new cards plus canonical Pablo, removals, ownership and faceclaim updates verified.');
