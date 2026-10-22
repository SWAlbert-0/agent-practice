import test from 'node:test';
import assert from 'node:assert/strict';
import {nodes,relations} from '../knowledge.js';
import {createMapViews,isPracticeNode} from '../map-views.js';

const views=createMapViews(nodes,relations);
test('structure full view excludes examples and tests and their edges',()=>{
  assert.equal(views.structure.full.nodes.length,27);
  assert.ok(views.structure.full.nodes.every(node=>!isPracticeNode(node)));
  const ids=new Set(views.structure.full.nodes.map(node=>node.id));
  assert.ok(views.structure.full.relations.every(([from,to])=>ids.has(from)&&ids.has(to)));
});
test('structure components and popup members exclude practice nodes',()=>{
  assert.equal(views.structure.compact.nodes.length,6);
  for(const group of views.structure.compact.nodes)assert.ok(group.members.every(node=>!isPracticeNode(node)));
  const entry=views.structure.compact.nodes.find(node=>node.id==='group-entry');
  assert.deepEqual(entry.members.map(node=>node.id),['main']);
});
test('practice catalog retains original references and flow cases remain usable',()=>{
  assert.deepEqual(views.practice.map(node=>node.id),['agent-test','react-test','calculator-test']);
  for(const node of views.practice){
    assert.equal(views.byId[node.id],node);
    assert.ok(views.full.nodes.includes(node));
    assert.ok(views.owner[node.id]);
  }
});
