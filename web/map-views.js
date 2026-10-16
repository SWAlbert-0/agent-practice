// 每个完整节点只属于一个组件组；简化边由真实关系汇总，不额外推断调用。
const definitions=[
  ['entry','程序入口','main',['main','agent-test','react-test','calculator-test'],80,70,'模型入口、Agent 示例与离线验证'],
  ['connection','模型连接','factory',['factory'],80,285,'服务选择、模型与凭证解析'],
  ['model','模型客户端','client',['client','invoke','request'],420,285,'本地 LLM、请求选项与流式响应'],
  ['runtime','Agent 执行','simple',['simple','react','plan','reflection','stream-run','tool-loop','tool-parse','tool-execute'],760,70,'对话、ReAct、规划、反思与工具循环'],
  ['tools','工具系统','registry',['registry','calculator','calculate','eval-node','local-tool','search','chain','async-tools'],760,350,'本地注册、工具实现、顺序与并发编排'],
  ['foundation','基础组件','agent',['agent','message','config','dict','run','history'],420,530,'项目内的 Agent、消息与配置'],
];

export function createMapViews(nodes,relations){
  const fullById=Object.fromEntries(nodes.map(n=>[n.id,n]));
  const owner={};
  const groups=definitions.map(([key,title,representative,ids,x,y,desc])=>{
    for(const id of ids){
      if(!fullById[id]||owner[id])throw Error(`Invalid component membership: ${id}`);
      owner[id]=`group-${key}`;
    }
    return {...fullById[representative],id:`group-${key}`,title,desc,x,y,
      members:ids.map(id=>fullById[id]),status:ids.some(id=>fullById[id].status==='partial')?'partial':'ready'};
  });
  if(nodes.some(n=>!owner[n.id]))throw Error('Each node must belong to a component');
  const compactEdges=new Map();
  for(const [from,to,label] of relations){
    const a=owner[from],b=owner[to];if(a===b)continue;
    const key=`${a}>${b}`,edge=compactEdges.get(key)||{a,b,labels:[],originals:[]};
    if(!edge.labels.includes(label))edge.labels.push(label);
    edge.originals.push([from,to,label]);compactEdges.set(key,edge);
  }
  return {
    compact:{nodes:groups,relations:[...compactEdges.values()].map(e=>[e.a,e.b,e.labels.length===1?e.labels[0]:`${e.originals.length} 处关联`])},
    full:{nodes,relations},owner,
    byId:{...fullById,...Object.fromEntries(groups.map(g=>[g.id,g]))},
  };
}
