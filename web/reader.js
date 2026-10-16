import {notes,files} from './knowledge.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=(file,symbol)=>`${file}::${symbol||''}`;

// 调用导航只接受索引里的“文件 + 限定符号”，不做全局同名匹配。
export class SourceReader {
  constructor(sources,mapNodes,onNavigate,flows){
    this.sources=sources;this.nodes=mapNodes;this.onNavigate=onNavigate;this.frames=[];this.flows=flows;
    $('back').onclick=()=>{if(this.frames.length>1){this.saveScroll();this.frames.pop();this.render();}};
    $('close-detail').onclick=()=>$('detail-dialog').close();
    $('detail-dialog').addEventListener('close',()=>{
      document.body.classList.remove('modal-open');
      document.querySelector(`.graph-node[data-node="${this.returnNode}"]`)?.focus();
    });
    $('detail-dialog').addEventListener('click',event=>{
      if(event.target!==$('detail-dialog'))return;
      const r=$('detail-dialog').getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('detail-dialog').close();
    });
  }
  open(node){
    this.returnNode=node.id;this.frames=[];
    this.navigate(node.file,node.symbol,node);
    if(!$('detail-dialog').open)$('detail-dialog').showModal();
    document.body.classList.add('modal-open');
  }
  saveScroll(){
    const f=this.frames.at(-1);if(!f)return;
    f.codeScroll=$('source-code')?.scrollTop||0;f.noteScroll=document.querySelector('.reader-notes')?.scrollTop||0;
  }
  navigate(file,symbol,node){
    this.saveScroll();
    if(this.frames.at(-1)&&key(file,symbol)===key(this.frames.at(-1).file,this.frames.at(-1).symbol))return;
    const base=node||this.nodes.find(n=>n.file===file&&n.symbol===symbol)||this.nodes.find(n=>n.file===file);
    this.frames.push({file,symbol,node:base,step:-1,wrap:false});this.render();
  }
  code(frame){
    const source=this.sources[frame.file];if(!source)return null;
    const span=frame.symbol?source.symbols[frame.symbol]:{start:1,end:source.code.split('\n').length};
    if(!span)return null;
    return {...span,lines:source.code.split('\n').slice(span.start-1,span.end),source};
  }
  syntax(text){
    const pattern=/(#.*$|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|\b(?:def|class|return|if|else|elif|for|in|import|from|as|try|except|raise|with|yield|None|True|False|not|and|or|pass|while|continue|break|super)\b)/g;
    let html='',last=0;
    for(const m of text.matchAll(pattern)){
      html+=esc(text.slice(last,m.index));const value=m[0];
      const type=value.startsWith('#')?'comment':/^['"]/.test(value)?'string':'keyword';
      html+=`<span class="tok-${type}">${esc(value)}</span>`;last=m.index+value.length;
    }
    return html+esc(text.slice(last));
  }
  line(text,line,source){
    let html='',last=0;
    for(const c of (source.calls||[]).filter(c=>c.line===line).sort((a,b)=>a.start-b.start)){
      if(c.start<last)continue;
      html+=this.syntax(text.slice(last,c.start));
      html+=`<button class="code-link" data-file="${esc(c.file)}" data-symbol="${esc(c.symbol)}" title="查看 ${esc(c.file)} · ${esc(c.symbol)}">${esc(text.slice(c.start,c.end))}</button>`;
      last=c.end;
    }
    return html+this.syntax(text.slice(last));
  }
  range(step,code){
    const from=code.lines.findIndex(line=>line.includes(step.needle));if(from<0)return null;
    const end=step.end?code.lines.findIndex((line,i)=>i>=from&&line.includes(step.end)):from;
    return {start:code.start+from,end:code.start+(end<0?from:end)};
  }
  render(){
    const frame=this.frames.at(-1);if(!frame)return;
    const {file,symbol,node}=frame,code=this.code(frame),note=notes[key(file,symbol)]||{};
    const title=symbol||node?.title||file;
    const direct=node?.file===file&&node?.symbol===symbol;
    const summary=note.summary||(direct&&node.summary)||code?.doc||'当前源码实现。沿右侧调用链接查看依赖函数，左侧列出实际输入输出与关联。';
    const points=note.points||(direct?node?.points:[])||[];
    const relatedFlows=this.flows?.related(file,symbol)||[];
    const framework=file.startsWith('hello_agents/');
    $('back').disabled=this.frames.length<2;
    $('detail-status').className=`status ${note.warning?'partial':'ready'}`;
    $('detail-status').textContent=note.warning?'需注意':framework?'框架源码':'项目源码';
    $('call-chain').innerHTML=this.frames.map((f,i)=>`<button data-depth="${i}" ${i===this.frames.length-1?'aria-current="location"':''} title="${esc(f.file)}">${esc(f.symbol||f.file)}<small>${f.file.startsWith('hello_agents/')?'框架':'项目'}</small></button>`).join('<span aria-hidden="true">›</span>');
    const calls=code?(code.source.calls||[]).filter(c=>c.line>=code.start&&c.line<=code.end):[];
    const unique=[...new Map(calls.filter(c=>key(c.file,c.symbol)!==key(file,symbol)).map(c=>[key(c.file,c.symbol),c])).values()];
    // 展示已知的接口不匹配时，仍允许查看实际存在的替代实现。
    if(file===files.simple&&symbol==='SimpleAgent.remove_tool')unique.push({file:files.registry,symbol:'ToolRegistry.unregister'});
    $('detail-content').innerHTML=`
      <section class="reader-notes" aria-label="功能讲解">
        <div class="reader-heading"><span class="origin-badge ${framework?'framework':''}">${framework?'框架实现':'项目实现'}</span><h2 id="detail-title">${esc(title)}</h2><p class="reader-summary">${esc(summary)}</p></div>
        ${node?.members?`<div class="reader-section component-members"><h3>${esc(node.title)}内的节点</h3><div class="reader-relations">${node.members.map(member=>`<button data-file="${esc(member.file)}" data-symbol="${esc(member.symbol||'')}">${esc(member.title)} ↗<small>${esc(member.file)}</small></button>`).join('')}</div></div>`:''}
        ${note.warning?`<div class="reader-warning">${esc(note.warning)}</div>`:''}
        ${relatedFlows.length?`<div class="reader-section reader-flows"><h3>相关流程图</h3><div class="reader-relations">${relatedFlows.map(s=>`<button data-diagram="${esc(s.id)}">${esc(s.title)} ↗<small>${esc(s.kind)}</small></button>`).join('')}</div></div>`:''}
        <div class="reader-section"><h3>输入与输出</h3><dl><dt>输入</dt><dd>${esc(note.input||(direct&&node?.input)||'见函数签名')}</dd><dt>输出</dt><dd>${esc(note.output||(direct&&node?.output)||'见源码返回值')}</dd></dl></div>
        ${points.length?`<div class="reader-section"><h3>关键说明</h3><ul>${points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`:''}
        ${note.steps?.length&&code?`<div class="reader-section"><h3>执行步骤 <small>点击定位源码</small></h3><div class="reader-steps">${note.steps.map((s,i)=>`<button class="reader-step" data-step="${i}" aria-pressed="${frame.step===i}"><span>${String(i+1).padStart(2,'0')}</span><div><strong>${esc(s.title)}</strong><p>${esc(s.text)}</p></div></button>`).join('')}</div></div>`:''}
        <div class="reader-section"><h3>调用与依赖</h3><div class="reader-relations">${unique.map(c=>`<button data-file="${esc(c.file)}" data-symbol="${esc(c.symbol)}">${esc(c.symbol)} ↗<small>${esc(c.file)}</small></button>`).join('')||'<p class="reader-empty">此片段没有已索引的跨函数调用。</p>'}</div></div>
      </section>
      <section class="reader-source" aria-label="真实源码">
        <div class="reader-file"><span>${esc(file)}</span><small>${code?`L${code.start}–L${code.end}`:'索引不可用'}</small></div>
        <div class="reader-tools"><select id="source-symbol" aria-label="选择查看的函数"></select><button id="wrap-source" aria-pressed="${frame.wrap}">自动换行</button><button id="copy-code">复制</button></div>
        ${code?`<div id="source-code" class="code-block ${frame.wrap?'wrap':''}" tabindex="0" aria-label="${esc(title)} 源码">${code.lines.map((line,i)=>`<div class="code-line" data-line="${code.start+i}"><span class="line-number">${code.start+i}</span><span class="line-content">${this.line(line,code.start+i,code.source)||' '}</span></div>`).join('')}</div>`:'<div class="reader-empty">源码未索引，请在项目环境中运行 python web/generate_sources.py 后刷新。</div>'}
        <div class="reader-code-hint">下划线调用可进入真实实现 · 外部 SDK / 动态工具的未索引调用不猜测跳转</div>
      </section>`;
    const picker=$('source-symbol'),source=this.sources[file],prefix=symbol?.includes('.')?symbol.split('.')[0]:null;
    const names=Object.keys(source?.symbols||{}).filter(s=>!prefix||s===prefix||s.startsWith(prefix+'.'));
    if(!symbol){const opt=document.createElement('option');opt.value='';opt.textContent='完整文件';picker.append(opt);}
    names.forEach(s=>{const opt=document.createElement('option');opt.value=s;opt.textContent=s;picker.append(opt);});
    picker.value=symbol||'';picker.disabled=!source;
    picker.onchange=()=>this.navigate(file,picker.value||undefined);
    $('detail-content').querySelectorAll('[data-diagram]').forEach(b=>b.onclick=()=>this.flows.open(b.dataset.diagram));
    $('detail-content').querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>this.navigate(b.dataset.file,b.dataset.symbol));
    $('call-chain').querySelectorAll('button').forEach(b=>b.onclick=()=>{this.saveScroll();this.frames.length=Number(b.dataset.depth)+1;this.render();});
    $('call-chain').querySelector('[aria-current]')?.scrollIntoView?.({block:'nearest',inline:'end'});
    $('detail-content').querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{
      frame.step=Number(b.dataset.step);this.markStep(true);
    });
    $('wrap-source').onclick=()=>{frame.wrap=!frame.wrap;$('source-code')?.classList.toggle('wrap',frame.wrap);$('wrap-source').setAttribute('aria-pressed',String(frame.wrap));};
    $('copy-code').disabled=!code;
    $('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(code.lines.join('\n'));$('copy-code').textContent='已复制';}catch{$('copy-code').textContent='请选中复制';}};
    this.markStep(false);
    if($('source-code'))$('source-code').scrollTop=frame.codeScroll||0;
    document.querySelector('.reader-notes').scrollTop=frame.noteScroll||0;
    this.onNavigate?.(node);
  }
  markStep(scroll){
    const frame=this.frames.at(-1),code=this.code(frame),step=notes[key(frame.file,frame.symbol)]?.steps?.[frame.step];
    const range=step&&code?this.range(step,code):null;
    $('detail-content').querySelectorAll('[data-line]').forEach(el=>el.classList.toggle('line-active',!!range&&Number(el.dataset.line)>=range.start&&Number(el.dataset.line)<=range.end));
    $('detail-content').querySelectorAll('[data-step]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.step)===frame.step)));
    if(scroll&&range)$('source-code').querySelector(`[data-line="${range.start}"]`)?.scrollIntoView?.({block:'center',inline:'nearest'});
  }
}
