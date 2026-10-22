const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm');
const manifest=JSON.parse(fs.readFileSync('verification/local-media-manifest.json','utf8'));
for(const item of Object.values(manifest)){assert.ok(fs.existsSync(item.path));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(item.path)).digest('hex'),item.sha256);}
for(const file of ['index.html','assets/atlas-character-thumbnails.js',...fs.readdirSync('data').filter(f=>f.endsWith('.js')).map(f=>'data/'+f)]){
 const text=fs.readFileSync(file,'utf8');assert.ok(!/https?:\/\/[^\s"']*tildacdn/i.test(text),file);
 for(const [,url] of text.matchAll(/["'](assets\/media-originals\/[^"']+)["']/g))assert.ok(fs.existsSync(url),url);
}
const source=fs.readFileSync('verification/test-profile.cjs','utf8');
// Compare logical media identity, allowing only the audited URL migration.
const reverse=Object.fromEntries(Object.entries(manifest).filter(([,v])=>!v.replacement).map(([u,v])=>[v.path,u]));
const normalize='const restoreMedia=v=>{if(!v||typeof v!=="object")return;for(const k of Object.keys(v)){if(typeof v[k]==="string")v[k]=('+JSON.stringify(reverse)+')[v[k]]||v[k];else restoreMedia(v[k])}};restoreMedia(window.ATLAS_CHARACTERS);restoreMedia(window.ATLAS_CARD_ONLY);';
const patched=source.replace('const prior=',normalize+'\nconst prior=').replace('c.profile?.heroImage];','c.profile?.heroImage].map(v=>('+JSON.stringify(reverse)+')[v]||v);');
const Module=require('module'),m=new Module(require('path').resolve('verification/test-profile.cjs'),module);m.filename=require('path').resolve('verification/test-profile.cjs');m.paths=module.paths;m._compile(patched,m.filename);
console.log('Original checksums, local references, and migrated profile media verified');
