import {nodes,relations,flowExamples} from './knowledge.js?v=local-architecture-2';
import {SourceReader} from './reader.js?v=local-architecture-2';
import {createMapViews} from './map-views.js?v=local-architecture-1';
import {DiagramViewer} from './diagrams.js?v=local-architecture-1';

const mapViews=createMapViews(nodes,relations),byId=mapViews.byId;
const currentFlow=flowExamples.main;
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
