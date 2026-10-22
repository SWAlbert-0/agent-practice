import {readFileSync, readdirSync} from 'node:fs';
import {nodes, relations, notes} from './knowledge.js';
import {buildExamples} from './cases.js';
import {createMapViews} from './map-views.js';
import {validateModel} from './validate.js';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const sources = JSON.parse(read('sources.json'));
const flows = JSON.parse(read('flows.json'));
const catalog = JSON.parse(read('examples.json'));
const cases = buildExamples(catalog,sources,notes);
const errors = validateModel(sources, nodes, relations, notes, cases, flows);
createMapViews(nodes, relations);
for (const [file, source] of Object.entries(sources)) {
  const actual = readFileSync(new URL(file, root), 'utf8').replace(/^\uFEFF/, '');
  if (actual.replace(/\r\n/g, '\n') !== source.code.replace(/\r\n/g, '\n')) errors.push(`源码快照过期: ${file}，请运行 python web/generate_sources.py`);
}
const discovered = Object.keys(sources).filter(file => file.startsWith('examples/') && !file.endsWith('/__init__.py'));
for(const file of discovered)if(!catalog.some(entry=>entry.file===file))errors.push(`示例未进入目录: ${file}`);
for (const name of readdirSync(new URL('examples/', root), {recursive:true})) {
  const file = `examples/${name.replaceAll('\\', '/')}`;
  if (file.endsWith('.py') && !file.split('/').at(-1).startsWith('_') && !sources[file]) {
    errors.push(`新增示例尚未索引: ${file}，请运行 python web/generate_sources.py`);
  }
}
const diagrams = JSON.parse(read('diagrams.json'));
for (const flow of flows) {
  const doc = readFileSync(new URL(flow.document, root), 'utf8');
  const blocks = [...doc.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)];
  if (!blocks[flow.block]) errors.push(`流程图 ${flow.id}: 文档图块不存在`);
  const generated = diagrams.find(item => item.id === flow.id);
  if (!generated || (blocks[flow.block] && generated.code.replace(/\r\n/g, '\n').trim() !== blocks[flow.block][1].replace(/\r\n/g, '\n').trim())) errors.push(`流程图快照过期: ${flow.id}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`检查通过：${nodes.length} 个节点、${Object.keys(notes).length} 条说明、${Object.keys(cases).length} 个案例、${flows.length} 个流程图。`);
