import {extraNodes,extraRelations,flowExamples} from './knowledge.js';
import {SourceReader} from './reader.js';
import {createMapViews} from './map-views.js';
import {DiagramViewer} from './diagrams.js?v=canvas-20261016-2';

// 解释、位置与关联由人工维护；源码与行号由 generate_sources.py 自动更新。
const nodes = [
  {id:'main',title:'main.py',icon:'↗',file:'main.py',x:360,y:45,status:'ready',desc:'当前程序的入口',summary:'这是当前真实运行路径的起点：创建模型客户端，构造一条用户消息，再消费 think() 返回的生成器。当前入口没有实例化 Agent。',points:['create_llm() 按服务配置创建客户端。','for 循环才会驱动 think()，开始实际请求。','模型回答在 think() 内部打印，外层不必重复打印。'],input:'用户消息文本',output:'终端流式回答',links:[['factory','调用'],['client','调用']]},
  {id:'factory',title:'create_llm()',icon:'ƒ',file:'core/llm.py',symbol:'create_llm',x:70,y:210,status:'ready',desc:'一组选定配置，一个客户端',summary:'配置工厂把服务选择和模型调用分开。先选定 provider，再从该组读取模型、地址和密钥，避免自动检测混用多套配置。',points:['显式参数优先于 models.json 中的默认选择。','只读取当前服务；缺失配置项按 Python 原有规则报错。','全部连接参数显式传入基础客户端。'],input:'provider? · model? · config_path?',output:'HelloAgentsLLM 实例',links:[['main','被调用'],['client','创建']]},
  {id:'client',title:'HelloAgentsLLM',icon:'◉',file:'hello_agents/core/llm.py',symbol:'HelloAgentsLLM.think',x:650,y:210,status:'ready',desc:'连接模型，逐段返回文本',summary:'安装包中的模型客户端统一调用兼容接口。当前查看的是 think()：发送流式请求，提取增量文本，然后打印并 yield 给调用方。',points:['创建生成器不发送请求，消费生成器时才开始。','base_url 决定请求目标，provider 影响配置解析。','模型部署与推理由 Ollama 等服务负责。'],input:'list[dict] 消息列表',output:'Iterator[str] 文本片段',links:[['factory','被创建'],['main','返回片段'],['dict','接收格式']]},
  {id:'agent',title:'Agent',icon:'◇',file:'core/agent.py',symbol:'Agent.__init__',x:360,y:355,status:'partial',desc:'组合组件，保存公共状态',summary:'Agent 是抽象基类，保存名称、模型客户端、系统提示词、配置和历史。它提供骨架，并没有自动完成一轮对话。',points:['llm 从外部传入，不在 Agent 内自动创建。','未传 config 时使用 Config()，不读取环境变量。','每个实例拥有独立的 _history 列表。'],input:'name · llm · system_prompt? · config?',output:'子类实例的公共状态',links:[['run','定义接口'],['history','管理'],['config','持有'],['message','保存类型'],['client','持有']]},
  {id:'message',title:'Message',icon:'✉',file:'core/message.py',symbol:'Message',x:70,y:355,status:'ready',desc:'结构化消息与角色校验',summary:'一条内部消息包含内容、角色、时间和元数据。Pydantic 依据 role: MessageRole 校验角色，Literal 限定了四种合法值。',points:['角色允许 user、assistant、system、tool。','kwargs 接收 timestamp 和 metadata 等关键字参数。','目前 tool 消息尚未封装完整的工具调用关联字段。'],input:'content · role · kwargs',output:'Message 对象',links:[['dict','转换'],['history','被保存'],['agent','被持有']]},
  {id:'config',title:'Config',icon:'⚙',file:'core/config.py',symbol:'Config',x:650,y:355,status:'partial',desc:'运行配置已定义，待应用',summary:'Config 集中保存温度、日志、历史长度等设置。字段存在并不代表行为已经接通：Agent 基类不会自动按这些值执行。',points:['Config() 使用默认值；from_env() 才读取部分环境变量。','from_env() 本身不会加载 .env。','max_history_length 目前没有自动截断逻辑。'],input:'显式参数 / 部分环境变量',output:'Config 对象',links:[['agent','被持有']]},
  {id:'dict',title:'Message.to_dict()',icon:'{}',file:'core/message.py',symbol:'Message.to_dict',x:70,y:515,status:'ready',desc:'内部对象 → 接口消息',summary:'把丰富的内部 Message 对象转换为只有 content 和 role 的字典，便于构造模型调用的 messages 参数。当前 main.py 直接创建字典，尚未调用该方法。',points:['时间与元数据不进入此方法的返回值。','to_dict() 与返回全部字段的 model_dump() 不同。'],input:'Message 实例',output:'{"content": "…", "role": "user"}',links:[['message','所属类'],['client','兼容输入']]},
  {id:'run',title:'Agent.run()',icon:'▶',file:'core/agent.py',symbol:'Agent.run',x:360,y:515,status:'partial',desc:'已声明的抽象执行接口',summary:'@abstractmethod 要求子类实现执行策略。当前只有接口和 pass，不能把 Agent 直接实例化，也没有实际的对话闭环。',points:['input_text 接收用户文本，kwargs 留给子类扩展。','Agent 基类没有组织消息或调用模型的实现。','项目 SimpleAgent 已实现，但继承框架父类，并非这个项目基类。'],input:'input_text · kwargs',output:'约定返回 str，当前未实现',links:[['agent','所属类']]},
  {id:'history',title:'历史消息管理',icon:'≡',file:'core/agent.py',symbol:'Agent.get_history',x:650,y:515,status:'ready',desc:'添加、复制和清空消息',summary:'基类提供 add_message()、get_history()、clear_history()。这些方法已经存在，但仍需子类在运行过程中主动使用。',points:['get_history() 返回列表浅拷贝，列表内 Message 对象仍共享。','不会自动保存模型回答，也不自动限制历史长度。'],input:'Message / 读取或清空操作',output:'list[Message] 的浅拷贝',links:[['agent','所属类'],['message','元素类型']]},
];

nodes.push(...extraNodes);
const relations = [
  ['main','factory','调用'],['main','client','调用 think'],
  ['factory','client','创建客户端'],['agent','client','持有客户端'],
  ['agent','message','消息类型'],['agent','config','持有配置'],
  ['agent','run','抽象接口'],['agent','history','历史方法'],['message','dict','转换'],
];
relations.push(...extraRelations);
const mapViews=createMapViews(nodes,relations),byId=mapViews.byId;
const currentFlow = [
  {node:'main',title:'01 / 进入 main.py',text:'入口首先调用配置工厂。当前程序没有创建 Agent，也没有执行抽象 run()。',data:'llm = create_llm()'},
  {node:'factory',title:'02 / 选择整组连接配置',text:'根据 defaultProvider 选择同一组地址、模型和密钥；不展示或读取凭证内容。',data:'provider → baseUrl + defaultModel + key source'},
  {node:'client',title:'03 / 创建客户端',text:'HelloAgentsLLM 接收显式参数。这个步骤尚未发起模型请求。',data:'client = HelloAgentsLLM(provider=…, model=…, …)'},
  {node:'main',title:'04 / 构造消息并驱动生成器',text:'创建消息字典后，think(messages) 返回生成器；for 循环消费时才实际执行请求。',data:'messages = [{"role":"user","content":"你好"}] → for chunk in llm.think(messages)'},
  {node:'client',title:'05 / 模拟请求与响应',text:'模型服务返回增量文本；此处只使用教学数据，不实际发送 HTTP 请求。',data:'delta.content = "你好！" → yield content'},
  {node:'main',title:'06 / 输出完成',text:'文本在 think() 内打印，外层 pass 只负责继续迭代。当前模型调用路径结束。',data:'output: "你好！很高兴见到你。"'},
];
const initialPositions=Object.fromEntries(Object.values(byId).map(n=>[n.id,{x:n.x,y:n.y}]));
let sources = {}, selected='simple', mode='structure', stepIndex=-1, playing=false, timer, zoom=1,detailLevel='compact';
const savedViews={};
const visibleNodes=()=>mapViews[detailLevel].nodes;
const visibleId=id=>detailLevel==='compact'?(mapViews.owner[id]||id):(byId[id]?.members?.[0].id||id);
// 节点使用无边界的世界坐标；相机仅控制整张地图在屏幕上的位置。
let bounds={left:0,top:0,width:940,height:660};
const camera={x:0,y:25};
let reader;
const $ = id => document.getElementById(id);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {ready:'已实现',partial:'需注意'};
const activeFlow = () => flowExamples[$('flow-path').value] || currentFlow;
function selectNode(id){
  if(!byId[id])return;
  selected=id;renderGraph();
}
function inspectNode(id){
  pause();selected=id;reader.open(byId[id]);renderGraph();
}

function renderGraph(){
  const current=mode==='flow'&&stepIndex>=0?visibleId(activeFlow()[stepIndex].node):null;
  $('view-caption').textContent=`当前代码 · ${visibleNodes().length} 个${detailLevel==='compact'?'组件':'节点'}`;
  $('graph-nodes').innerHTML=visibleNodes().map(n=>`<button class="graph-node ${n.members?'component-node':''} ${n.status} ${visibleId(selected)===n.id?'selected':''} ${current===n.id?'flow-active':''}" style="left:${n.x}px;top:${n.y}px" data-node="${n.id}" aria-label="${escape(n.title)}，${labels[n.status]}" title="点击查看详情；拖动调整位置；Alt + 方向键移动"><div class="node-top"><span class="node-symbol">${n.icon}</span><div><div class="node-title">${escape(n.title)}</div><div class="node-file">${n.members?`${n.members.length} 个节点 · 按需查看`:escape(n.file)}</div></div><span class="node-indicator"></span></div><div class="node-description">${escape(n.desc)}</div>${n.members?'<span class="component-open" aria-hidden="true">↗</span>':''}</button>`).join('');
  $('graph-nodes').querySelectorAll('button').forEach(bindNodeDrag);
  resizeWorld();renderEdges();
}

function nodeBox(id){
  const n=byId[id],el=$('graph-nodes').querySelector(`[data-node="${id}"]`);
  return {x:n.x,y:n.y,w:el?.offsetWidth||218,h:el?.offsetHeight||96};
}
function resizeWorld(){
  // 边界仅供“适应画布”使用，不裁切节点，也不把负坐标限制为零。
  const boxes=visibleNodes().map(n=>nodeBox(n.id));
  const left=Math.min(...boxes.map(b=>b.x)),top=Math.min(...boxes.map(b=>b.y));
  bounds={left,top,width:Math.max(...boxes.map(b=>b.x+b.w))-left,
    height:Math.max(...boxes.map(b=>b.y+b.h))-top};
}
function renderEdges(){
  const current=mode==='flow'&&stepIndex>=0?visibleId(activeFlow()[stepIndex].node):null;
  const previous=stepIndex>0?visibleId(activeFlow()[stepIndex-1].node):null;
  // 只根据固定关系重算几何位置，不增删关系；播放也不会虚构连接。
  $('edge-paths').innerHTML=mapViews[detailLevel].relations.map(([a,b,label])=>{
    const n=nodeBox(a),m=nodeBox(b),dx=m.x+m.w/2-n.x-n.w/2,dy=m.y+m.h/2-n.y-n.h/2;
    const horizontal=Math.abs(dx)/Math.max(n.w,m.w)>Math.abs(dy)/Math.max(n.h,m.h);
    const sx=Math.sign(dx)||1,sy=Math.sign(dy)||1;
    const x1=n.x+n.w/2+(horizontal?sx*n.w/2:0),y1=n.y+n.h/2+(horizontal?0:sy*n.h/2);
    const x2=m.x+m.w/2-(horizontal?sx*m.w/2:0),y2=m.y+m.h/2-(horizontal?0:sy*m.h/2);
    const bend=Math.max(45,Math.hypot(x2-x1,y2-y1)*.4);
    const cx1=x1+(horizontal?sx*bend:0),cy1=y1+(horizontal?0:sy*bend);
    const cx2=x2-(horizontal?sx*bend:0),cy2=y2-(horizontal?0:sy*bend);
    const active=(current===b&&previous===a)||(current===a&&previous===b);
    const d=`M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
    const lx=(x1+3*cx1+3*cx2+x2)/8,ly=(y1+3*cy1+3*cy2+y2)/8;
    return `<path data-from="${a}" data-to="${b}" class="edge ${active?'active':''}" d="${d}"/><text class="edge-label" x="${lx+5}" y="${ly-7}">${escape(label)}</text>`;
  }).join('');
}
function bindNodeDrag(element){
  const node=byId[element.dataset.node];
  let drag=null,suppressClick=false;
  element.onclick=event=>{
    if(suppressClick){suppressClick=false;event.preventDefault();return;}
    inspectNode(node.id);
  };
  element.onpointerdown=event=>{
    if(event.button!==0||event.isPrimary===false)return;
    pause();suppressClick=false;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,nx:node.x,ny:node.y,moved:false};
    element.setPointerCapture(event.pointerId);
  };
  element.onpointermove=event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    drag.moved=true;element.classList.add('dragging');event.preventDefault();
    // 指针位移为屏幕像素，除以当前倍率后才是画布坐标位移。
    node.x=drag.nx+dx/zoom;
    node.y=drag.ny+dy/zoom;
    element.style.left=`${node.x}px`;element.style.top=`${node.y}px`;
    resizeWorld();renderEdges();
  };
  const finish=event=>{
    if(!drag||drag.id!==event.pointerId)return;
    suppressClick=drag.moved&&event.type!=='pointercancel';drag=null;
    element.classList.remove('dragging');
    if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);
  };
  element.onpointerup=finish;element.onpointercancel=finish;element.onlostpointercapture=finish;
  element.onkeydown=event=>{
    if(!event.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();pause();const amount=event.shiftKey?24:8;
    node.x+=event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0;
    node.y+=event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0;
    element.style.left=`${node.x}px`;element.style.top=`${node.y}px`;resizeWorld();renderEdges();
  };
}
function fit(){
  const width=$('canvas').clientWidth,height=$('canvas').clientHeight;
  zoom=Math.max(.01,Math.min((width-80)/bounds.width,(height-80)/bounds.height,1));
  centerMap();
}
function centerMap(){
  camera.x=($('canvas').clientWidth-bounds.width*zoom)/2-bounds.left*zoom;
  camera.y=($('canvas').clientHeight-bounds.height*zoom)/2-bounds.top*zoom;
  applyCamera();
}
function applyCamera(){
  $('graph').style.transform=`translate(${camera.x}px, ${camera.y}px) scale(${zoom})`;
  $('canvas').style.backgroundPosition=`${camera.x}px ${camera.y}px`;
  $('canvas').style.backgroundSize=`${19*zoom}px ${19*zoom}px`;
  $('zoom-label').textContent=Math.round(zoom*100)+'%';
}
function zoomAt(nextZoom,x=$('canvas').clientWidth/2,y=$('canvas').clientHeight/2){
  // 保持指针或视口中心下方的世界坐标不变，缩放时不跳回原点。
  camera.x=x-(x-camera.x)*nextZoom/zoom;
  camera.y=y-(y-camera.y)*nextZoom/zoom;
  zoom=nextZoom;applyCamera();
}
function bindMapPan(){
  const viewport=$('graph-viewport');let pan=null;
  viewport.addEventListener('pointerdown',event=>{
    if(![1,2].includes(event.button)||event.isPrimary===false)return;
    event.preventDefault();event.stopPropagation();pause();
    pan={id:event.pointerId,x:event.clientX,y:event.clientY,cx:camera.x,cy:camera.y};
    viewport.setPointerCapture(event.pointerId);viewport.classList.add('panning');
  },true);
  viewport.addEventListener('pointermove',event=>{
    if(!pan||pan.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    camera.x=pan.cx+event.clientX-pan.x;camera.y=pan.cy+event.clientY-pan.y;
    applyCamera();
  },true);
  const finish=event=>{
    if(!pan||pan.id!==event.pointerId)return;
    pan=null;viewport.classList.remove('panning');
    if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,finish);
  // 在画布内避免右键菜单和中键自动滚屏抢占平移操作。
  viewport.addEventListener('contextmenu',event=>event.preventDefault());
  viewport.addEventListener('auxclick',event=>event.preventDefault());
  viewport.addEventListener('wheel',event=>{
    event.preventDefault();pause();
    const unit=event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1;
    if(event.ctrlKey){
      const rect=viewport.getBoundingClientRect();
      zoomAt(Math.max(.25,Math.min(1.5,zoom*Math.exp(-event.deltaY*unit*.002))),event.clientX-rect.left,event.clientY-rect.top);
    }else{
      camera.x-=(event.deltaX+(event.shiftKey?event.deltaY:0))*unit;
      camera.y-=(event.shiftKey?0:event.deltaY)*unit;applyCamera();
    }
  },{passive:false});
}
function setMode(value){mode=value;$('structure-tab').classList.toggle('selected',mode==='structure');$('flow-tab').classList.toggle('selected',mode==='flow');$('diagram-tab').classList.toggle('selected',mode==='diagram');$('diagram-panel').hidden=mode!=='diagram';$('canvas').hidden=mode==='diagram';document.querySelector('.map-actions').hidden=mode==='diagram';$('map-caption').textContent=mode==='flow'?'模拟演示 · 不会调用模型':'左键拖节点 · 右键/中键拖地图';document.querySelector('.flow-controls').hidden=mode!=='flow';document.querySelector('.event-box').hidden=mode!=='flow';renderGraph();}
function pause(){playing=false;clearTimeout(timer);$('play').textContent='▶ 播放';}
function reset(){pause();stepIndex=-1;$('step-counter').textContent='准备就绪';$('event-title').textContent='信息流演示';$('event-text').textContent='点击播放或单步。数据为教学示例，不会调用模型或读取密钥。';$('event-data').textContent='input → client → stream → output';renderGraph();}
function advance(){
  const flow=activeFlow();
  if(stepIndex>=flow.length-1){pause();return false;}
  stepIndex++;setMode('flow');const event=flow[stepIndex];selectNode(event.node,false);
  $('step-counter').textContent=`${String(stepIndex+1).padStart(2,'0')} / ${String(flow.length).padStart(2,'0')}`;
  $('event-title').textContent=event.title;$('event-text').textContent=event.text;$('event-data').textContent=event.data;
  if(stepIndex===flow.length-1)pause();return true;
}
function tick(){if(!playing)return;advance();if(playing)timer=setTimeout(tick,Number($('speed').value));}
function switchDetail(level){
  if(level===detailLevel)return;
  pause();savedViews[detailLevel]={x:camera.x,y:camera.y,zoom};detailLevel=level;
  $('compact-view').setAttribute('aria-pressed',String(level==='compact'));
  $('full-view').setAttribute('aria-pressed',String(level==='full'));
  document.querySelector('.detail-switch').dataset.level=level;
  $('view-caption').textContent=`当前代码 · ${visibleNodes().length} 个${level==='compact'?'组件':'节点'}`;
  renderGraph();
  if(savedViews[level]){Object.assign(camera,{x:savedViews[level].x,y:savedViews[level].y});zoom=savedViews[level].zoom;applyCamera();}
  else {zoom=1;centerMap();}
  $('graph-nodes').classList.remove('view-enter');
  // 只在层级切换时淡入，不在拖动和播放时反复触发动效。
  void $('graph-nodes').offsetWidth;$('graph-nodes').classList.add('view-enter');
}
async function init(){
  try{const response=await fetch('sources.json',{cache:'no-store'});if(!response.ok)throw Error();sources=await response.json();}
  catch{$('event-text').textContent='未加载源码索引，请通过 python web/serve.py 启动并刷新。流程图仍可浏览。';}
  const diagrams=new DiagramViewer($('diagram-panel'),ref=>reader.open({id:'diagram-source',title:ref.label,file:ref.file,symbol:ref.symbol}));
  const openDiagram=id=>{pause();setMode('diagram');diagrams.show(id);};
  // Load only the small catalog up front so source popups can expose related flows.
  try{await diagrams.load();}catch(error){console.warn(error.message);}
  reader=new SourceReader(sources,nodes,node=>{if(node)selected=node.id;renderGraph();},{related:(file,symbol)=>diagrams.related(file,symbol),open:id=>{$('detail-dialog').close();openDiagram(id);}});
  $('diagram-tab').onclick=()=>openDiagram(diagrams.scene?.id);
  $('flow-path').onchange=()=>{reset();$('flow-description').textContent=$('flow-path').value==='main'?'当前 main.py 路径':'方法级模拟，当前 main.py 未接入';};
  $('play').onclick=()=>{if(playing){pause();return;}if(stepIndex>=activeFlow().length-1)reset();playing=true;$('play').textContent='Ⅱ 暂停';tick();};
  $('step').onclick=()=>{pause();advance();};$('reset').onclick=reset;
  $('speed').onchange=()=>{if(playing){clearTimeout(timer);timer=setTimeout(tick,Number($('speed').value));}};
  $('structure-tab').onclick=()=>{pause();setMode('structure');};$('flow-tab').onclick=()=>setMode('flow');
  $('zoom-in').onclick=()=>zoomAt(Math.min(1.5,zoom+.1));$('zoom-out').onclick=()=>zoomAt(Math.max(.25,zoom-.1));$('fit').onclick=fit;
  $('zoom-label').onclick=()=>zoomAt(1);
  $('reset-layout').onclick=()=>{pause();visibleNodes().forEach(n=>Object.assign(n,initialPositions[n.id]));renderGraph();zoom=1;centerMap();};
  $('compact-view').onclick=()=>switchDetail('compact');$('full-view').onclick=()=>switchDetail('full');
  $('guide').onclick=()=>{pause();$('guide-dialog').showModal();};document.querySelector('.dialog-close').onclick=()=>$('guide-dialog').close();
  // 初次打开和调整窗口大小均保留用户倍率；仅点击适应画布时自动缩放。
  bindMapPan();new ResizeObserver(applyCamera).observe($('canvas'));renderGraph();centerMap();
}
init();
