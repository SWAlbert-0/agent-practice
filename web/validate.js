// 浏览器与命令行共用相同检查规则，不执行业务代码。
export function validateModel(sources, nodes, relations, notes, cases, flows = []) {
  const errors = [];
  const ids = new Set();
  function reference(ref, label) {
    const source = sources[ref.file];
    if (!source) { errors.push(`${label}: 未索引文件 ${ref.file}`); return; }
    const span = ref.symbol ? source.symbols[ref.symbol] : {start: 1, end: source.code.split('\n').length};
    if (!span) { errors.push(`${label}: 方法不存在 ${ref.file}::${ref.symbol}`); return; }
    const lines = source.code.split('\n').slice(span.start - 1, span.end);
    if(ref.line && (ref.line<span.start || ref.line>span.end))errors.push(`${label}: 调用行超出方法范围 ${ref.line}`);
    const start = ref.needle ? lines.findIndex(line => line.includes(ref.needle)) : 0;
    if (start < 0) errors.push(`${label}: 源码定位失效 ${ref.needle}`);
    if (typeof ref.end === 'string' && !lines.some((line, index) => index >= start && line.includes(ref.end))) errors.push(`${label}: 步骤结束定位失效 ${ref.end}`);
  }
  for (const node of nodes) {
    if (ids.has(node.id)) errors.push(`重复节点 ${node.id}`);
    ids.add(node.id);
    reference(node, `节点 ${node.id}`);
  }
  for (const [from, to] of relations) {
    if (!ids.has(from) || !ids.has(to)) errors.push(`关系节点不存在 ${from} → ${to}`);
  }
  for (const [key, note] of Object.entries(notes)) {
    const [file, symbol] = key.split('::');
    reference({file, symbol}, `说明 ${key}`);
    for (const step of note.steps || []) reference({file, symbol, ...step}, `说明步骤 ${key}/${step.title}`);
  }
  for (const [name, item] of Object.entries(cases)) {
    const exampleIds = item.nodes ? new Set(item.nodes.map(node=>node.id)) : ids;
    for(const node of item.nodes || [])reference(node,`示例节点 ${name}/${node.title}`);
    for (const [index, step] of item.steps.entries()) {
      if (!exampleIds.has(step.node)) errors.push(`案例 ${name}/${index + 1}: 节点不存在`);
      reference(step.ref, `案例 ${name}/${index + 1}`);
    }
  }
  for (const flow of flows) for (const ref of flow.sources || []) reference(ref, `流程图 ${flow.id}`);
  for (const [file, source] of Object.entries(sources)) {
    for (const call of source.calls || []) reference({file:call.file,symbol:call.symbol}, `源码跳转 ${file}:${call.line}`);
  }
  return errors;
}
