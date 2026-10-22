// 从实际示例入口和源码索引生成视图，不预设示例名单或模型回答。
const key = ref => `${ref.file}::${ref.symbol || ''}`;
const categories = {
  entry: '当前示例', connection: '模型连接',
  model: '模型客户端', runtime: 'Agent 执行',
  tools: '工具系统', foundation: '基础组件',
};

function category(ref) {
  if (ref.file.startsWith('examples/')) return 'entry';
  if (ref.file === 'core/llm.py') return ref.symbol === 'create_llm' ? 'connection' : 'model';
  if (ref.file.startsWith('agents/')) return 'runtime';
  if (ref.file.startsWith('tools/')) return 'tools';
  return 'foundation';
}

function localCalls(ref, sources) {
  const source = sources[ref.file];
  const span = ref.symbol ? source.symbols[ref.symbol] : {start:1,end:source.code.split('\n').length};
  // 方法体内的调用归属最内层符号，类定义不等于执行全部方法。
  return source.calls.filter(call => {
    if (call.line < span.start || call.line > span.end) return false;
    const enclosing = Object.entries(source.symbols)
      .filter(([,item]) => call.line >= item.start && call.line <= item.end)
      .sort((a,b) => (a[1].end-a[1].start) - (b[1].end-b[1].start))[0];
    return (enclosing?.[0] || '') === (ref.symbol || '');
  }).sort((a,b) => a.line-b.line || a.start-b.start);
}

export function buildExamples(catalog, sources, notes = {}) {
  const examples = {};
  for (const entry of catalog) {
    const graphNodes = new Map(), edges = new Map(), visited = new Set(), steps = [];
    const rows = new Map();
    function addNode(ref, depth) {
      const id = `source:${key(ref)}`;
      if (!graphNodes.has(id)) {
        const column = Math.min(depth, 4), row = rows.get(column) || 0;
        rows.set(column, row + 1);
        const title = ref.symbol || ref.file;
        const description = notes[key(ref)]?.summary || sources[ref.file].symbols[ref.symbol]?.doc?.split('\n')[0] || '查看源码中的输入、返回和调用。';
        const x = 80 + column * 290, y = 60 + row * 155;
        graphNodes.set(id, {id, title, file:ref.file, symbol:ref.symbol, x, y,
          initialPosition:{x,y}, desc:description, icon:'ƒ', status:'ready', points:[], links:[]});
      }
      return id;
    }
    const rootId = addNode(entry, 0);
    steps.push({node:rootId,title:'进入示例',text:'根据当前示例源码展开调用；分支、循环只展示静态结构，不代表实际运行记录。',
      input:entry.file,output:entry.symbol || '脚本入口',ref:{file:entry.file,symbol:entry.symbol,line:entry.symbol?sources[entry.file].symbols[entry.symbol].start:1}});
    function visit(ref, depth) {
      if (visited.has(key(ref))) return;
      visited.add(key(ref));
      const from = addNode(ref, depth);
      for (const call of localCalls(ref, sources)) {
        const to = addNode(call, depth + 1);
        const kind = call.kind === 'reference' ? '引用' : '调用';
        edges.set(`${from}>${to}`, [from,to,kind]);
        const sourceLine = sources[ref.file].code.split('\n')[call.line - 1].trim();
        steps.push({node:to,title:`${kind} ${call.symbol}`,text:notes[key(call)]?.summary || `${ref.symbol || '脚本入口'} 中的${kind}，可点击节点查看被调用实现。`,
          input:call.expression || sourceLine,
          output:notes[key(call)]?.output ? `返回约定：${notes[key(call)].output}。具体值以实际运行为准。` : '此处展示源码关系；实际返回值需要运行示例后才能获得。',
          ref:{file:ref.file,symbol:ref.symbol,line:call.line,needle:sourceLine}});
        visit(call, depth + 1);
      }
    }
    visit(entry, 0);
    const members = [...graphNodes.values()], owner = {}, groups = [];
    for (const [name,title] of Object.entries(categories)) {
      const items = members.filter(node => category(node) === name);
      if (!items.length) continue;
      const representative = items[0];
      const id = `example-group:${entry.id}:${name}`;
      const x = 80 + (groups.length % 3) * 320;
      const y = 60 + Math.floor(groups.length / 3) * 220;
      for (const node of items) owner[node.id] = id;
      groups.push({...representative,id,title,x,y,initialPosition:{x,y},members:items,
        desc:name==='entry'?entry.title:`当前示例涉及 ${items.length} 个方法与组件，点击查看。`});
    }
    const groupEdges = new Map();
    for (const [from,to,label] of edges.values()) {
      const a=owner[from],b=owner[to];
      if (a !== b) groupEdges.set(`${a}>${b}`,[a,b,label]);
    }
    examples[entry.id] = {...entry,description:`${entry.file} · 源码调用展开，非运行记录`,steps,nodes:members,
      views:{full:{nodes:members,relations:[...edges.values()]},compact:{nodes:groups,relations:[...groupEdges.values()]},owner}};
  }
  return examples;
}
