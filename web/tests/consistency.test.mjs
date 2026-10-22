import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nodes, relations, notes} from '../knowledge.js';
import {buildExamples} from '../cases.js';
import {validateModel} from '../validate.js';
const sources = JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
const catalog=JSON.parse(readFileSync(new URL('../examples.json',import.meta.url),'utf8'));
const cases=buildExamples(catalog,sources,notes);
const first=Object.keys(cases)[0];
const check = (s = sources, c = cases, n = nodes) => validateModel(s, n, relations, notes, c);

test('all current references and anchors resolve', () => assert.deepEqual(check(), []));
test('a removed method is detected', () => {
  const copy = structuredClone(sources);
  delete copy['agents/simple_agent.py'].symbols['SimpleAgent.run'];
  assert.ok(check(copy).some(error => error.includes('SimpleAgent.run')));
});
test('a changed case anchor is detected', () => {
  const copy = structuredClone(cases);
  copy[first].steps[0].ref.needle = 'nonexistent_call()';
  assert.ok(check(sources, copy).some(error => error.includes('nonexistent_call()')));
});
test('an unknown execution node is detected', () => {
  const copy = structuredClone(cases);
  copy[first].steps[0].node = 'missing';
  assert.ok(check(sources, copy).some(error => error.includes('节点不存在')));
});
test('duplicate node IDs are detected', () => {
  assert.ok(check(sources, cases, [...nodes, nodes[0]]).some(error => error.includes('重复节点')));
});
test('every discovered entry builds its own source-derived graph',()=>{
  assert.equal(Object.keys(cases).length,catalog.length);
  for(const item of Object.values(cases)){
    assert.equal(item.steps[0].ref.file,item.file);
    assert.ok(item.nodes.every(node=>!node.file.startsWith('tests/')));
    const ids=new Set(item.nodes.map(node=>node.id));
    assert.ok(item.views.full.relations.every(([a,b])=>ids.has(a)&&ids.has(b)));
    assert.ok(item.views.compact.nodes.every(group=>group.members.every(node=>ids.has(node.id))));
  }
});
test('calculator-only example does not include unrelated agents or model clients',()=>{
  const item=cases['examples/calculator_demo.py::demo_calculator_tool'];
  assert.ok(item.nodes.some(node=>node.file==='tools/calculator_tool.py'));
  assert.ok(item.nodes.every(node=>!node.file.startsWith('agents/')&&node.file!=='core/llm.py'));
});
test('a new entry is selectable without editing frontend presets',()=>{
  const file='examples/new_demo.py';
  const expanded={...sources,[file]:{code:'def main():\n    pass\n',symbols:{main:{start:1,end:2,doc:''}},calls:[]}};
  const list=[...catalog,{id:`${file}::main`,file,symbol:'main',title:'new_demo'}];
  assert.ok(buildExamples(list,expanded)[`${file}::main`]);
});
