const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const events={},fields=[];let observe;
function field(type='search',form=null){const f={nodeType:1,type,form,name:'',readOnly:false,attributes:{},matches:()=>true,querySelectorAll:()=>[],setAttribute(k,v){this.attributes[k]=v},addEventListener(){}};fields.push(f);return f}
const search=field(),login=field('text',{id:'atlasLoginForm'}),password=field('password'),pet=field('text');pet.value='Лапки';
const ownedForm={id:'editor',setAttribute(k,v){this[k]=v}};const owned=field('text',ownedForm);owned.name='character_id';
const locked=field('search');locked.readOnly=true;
const document={activeElement:null,body:{nodeType:1,matches:()=>false,querySelectorAll:()=>fields,appendChild(){}},createElement:()=>({addEventListener(){}}),addEventListener:(n,f)=>events[n]=f};
vm.runInNewContext(fs.readFileSync('assets/atlas-autofill.js','utf8'),{document,Set,WeakSet,MutationObserver:class{constructor(f){observe=f}observe(){}}});
assert.equal(search.readOnly,true);events.focus({target:search});assert.equal(search.readOnly,false);events.blur({target:search});assert.equal(search.readOnly,true);events.pointerdown({target:search});assert.equal(search.readOnly,false);
assert.equal(login.attributes.autocomplete,undefined);assert.equal(password.attributes.autocomplete,undefined);
assert.equal(pet.value,'Лапки');assert.equal(pet.attributes.form,'atlasNonCredentialFields');assert.equal(owned.name,'character_id');assert.equal(owned.attributes.form,undefined);
events.focus({target:locked});assert(locked.readOnly);
const dynamic=field();observe([{addedNodes:[dynamic]}]);assert.equal(dynamic.attributes.autocomplete,'off');assert(dynamic.readOnly);
console.log('PASS autofill: dynamic searches, keyboard/touch focus, auth exclusions, original values, names and form ownership preserved');
