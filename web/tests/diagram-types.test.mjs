import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagramKinds, filterDiagrams} from '../diagram-types.js';

const scenes = JSON.parse(readFileSync(new URL('../diagrams.json', import.meta.url), 'utf8'));
test('catalog types and counts are derived from actual scenes', () => {
  const counts = Object.fromEntries(diagramKinds(scenes).map(item => [item.kind, item.count]));
  assert.deepEqual(counts, {'流程图': 10, '时序图': 5});
});
test('all and type filters retain original order and do not mutate scenes', () => {
  assert.equal(filterDiagrams(scenes, '').length, 15);
  const sequence = filterDiagrams(scenes, '时序图');
  assert.equal(sequence.length, 5);
  assert.ok(sequence.every(scene => scene.kind === '时序图'));
  assert.equal(scenes.length, 15);
});
test('future diagram kinds appear without changes to filtering code', () => {
  const expanded = [...scenes, {id:'new-class', kind:'类图'}, {id:'new-state', kind:'状态图'}];
  assert.ok(diagramKinds(expanded).some(item => item.kind === '类图' && item.count === 1));
  assert.deepEqual(filterDiagrams(expanded, '状态图').map(scene => scene.id), ['new-state']);
  assert.deepEqual(filterDiagrams(expanded, 'unknown'), []);
});
