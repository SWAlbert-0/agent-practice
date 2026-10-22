import {buildExamples} from './cases.js';
import {validateModel} from './validate.js';
import {nodes,relations,notes} from './knowledge.js?v=local-architecture-2';
import {SourceReader} from './reader.js?v=local-architecture-2';
import {createMapViews} from './map-views.js?v=local-architecture-1';
import {DiagramViewer} from './diagrams.js?v=local-architecture-1';

const mapViews=createMapViews(nodes,relations),byId=mapViews.byId;
const initialPositions=Object.fromEntries(Object.values(byId).map(n=>[n.id,{x:n.x,y:n.y}]));
let sources = {}, cases = {}, selected='simple', mode='structure', stepIndex=-1, playing=false, timer, zoom=1,detailLevel='compact';
const savedViews={};
const activeMap=()=>mode==='flow'?activeCase().views[detailLevel]:mode==='structure'?mapViews.structure[detailLevel]:mapViews[detailLevel];
const visibleNodes=()=>activeMap().nodes;
const visibleId=id=>detailLevel==='compact'?((mode==='flow'?activeCase().views.owner:mapViews.owner)[id]||id):(byId[id]?.members?.[0].id||id);
// 节点使用无边界的世界坐标；相机仅控制整张地图在屏幕上的位置。
let bounds={left:0,top:0,width:940,height:660};
const camera={x:0,y:25};
let reader;
const $ = id => document.getElementById(id);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {ready:'已实现',partial:'需注意'};
const activeCase = () => cases[$('flow-path').value];
const activeFlow = () => activeCase().steps;
function selectNode(id){
  if(!byId[id])return;
  selected=id;renderGraph();
}
function inspectNode(id){
  pause();selected=id;reader.open(visibleNodes().find(node=>node.id===id)||byId[id]);renderGraph();
}

function renderGraph(){
  const current=mode==='flow'&&stepIndex>=0?visibleId(activeFlow()[stepIndex].node):null;
  $('view-caption').textContent=`当前代码 · ${visibleNodes().length} 个${detailLevel==='compact'?'组件':'节点'}`;
  $('graph-nodes').innerHTML=visibleNodes().map(n=>`<button class="graph-node ${n.members?'component-node':''} ${n.status} ${visibleId(selected)===n.id?'selected':''} ${current===n.id?'flow-active':''}" style="left:${n.x}px;top:${n.y}px" data-node="${n.id}" aria-label="${escape(n.title)}，${labels[n.status]}" title="点击查看详情；拖动调整位置；Alt + 方向键移动"><div class="node-top"><span class="node-symbol">${n.icon}</span><div><div class="node-title">${escape(n.title)}</div><div class="node-file">${n.members?`${n.members.length} 个节点 · 按需查看`:escape(n.file)}</div></div><span class="node-indicator"></span></div><div class="node-description">${escape(n.desc)}</div>${current===n.id?'<span class="execution-marker">当前执行</span>':''}${n.members?'<span class="component-open" aria-hidden="true">↗</span>':''}</button>`).join('');
  $('graph-nodes').querySelectorAll('button').forEach(bindNodeDrag);
  resizeWorld();renderEdges();
}

function nodeBox(id){
  const n=visibleNodes().find(node=>node.id===id)||byId[id],el=$('graph-nodes').querySelector(`[data-node="${id}"]`);
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
  $('edge-paths').innerHTML=activeMap().relations.map(([a,b,label])=>{
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
  const node=visibleNodes().find(node=>node.id===element.dataset.node)||byId[element.dataset.node];
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
function setMode(value){mode=value;$('structure-tab').classList.toggle('selected',mode==='structure');$('flow-tab').classList.toggle('selected',mode==='flow');$('diagram-tab').classList.toggle('selected',mode==='diagram');$('practice-tab').classList.toggle('selected',mode==='practice');$('diagram-panel').hidden=mode!=='diagram';$('practice-panel').hidden=mode!=='practice';$('canvas').hidden=!['structure','flow'].includes(mode);document.querySelector('.map-actions').hidden=!['structure','flow'].includes(mode);$('map-caption').textContent=mode==='flow'?'源码流程 · 不会调用模型':'左键拖节点 · 右键/中键拖地图';document.querySelector('.flow-controls').hidden=mode!=='flow';document.querySelector('.event-box').hidden=mode!=='flow';$('case-detail').hidden=mode!=='flow';renderGraph();}

function renderPractice(){
  const groups=[['examples/','案例示例','演示如何组合模型、Agent 和工具。'],['tests/','测试验证','查看已有的离线行为验证。']];
  $('practice-panel').innerHTML=groups.map(([prefix,title,description])=>{
    const items=mapViews.practice.filter(node=>node.file.startsWith(prefix));
    if(!items.length)return '';
    return `<section class="practice-group"><div class="practice-heading"><h2>${title}<small>${items.length}</small></h2><p>${description}</p></div><div class="practice-grid">${items.map(node=>{
      const links=relations.filter(([from])=>from===node.id);
      return `<article class="practice-card"><button class="practice-source" data-practice="${node.id}"><span class="practice-symbol">ƒ</span><strong>${escape(node.title)}</strong><span aria-hidden="true">↗</span><small>${escape(node.file)}</small><p>${escape(node.desc)}</p></button><div class="practice-links"><span>关联实现</span>${links.map(([,to,label])=>`<button data-implementation="${to}" title="${escape(label)}">${escape(byId[to].title)} ↗</button>`).join('')}</div></article>`;
    }).join('')}</div></section>`;
  }).join('');
  $('practice-panel').querySelectorAll('[data-practice]').forEach(button=>{
    button.onclick=()=>{pause();reader.open(byId[button.dataset.practice]);};
  });
  $('practice-panel').querySelectorAll('[data-implementation]').forEach(button=>{
    button.onclick=()=>{pause();reader.open(byId[button.dataset.implementation]);};
  });
}
function pause(){playing=false;clearTimeout(timer);$('play').textContent='▶ 播放';}
function renderCase() {
  const flow = activeFlow();
  $('flow-description').textContent = activeCase().description;
  $('case-progress').max = flow.length;
  $('case-progress').value = stepIndex + 1;
  $('case-steps').innerHTML = flow.map((event, index) => `<button data-case-step="${index}" ${index === stepIndex ? 'aria-current="step"' : ''} class="${index < stepIndex ? 'completed' : ''}">${index + 1}<span>${escape(event.title)}</span></button>`).join('');
  $('case-steps').querySelectorAll('button').forEach(button => {
    button.onclick = () => {pause();showStep(Number(button.dataset.caseStep));};
  });
  $('previous').disabled = stepIndex <= 0;
  $('step').disabled = stepIndex >= flow.length - 1;
  $('current-code').disabled = stepIndex < 0;
  $('case-steps').querySelector('[aria-current]')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function reset() {
  pause();stepIndex = -1;
  $('step-counter').textContent = '准备就绪';
  $('event-title').textContent = activeCase().title;
  $('event-text').textContent = '按源码展开调用与引用。分支和循环为静态结构，不执行示例，也不预设模型返回。';
  $('event-data').textContent = '选择步骤可查看调用参数、返回约定和对应源码';
  $('case-input').textContent = '尚未开始';$('case-output').textContent = '尚未开始';
  renderCase();renderGraph();
  if(mode==='flow'){zoom=1;centerMap();}
}
function showStep(index) {
  stepIndex = index;
  setMode('flow');
  const event = activeFlow()[index];
  selectNode(event.node);
  $('step-counter').textContent = `${index + 1} / ${activeFlow().length}`;
  $('event-title').textContent = event.title;
  $('event-text').textContent = event.text;
  $('event-data').textContent = `${event.ref.file} · ${event.ref.symbol || '文件入口'}`;
  $('case-input').textContent = event.input;
  $('case-output').textContent = event.output;
  renderCase();
  // 相机保持当前倍率，仅在执行节点离开视口时平移到该节点。
  const box = nodeBox(visibleId(event.node));
  const x = camera.x + box.x * zoom, y = camera.y + box.y * zoom;
  if (x < 20 || y < 40 || x + box.w * zoom > $('canvas').clientWidth - 20 || y + box.h * zoom > $('canvas').clientHeight - 40) {
    camera.x = $('canvas').clientWidth / 2 - (box.x + box.w / 2) * zoom;
    camera.y = $('canvas').clientHeight / 2 - (box.y + box.h / 2) * zoom;
    applyCamera();
  }
  if (index === activeFlow().length - 1) pause();
}
function advance() {
  if (stepIndex >= activeFlow().length - 1) {pause();return false;}
  showStep(stepIndex + 1);return true;
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
  const exampleResponse=await fetch('examples.json',{cache:'no-store'});
  const catalog=await exampleResponse.json();
  cases=buildExamples(catalog,sources,notes);
  $('flow-path').innerHTML=catalog.map(entry=>`<option value="${escape(entry.id)}">${escape(entry.title)}</option>`).join('');
  for(const item of Object.values(cases)){
    for(const node of [...item.nodes,...item.views.compact.nodes])byId[node.id]=node;
  }
  const diagrams=new DiagramViewer($('diagram-panel'),ref=>reader.open({id:'diagram-source',title:ref.label,file:ref.file,symbol:ref.symbol}));
  const openDiagram=id=>{pause();setMode('diagram');diagrams.show(id);};
  // Load only the small catalog up front so source popups can expose related flows.
  try{await diagrams.load();}catch(error){console.warn(error.message);}
  reader=new SourceReader(sources,nodes,node=>{if(node)selected=node.id;renderGraph();},{related:(file,symbol)=>diagrams.related(file,symbol),open:id=>{$('detail-dialog').close();openDiagram(id);}});
  $('diagram-tab').onclick=()=>openDiagram(diagrams.scene?.id);
  $('flow-path').onchange=reset;
  $('previous').onclick=()=>{pause();if(stepIndex>0)showStep(stepIndex-1);};
  $('current-code').onclick=()=>{pause();const event=activeFlow()[stepIndex];reader.openAt(event.ref,byId[event.node]);};
  $('play').onclick=()=>{if(playing){pause();return;}if(stepIndex>=activeFlow().length-1)reset();playing=true;$('play').textContent='Ⅱ 暂停';tick();};
  $('step').onclick=()=>{pause();advance();};$('reset').onclick=reset;
  $('speed').onchange=()=>{if(playing){clearTimeout(timer);timer=setTimeout(tick,Number($('speed').value));}};
  $('structure-tab').onclick=()=>{pause();setMode('structure');};$('flow-tab').onclick=()=>setMode('flow');
  $('practice-tab').onclick=()=>{pause();setMode('practice');};
  $('zoom-in').onclick=()=>zoomAt(Math.min(1.5,zoom+.1));$('zoom-out').onclick=()=>zoomAt(Math.max(.25,zoom-.1));$('fit').onclick=fit;
  $('zoom-label').onclick=()=>zoomAt(1);
  $('reset-layout').onclick=()=>{pause();visibleNodes().forEach(n=>Object.assign(n,n.initialPosition||initialPositions[n.id]));renderGraph();zoom=1;centerMap();};
  $('compact-view').onclick=()=>switchDetail('compact');$('full-view').onclick=()=>switchDetail('full');
  $('guide').onclick=()=>{pause();$('guide-dialog').showModal();};document.querySelector('.dialog-close').onclick=()=>$('guide-dialog').close();
  // 初次打开和调整窗口大小均保留用户倍率；仅点击适应画布时自动缩放。
  renderPractice();reset();
  const errors=validateModel(sources,nodes,relations,notes,cases,diagrams.scenes);
  $('sync-status').textContent=errors.length?'有源码引用待更新':'源码引用已核对';
  $('sync-status').title=errors.length?errors.join('\n'):'节点、步骤、案例与源码定位检查通过；命令行检查可进一步检测快照是否过期。';
  $('sync-status').classList.toggle('has-errors',errors.length>0);
  if(errors.length){$('play').disabled=true;$('step').disabled=true;console.error(errors.join('\n'));}
  bindMapPan();new ResizeObserver(applyCamera).observe($('canvas'));renderGraph();centerMap();
}
init();
