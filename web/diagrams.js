const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Mermaid is bundled locally and loaded only on the first visit to this view.
// Graph definitions come from the documented catalog, never from executable callbacks.
export class DiagramViewer {
  constructor(root,onSource){
    this.root=root;this.onSource=onSource;this.scenes=[];this.states=new Map();this.ticket=0;
    root.innerHTML=`<div class="diagram-toolbar"><label>流程 <select id="diagram-scene" aria-label="选择核心流程"></select></label><span id="diagram-kind"></span><div class="diagram-actions"><button id="diagram-minus" aria-label="缩小流程图">−</button><button id="diagram-scale" title="恢复 100%">100%</button><button id="diagram-plus" aria-label="放大流程图">+</button><button id="diagram-fit">适应画布</button></div></div><p id="diagram-description"></p><div id="diagram-viewport" tabindex="0" aria-label="流程图，可用右键或中键拖动"><div id="diagram-stage"></div><span class="diagram-hint">点击带下划线的节点或消息查看源码 · 右键 / 中键拖动 · Ctrl + 滚轮缩放</span></div><div id="diagram-sources" aria-label="本流程相关源码"></div><details class="diagram-definition"><summary>图定义与来源</summary><p id="diagram-document"></p><button id="diagram-copy">复制 Mermaid</button><pre id="diagram-definition"></pre></details>`;
    this.stage=root.querySelector('#diagram-stage');this.viewport=root.querySelector('#diagram-viewport');
    this.select=root.querySelector('#diagram-scene');
    this.select.onchange=()=>this.show(this.select.value);
    root.querySelector('#diagram-minus').onclick=()=>this.zoom(this.state.zoom/1.2);
    root.querySelector('#diagram-plus').onclick=()=>this.zoom(this.state.zoom*1.2);
    root.querySelector('#diagram-scale').onclick=()=>this.zoom(1);
    root.querySelector('#diagram-fit').onclick=()=>this.fit();
    root.querySelector('#diagram-copy').onclick=async()=>{try{await navigator.clipboard.writeText(this.scene.code);root.querySelector('#diagram-copy').textContent='已复制';}catch{root.querySelector('#diagram-copy').textContent='请选中下方定义复制';}};
    this.bindPan();
  }
  async load(){
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      const response=await fetch('diagrams.json',{cache:'no-store'});
      if(!response.ok)throw Error('无法读取 diagrams.json，请重新运行 python web/generate_sources.py');
      this.scenes=await response.json();
      this.select.innerHTML=this.scenes.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
    })();
    try{await this.loading;}catch(e){this.loading=null;throw e;}
  }
  related(file,symbol){return this.scenes.filter(s=>s.sources.some(ref=>ref.file===file&&(!symbol||ref.symbol===symbol||ref.symbol.startsWith(symbol+'.'))));}
  async show(id){
    const ticket=++this.ticket;
    try{
      await this.load();if(ticket!==this.ticket)return;
      this.scene=this.scenes.find(s=>s.id===id)||this.scenes[0];
      const scene=this.scene;this.select.value=scene.id;
      this.state=null;this.size=null;this.stage.style.transform='translate(24px,24px)';
      this.root.querySelector('#diagram-kind').textContent=scene.kind;
      this.root.querySelector('#diagram-description').textContent=scene.description;
      this.root.querySelector('#diagram-document').textContent=`定义来源：${scene.document} · 静态源码分析，不是执行记录`;
      this.root.querySelector('#diagram-definition').textContent=scene.code;
      this.root.querySelector('#diagram-copy').textContent='复制 Mermaid';
      const refs=this.root.querySelector('#diagram-sources');
      refs.innerHTML='<span>相关源码</span>'+scene.sources.map((s,i)=>`<button data-ref="${i}" title="${esc(s.file)} · ${esc(s.symbol)}">${esc(s.label)} ↗</button>`).join('');
      refs.querySelectorAll('button').forEach(b=>b.onclick=()=>this.onSource(scene.sources[Number(b.dataset.ref)]));
      this.stage.textContent='正在绘制流程图…';
      if(!this.mermaid){
        const module=await import('./vendor/mermaid.js');this.mermaid=module.default;
        this.mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',fontFamily:'"Microsoft YaHei", sans-serif',themeVariables:{primaryColor:'#f3f5f8',primaryTextColor:'#263448',primaryBorderColor:'#b9c4d2',lineColor:'#8290a2',secondaryColor:'#edf3fa',tertiaryColor:'#f7f8fa',actorBkg:'#f3f5f8',actorBorder:'#b9c4d2',actorTextColor:'#263448',noteBkgColor:'#f2f5f9',noteBorderColor:'#c8d2df',noteTextColor:'#46556b',signalColor:'#56677f'},flowchart:{htmlLabels:false,useMaxWidth:false},sequence:{useMaxWidth:false,wrap:true}});
      }
      if(ticket!==this.ticket)return;
      // The render ID is unique even when users change scenes before a render finishes.
      const {svg}=await this.mermaid.render(`documented-flow-${ticket}`,scene.code);
      if(ticket!==this.ticket)return;
      this.stage.innerHTML=svg;
      const element=this.stage.querySelector('svg'),box=element.viewBox.baseVal;
      this.size={width:box.width||1000,height:box.height||700};
      element.style.maxWidth='none';element.setAttribute('width',this.size.width);element.setAttribute('height',this.size.height);
      this.state=this.states.get(scene.id)||{x:28,y:24,zoom:1};this.states.set(scene.id,this.state);
      this.apply();this.bindSources(scene);
    }catch(error){if(ticket===this.ticket)this.stage.textContent=`流程图加载失败：${error.message}。可查看下方图定义和相关源码。`;}
  }
  bindSources(scene){
    // Match visible labels only; all destinations are exact indexed file/symbol pairs.
    for(const element of this.stage.querySelectorAll('g.node,text.actor,text.messageText')){
      const label=element.textContent.replace(/\s+/g,' ').trim();
      const ref=scene.sources.find(s=>s.match&&label.includes(s.match));if(!ref)continue;
      element.classList.add('diagram-source-link');element.setAttribute('tabindex','0');element.setAttribute('role','button');element.setAttribute('aria-label',`查看源码 ${ref.label}`);
      element.addEventListener('click',()=>this.onSource(ref));
      element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.onSource(ref);}});
    }
  }
  apply(){if(!this.state)return;const {x,y,zoom}=this.state;this.stage.style.transform=`translate(${x}px,${y}px) scale(${zoom})`;this.root.querySelector('#diagram-scale').textContent=`${Math.round(zoom*100)}%`;}
  zoom(value,cx=this.viewport.clientWidth/2,cy=this.viewport.clientHeight/2){if(!this.state)return;const next=Math.max(.15,Math.min(3,value)),ratio=next/this.state.zoom;this.state.x=cx-(cx-this.state.x)*ratio;this.state.y=cy-(cy-this.state.y)*ratio;this.state.zoom=next;this.apply();}
  fit(){if(!this.size||!this.state)return;const width=this.viewport.clientWidth,height=this.viewport.clientHeight;this.state.zoom=Math.max(.15,Math.min(1,(width-56)/this.size.width,(height-70)/this.size.height));this.state.x=(width-this.size.width*this.state.zoom)/2;this.state.y=24;this.apply();}
  bindPan(){
    let drag=null;const v=this.viewport;
    v.addEventListener('contextmenu',e=>e.preventDefault());v.addEventListener('auxclick',e=>e.preventDefault());
    v.addEventListener('pointerdown',e=>{if(!this.state||![1,2].includes(e.button))return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};v.setPointerCapture(e.pointerId);v.classList.add('panning');});
    v.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;this.state.x+=e.clientX-drag.x;this.state.y+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;this.apply();});
    const stop=()=>{drag=null;v.classList.remove('panning');};v.addEventListener('pointerup',stop);v.addEventListener('pointercancel',stop);v.addEventListener('lostpointercapture',stop);
    v.addEventListener('wheel',e=>{if(!this.state)return;e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?v.clientHeight:1;if(e.ctrlKey){const r=v.getBoundingClientRect();this.zoom(this.state.zoom*Math.exp(-e.deltaY*unit*.002),e.clientX-r.left,e.clientY-r.top);}else{this.state.x-=(e.deltaX+(e.shiftKey?e.deltaY:0))*unit;this.state.y-=(e.shiftKey?0:e.deltaY)*unit;this.apply();}},{passive:false});
  }
}
