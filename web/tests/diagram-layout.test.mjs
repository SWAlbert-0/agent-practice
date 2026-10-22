import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedDiagramLayout, MIN_FIXED_ZOOM} from '../diagram-layout.js';

test('large viewport shows the whole diagram at natural size', () => {
  const layout = fixedDiagramLayout({width:900,height:700}, 1400, 1000);
  assert.equal(layout.zoom, 1);
  assert.equal(layout.width, 1400);
  assert.equal(layout.height, 1000);
});
test('adaptation fits the whole diagram when it remains readable', () => {
  const layout = fixedDiagramLayout({width:1000,height:500}, 1000, 700);
  assert.ok(layout.zoom >= MIN_FIXED_ZOOM && layout.zoom < 1);
  assert.equal(layout.width, 1000);
  assert.equal(layout.height, 700);
});
test('small screens get scrollable content instead of unreadable shrinking', () => {
  const size = {width:1200,height:2000};
  const layout = fixedDiagramLayout(size, 350, 400);
  assert.equal(layout.zoom, MIN_FIXED_ZOOM);
  assert.ok(layout.width > 350 && layout.height > 400);
  assert.ok(layout.x >= 24 && layout.y >= 24);
  assert.ok(layout.x + size.width * layout.zoom <= layout.width - 24);
  assert.ok(layout.y + size.height * layout.zoom <= layout.height - 24);
});
test('manual zoom respects the same minimum and expands scrollable bounds', () => {
  assert.equal(fixedDiagramLayout({width:100,height:100},350,400,.1).zoom, MIN_FIXED_ZOOM);
  const layout = fixedDiagramLayout({width:1000,height:1000},350,400,2);
  assert.equal(layout.zoom, 2);
  assert.equal(layout.width, 2048);
  assert.equal(layout.height, 2048);
});
