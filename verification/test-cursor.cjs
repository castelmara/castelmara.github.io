const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes("var glyphs={")&&s.includes('atlasApplyCursorStyle'));
function setup(fine=true){
 const events={},nodes=[],timers=[],reduced={matches:false,addEventListener(){}};let now=0;
 const node=()=>({style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},remove(){const i=nodes.indexOf(this);if(i>=0)nodes.splice(i,1)}});
 const document={hidden:false,documentElement:{contains:()=>true,classList:{add(){}}},body:{appendChild:n=>nodes.push(n)},getElementById:()=>null,createElement:node,addEventListener:(k,v)=>events[k]=v};
 const window={matchMedia:q=>q.includes('reduced-motion')?reduced:{matches:fine},addEventListener(){}};
 vm.runInNewContext(source,{window,document,localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>now+=50},Math,setTimeout:f=>timers.push(f)});
 return {window,events,nodes,reduced,timers};
}
const a=setup();for(const style of ['sparkles','crab','cat','frog','cherries','jellyfish','planet'])assert.equal(a.window.atlasApplyCursorStyle(style),style);
assert.equal(a.window.atlasApplyCursorStyle('bad'),'classic');
a.events.mousemove({clientX:1,clientY:1});assert.equal(a.nodes.length,1);
a.events.change({target:{id:'atlasCursorTrail',checked:true}});
for(let i=0;i<100;i++)a.events.mousemove({clientX:i*10,clientY:10});
assert.equal(a.nodes.length,17,'Cursor + at most 16 sparks');
a.events.change({target:{id:'atlasCursorTrail',checked:false}});assert.equal(a.nodes.length,1);
a.events.change({target:{id:'atlasCursorTrail',checked:true}});a.reduced.matches=true;a.events.mousemove({clientX:2000,clientY:0});assert.equal(a.nodes.length,1);
const mobile=setup(false);assert(!mobile.events.mousemove);assert.equal(mobile.nodes.length,0);
console.log('PASS cursor choices, particle cap, toggle cleanup, reduced motion and touch');
