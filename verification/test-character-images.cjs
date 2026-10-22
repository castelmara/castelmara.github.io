const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync('assets/atlas-character-thumbnails.js','utf8'),context);
const entries=Object.entries(context.window.ATLAS_CHARACTER_THUMBNAILS);assert.equal(entries.length,94);
for(const [original,local] of entries){assert.ok(original.startsWith('assets/media-originals/'));assert.ok(fs.existsSync(local));const file=fs.readFileSync(local);assert.equal(file.toString('ascii',8,12),'WEBP');}
let handle;vm.runInNewContext(fs.readFileSync('assets/atlas-character-images.js','utf8'),{document:{addEventListener(type,fn){assert.equal(type,'error');handle=fn}}});
const img={tagName:'IMG',dataset:{originalSrc:'https://example.test/original.jpg'},src:'assets/missing.webp',getAttribute(){return this.src}};
handle({target:img});assert.equal(img.src,img.dataset.originalSrc);img.src='sentinel';handle({target:img});assert.equal(img.src,'sentinel','No infinite fallback loop');
console.log('94 local WebP previews verified; fallback tries original once');
