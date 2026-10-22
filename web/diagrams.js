import {diagramKinds, filterDiagrams} from './diagram-types.js';
import {fixedDiagramLayout, MIN_FIXED_ZOOM} from './diagram-layout.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Mermaid is bundled locally and loaded only on the first visit to this view.
// Graph definitions come from the documented catalog, never from executable callbacks.
export class DiagramViewer {
  constructor(root,onSource){
    this.root=root;this.onSource=onSource;this.scenes=[];this.states=new Map();this.ticket=0;
    root.innerHTML=`<div class="diagram-toolbar"><label>类型 <select id="diagram-type" aria-label="筛选图表类型"></select></label><label>图表 <select id="diagram-scene" aria-label="选择核心流程"></select></label><span id="diagram-count" aria-live="polite"></span><div class="diagram-actions"><button id="diagram-minus" aria-label="缩小流程图">−</button><button id="diagram-scale" title="恢复 100%">100%</button><button id="diagram-plus" aria-label="放大流程图">+</button><button id="diagram-fit">适应画布</button></div></div><div class="diagram-heading"><span id="diagram-kind"></span><h2 id="diagram-title"></h2></div><p id="diagram-description"></p><div class="diagram-legend" id="diagram-legend" aria-label="图表阅读提示"></div><div id="diagram-viewport" tabindex="0" aria-label="流程图，可用右键或中键拖动"><div id="diagram-stage"></div><span class="diagram-hint">下划线可查看源码 · 右键 / 中键拖动 · Ctrl + 滚轮缩放</span></div><div id="diagram-sources" aria-label="本流程相关源码"></div><details class="diagram-definition"><summary>图定义与来源</summary><p id="diagram-document"></p><button id="diagram-copy">复制 Mermaid</button><pre id="diagram-definition"></pre></details>`;
    this.stage=root.querySelector('#diagram-stage');this.viewport=root.querySelector('#diagram-viewport');
    this.fixed=false;
    this.fixedLayout=null;
    this.scrollArea=document.createElement('div');
    this.scrollArea.className='diagram-scroll-area';
    this.stage.before(this.scrollArea);this.scrollArea.append(this.stage);
    this.pinButton=document.createElement('button');
    this.pinButton.id='diagram-pin';this.pinButton.textContent='固定画布';
    this.pinButton.setAttribute('aria-pressed','false');
    root.querySelector('.diagram-actions').append(this.pinButton);
    this.pinButton.onclick=()=>this.setFixed(!this.fixed);
    this.select=root.querySelector('#diagram-scene');
    this.typeSelect=root.querySelector('#diagram-type');
    this.typeSelect.onchange=()=>{
      this.updateOptions();
      this.show(this.select.value);
    };
    this.select.onchange=()=>this.show(this.select.value);
    root.querySelector('#diagram-minus').onclick=()=>{if(this.state)this.zoom(this.currentZoom/1.2);};
    root.querySelector('#diagram-plus').onclick=()=>{if(this.state)this.zoom(this.currentZoom*1.2);};
    root.querySelector('#diagram-scale').onclick=()=>this.zoom(1);
    root.querySelector('#diagram-fit').onclick=()=>this.fit();
    root.querySelector('#diagram-copy').onclick=async()=>{try{await navigator.clipboard.writeText(this.scene.code);root.querySelector('#diagram-copy').textContent='已复制';}catch{root.querySelector('#diagram-copy').textContent='请选中下方定义复制';}};
    this.bindPan();
    new ResizeObserver(()=>{if(this.fixed&&this.size)this.fitFixed();}).observe(this.viewport,{box:'border-box'});
    document.addEventListener('keydown',event=>{
      // 源码弹窗优先处理自己的 Esc；关闭弹窗后仍保持固定画布。
      if(!this.fixed||document.querySelector('dialog[open]'))return;
      if(event.key==='Escape'){event.preventDefault();this.setFixed(false);}
      if(event.key==='Tab'){
        const controls=[...this.root.querySelectorAll('button,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
  }
  async load(){
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      const response=await fetch('diagrams.json',{cache:'no-store'});
      if(!response.ok)throw Error('无法读取 diagrams.json，请重新运行 python web/generate_sources.py');
      this.scenes=await response.json();
      this.typeSelect.innerHTML=`<option value="">全部类型</option>`+diagramKinds(this.scenes).map(({kind,count})=>`<option value="${esc(kind)}">${esc(kind)} · ${count}</option>`).join('');
      this.updateOptions();
    })();
    try{await this.loading;}catch(e){this.loading=null;throw e;}
  }
  updateOptions(preferred=this.scene?.id){
    const scenes=filterDiagrams(this.scenes,this.typeSelect.value);
    this.select.innerHTML=scenes.map(scene=>`<option value="${esc(scene.id)}">${esc(scene.title)}</option>`).join('');
    if(scenes.some(scene=>scene.id===preferred))this.select.value=preferred;
    this.root.querySelector('#diagram-count').textContent=`${scenes.length} 个图表${this.fixed?' · 最小 90%，超出可滚动':''}`;
  }
  related(file,symbol){return this.scenes.filter(s=>s.sources.some(ref=>ref.file===file&&(!symbol||ref.symbol===symbol||ref.symbol.startsWith(symbol+'.'))));}
  async show(id){
    const ticket=++this.ticket;
    try{
      await this.load();if(ticket!==this.ticket)return;
      this.scene=this.scenes.find(s=>s.id===id)||this.scenes[0];
      const scene=this.scene;
      // 从源码弹窗跨类型跳转时，同步筛选条件，避免已打开的图不在列表中。
      if(this.typeSelect.value&&this.typeSelect.value!==scene.kind)this.typeSelect.value=scene.kind;
      this.updateOptions(scene.id);
      this.state=null;this.size=null;this.stage.style.transform='translate(24px,24px)';
      this.root.querySelector('#diagram-kind').textContent=scene.kind;
      this.root.querySelector('#diagram-title').textContent=scene.title;
      this.root.dataset.kind=scene.kind;
      this.root.querySelector('#diagram-legend').innerHTML=scene.code.trim().startsWith('flowchart')?
        '<span><i class="legend-process"></i>处理步骤</span><span><i class="legend-decision"></i>条件判断</span><span>箭头表示执行方向 · 下划线可查看源码</span>':
        scene.code.trim().startsWith('sequenceDiagram')?'<span><i class="legend-process"></i>参与者</span><span><i class="legend-lifeline"></i>生命线</span><span>从上到下阅读 · 实线调用 / 虚线返回</span>':'';
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
        this.mermaid.initialize({
          startOnLoad:false,securityLevel:'strict',theme:'base',
          fontFamily:'"Segoe UI", "Microsoft YaHei", sans-serif',
          themeVariables:{
            fontSize:'16px',primaryColor:'#edf4fc',primaryTextColor:'#20364d',primaryBorderColor:'#8eaaca',
            lineColor:'#526d87',secondaryColor:'#fff5e5',secondaryTextColor:'#5b421c',
            tertiaryColor:'#f5f7fa',tertiaryTextColor:'#20364d',edgeLabelBackground:'#ffffff',
            clusterBkg:'#f5f8fc',clusterBorder:'#c6d4e3',titleColor:'#20364d',
            actorBkg:'#edf4fc',actorBorder:'#8eaaca',actorTextColor:'#20364d',actorLineColor:'#afbdcc',
            noteBkgColor:'#fff7e8',noteBorderColor:'#d9bc82',noteTextColor:'#5b421c',
            signalColor:'#526d87',signalTextColor:'#20364d',labelBoxBkgColor:'#eef2f7',
            labelBoxBorderColor:'#b9c9db',labelTextColor:'#20364d',loopTextColor:'#20364d',
            activationBkgColor:'#dce9f8',activationBorderColor:'#8eaaca',sequenceNumberColor:'#ffffff',
          },
          flowchart:{htmlLabels:false,useMaxWidth:false,nodeSpacing:56,rankSpacing:68,padding:20,curve:'linear',diagramPadding:24},
          sequence:{useMaxWidth:false,wrap:true,actorMargin:64,width:170,height:56,
            diagramMarginX:32,diagramMarginY:28,boxMargin:14,boxTextMargin:10,noteMargin:16,
            messageMargin:44,mirrorActors:false,actorFontSize:16,messageFontSize:15,noteFontSize:14},
        });
      }
      if(ticket!==this.ticket)return;
      // The render ID is unique even when users change scenes before a render finishes.
      const {svg}=await this.mermaid.render(`documented-flow-${ticket}`,scene.code);
      if(ticket!==this.ticket)return;
      this.stage.innerHTML=svg;
      this.stage.querySelectorAll('.node polygon').forEach(shape=>shape.closest('.node').classList.add('diagram-decision'));
      const element=this.stage.querySelector('svg'),box=element.viewBox.baseVal;
      element.dataset.scene=scene.id;
      element.setAttribute('role','group');element.setAttribute('aria-label',`${scene.kind}：${scene.title}`);
      // 当前 Mermaid 在隐藏底部参与者时仍输出固定长生命线，裁到图本身的边界。
      element.querySelectorAll('.actor-line').forEach(line=>{
        line.setAttribute('y2',Math.min(Number(line.getAttribute('y2')),box.y+box.height-16));
      });
      this.size={width:box.width||1000,height:box.height||700};
      element.style.maxWidth='none';element.setAttribute('width',this.size.width);element.setAttribute('height',this.size.height);
      this.state=this.states.get(scene.id)||{x:Math.max(28,(this.viewport.clientWidth-this.size.width)/2),y:32,zoom:1};this.states.set(scene.id,this.state);
      if(this.fixed)this.fitFixed();else this.apply();
      this.bindSources(scene);
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
  get currentZoom(){return this.fixed?this.fixedLayout?.zoom||1:this.state?.zoom||1;}
  setFixed(value){
    this.fixed=value;
    this.root.classList.toggle('diagram-fixed',value);
    document.body.classList.toggle('diagram-reading',value);
    this.pinButton.setAttribute('aria-pressed',String(value));
    this.pinButton.textContent=value?'退出固定 · Esc':'固定画布';
    this.updateOptions();
    this.viewport.setAttribute('aria-label',value?'固定图表，可上下左右滚动查看':'流程图，可用右键或中键拖动');
    this.root.querySelector('.diagram-hint').textContent=value?
      '最小 90% · 滚动 / 滑动查看全图 · 下划线可查看源码':
      '下划线可查看源码 · 右键 / 中键拖动 · Ctrl + 滚轮缩放';
    if(value){
      this.root.querySelector('.diagram-definition').open=false;
      if(this.size)this.fitFixed();
      this.viewport.focus({preventScroll:true});
    }else{
      this.scrollArea.style.width='100%';this.scrollArea.style.height='100%';
      this.viewport.scrollTo(0,0);
      this.apply();this.pinButton.focus({preventScroll:true});
    }
  }
  fitFixed(){
    this.fixedLayout=fixedDiagramLayout(this.size,this.viewport.clientWidth,this.viewport.clientHeight);
    this.apply();
    // 宽图在小屏上先呈现入口，避免用户最先看到大片空白；两侧仍可滚动到达。
    const first=this.stage.querySelector('.node, .actor');
    let left=0;
    if(first&&this.fixedLayout.width>this.viewport.clientWidth){
      const target=first.getBoundingClientRect(),view=this.viewport.getBoundingClientRect();
      left=this.viewport.scrollLeft+target.left+target.width/2-view.left-this.viewport.clientWidth/2;
    }
    this.viewport.scrollTo(Math.max(0,left),0);
  }
  apply(){
    if(!this.state)return;
    const layout=this.fixed?this.fixedLayout:this.state;
    if(!layout)return;
    const {x,y,zoom}=layout;
    if(this.fixed){this.scrollArea.style.width=`${layout.width}px`;this.scrollArea.style.height=`${layout.height}px`;}
    this.stage.style.transform=`translate(${x}px,${y}px) scale(${zoom})`;
    this.root.querySelector('#diagram-scale').textContent=`${Math.round(zoom*100)}%`;
    this.root.querySelector('#diagram-minus').disabled=this.fixed&&zoom<=MIN_FIXED_ZOOM;
  }
  zoom(value,cx=this.viewport.clientWidth/2,cy=this.viewport.clientHeight/2){
    if(!this.state)return;
    if(this.fixed){
      const previous=this.fixedLayout;
      const worldX=(this.viewport.scrollLeft+cx-previous.x)/previous.zoom;
      const worldY=(this.viewport.scrollTop+cy-previous.y)/previous.zoom;
      this.fixedLayout=fixedDiagramLayout(this.size,this.viewport.clientWidth,this.viewport.clientHeight,value);
      this.apply();
      this.viewport.scrollTo(worldX*this.fixedLayout.zoom+this.fixedLayout.x-cx,worldY*this.fixedLayout.zoom+this.fixedLayout.y-cy);
      return;
    }
    const next=Math.max(.15,Math.min(3,value)),ratio=next/this.state.zoom;
    this.state.x=cx-(cx-this.state.x)*ratio;this.state.y=cy-(cy-this.state.y)*ratio;this.state.zoom=next;this.apply();
  }
  fit(){
    if(!this.size||!this.state)return;
    if(this.fixed){this.fitFixed();return;}
    const width=this.viewport.clientWidth,height=this.viewport.clientHeight;
    this.state.zoom=Math.max(.15,Math.min(1,(width-56)/this.size.width,(height-70)/this.size.height));
    this.state.x=(width-this.size.width*this.state.zoom)/2;this.state.y=24;this.apply();
  }
  bindPan(){
    let drag=null;const v=this.viewport;
    v.addEventListener('contextmenu',e=>e.preventDefault());v.addEventListener('auxclick',e=>e.preventDefault());
    v.addEventListener('pointerdown',e=>{if(!this.state||![1,2].includes(e.button))return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};v.setPointerCapture(e.pointerId);v.classList.add('panning');});
    v.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(this.fixed){v.scrollLeft-=e.clientX-drag.x;v.scrollTop-=e.clientY-drag.y;}else{this.state.x+=e.clientX-drag.x;this.state.y+=e.clientY-drag.y;this.apply();}drag.x=e.clientX;drag.y=e.clientY;});
    const stop=()=>{drag=null;v.classList.remove('panning');};v.addEventListener('pointerup',stop);v.addEventListener('pointercancel',stop);v.addEventListener('lostpointercapture',stop);
    // 普通滚轮交给页面：可以滚过顶部工具区，让加高的画布占满视野。
    // 只有 Ctrl + 滚轮缩放时才拦截默认滚动，平移仍使用右键 / 中键拖动。
    v.addEventListener('wheel',e=>{
      if(!e.ctrlKey||!this.state)return;
      e.preventDefault();
      const unit=e.deltaMode===1?16:e.deltaMode===2?v.clientHeight:1;
      const r=v.getBoundingClientRect();
      this.zoom(this.currentZoom*Math.exp(-e.deltaY*unit*.002),e.clientX-r.left,e.clientY-r.top);
    },{passive:false});
  }
}
