(()=>{'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFC').replace(/[\u200b-\u200d\ufeff]/g,'').toLowerCase();
let FIRST=true,IDX=null, ROUNDS=[], CUR=null, CAT='', Q='', BRIEFS=null; const cache={};
const reader=$('#reader'), q=$('#q');
function route(){const m=location.hash.match(/^#\/(\d{4}-\d\d-\d\d)\/(\d{4})(?:\/([\w-]+))?/);return m?{id:m[1]+'/'+m[2],sec:m[3]||''}:null}
function go(id,sec){const h='#/'+id+(sec?'/'+sec:'');if(location.hash===h)render();else location.hash=h}
// ---------- tree
function buildTree(){
  const rs=ROUNDS.filter(r=>!CAT||r.secs.some(s=>s.c===CAT));
  const mons=new Map();
  rs.forEach(r=>{const mk=r.date.slice(0,7);if(!mons.has(mk))mons.set(mk,{label:r.mon,days:new Map()});const M=mons.get(mk);if(!M.days.has(r.date))M.days.set(r.date,{label:r.dlabel,rs:[]});M.days.get(r.date).rs.push(r)});
  const curDate=CUR?CUR.split('/')[0]:(rs[0]&&rs[0].date);let mi=0,html='';
  for(const [mk,M] of mons){
    const openM=mi++===0||(curDate||'').startsWith(mk);
    html+=`<details class="mon" ${openM?'open':''}><summary>${esc(M.label)}<span class="cnt">${[...M.days.values()].reduce((a,d)=>a+d.rs.length,0)}</span></summary>`;
    let di=0;for(const [dk,D] of M.days){
      const openD=dk===curDate||(di===0&&mi===1&&!curDate);di++;
      html+=`<details class="day" ${openD?'open':''}><summary>${esc(D.label)}<span class="cnt">${D.rs.length} รอบ</span></summary><div class="rounds">`+
        D.rs.map(r=>`<a class="rd ${r.id===CUR?'cur':''}" href="#/${r.id}" title="${esc(r.title)}"><span class="dot ${r.sev}"></span><b>${r.time}</b><span class="rt">${esc((r.title.split('|')[0]||'').replace('📰','').trim())}</span></a>`).join('')+`</div></details>`;
    }
    html+='</details>';
  }
  $('#tree').innerHTML=html||'<p class="muted">ไม่มีรอบในหมวดนี้</p>';
}
// ---------- chips
function buildChips(){
  $('#chips').innerHTML=`<button class="chip ${CAT?'':'on'}" data-c="">ทั้งหมด</button>`+IDX.cats.filter(c=>c.k!=='src').map(c=>`<button class="chip ${CAT===c.k?'on':''}" data-c="${c.k}">${esc(c.l)}</button>`).join('');
}
$('#chips').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;CAT=b.dataset.c===CAT?'':b.dataset.c;buildChips();buildTree();search();});
// ---------- search (substring, Thai-friendly: no word segmentation needed)
function terms(){return norm(Q).split(/\s+/).filter(Boolean)}
function snippet(text,ts){
  const n=norm(text);let p=-1;for(const t of ts){p=n.indexOf(t);if(p>=0)break}
  if(p<0)p=0;const a=Math.max(0,p-50),b=Math.min(text.length,p+130);
  let s=(a?'…':'')+text.slice(a,b)+(b<text.length?'…':'');return mark(esc(s),ts);
}
function mark(h,ts){if(!ts.length)return h;const rx=new RegExp('('+ts.map(t=>esc(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');return h.replace(/(<[^>]*>)|([^<]+)/g,(m,tag,txt)=>tag?tag:txt.replace(rx,'<mark>$1</mark>'))}
let st;q.addEventListener('input',()=>{clearTimeout(st);st=setTimeout(()=>{Q=q.value.trim();$('#clearQ').hidden=!Q;search();if(CUR)highlight()},120)});
$('#clearQ').onclick=()=>{q.value='';Q='';$('#clearQ').hidden=true;search();highlight();q.focus()};
function search(){
  const box=$('#results'),ts=terms();
  if(!ts.length&&!CAT){box.hidden=true;return}
  const hits=[];
  for(const r of ROUNDS)for(const s of r.secs){
    if(s.c==='brief')continue; if(CAT&&s.c!==CAT)continue;
    const hay=norm(s.n+' '+s.t); if(ts.length&&!ts.every(t=>hay.includes(t)))continue;
    let score=0;for(const t of ts){let i=-1;while((i=hay.indexOf(t,i+1))>=0)score++}
    hits.push({r,s,score});
  }
  if(ts.length)hits.sort((a,b)=>b.score-a.score||(a.r.id<b.r.id?1:-1));
  const shown=hits.slice(0,150);
  box.hidden=false;
  box.innerHTML=`<div class="rhead">${ts.length?`🔎 “${esc(Q)}” `:''}${CAT?esc((IDX.cats.find(c=>c.k===CAT)||{}).l||''):''} · พบ ${hits.length} ตอน${hits.length>150?' (แสดง 150)':''}</div>`+
   (shown.map(h=>`<a class="hit" href="#/${h.r.id}/${h.s.s}"><span class="hm">${esc(h.r.label)} · ${esc(h.s.n)}</span>${snippet(h.s.t,ts)}</a>`).join('')||'<p class="muted" style="padding:8px 10px">ไม่พบผลลัพธ์ ลองคำที่สั้นลง</p>');
}
$('#results').addEventListener('click',e=>{if(e.target.closest('.hit'))closeDrawer()});
$('#tree').addEventListener('click',e=>{if(e.target.closest('.rd'))closeDrawer()});
// ---------- reader
async function load(f){if(!cache[f]){const r=await fetch('data/r/'+f+'.json',{cache:'no-cache'});if(!r.ok)throw new Error(r.status);cache[f]=await r.json()}return cache[f]}
async function render(){
  const rt=route()||{id:ROUNDS[0].id,sec:''};
  const i=ROUNDS.findIndex(r=>r.id===rt.id);
  if(i<0){reader.innerHTML=`<p>ไม่พบรอบ ${esc(rt.id)} · <a href="#/">ไปรอบล่าสุด</a></p>`;return}
  const meta=ROUNDS[i];
  if(CUR!==meta.id){
    CUR=meta.id;reader.innerHTML='<p class="muted">⏳ กำลังโหลด…</p>';
    let d;try{d=await load(meta.f)}catch(e){reader.innerHTML='<p>โหลดไม่สำเร็จ ลองรีเฟรช</p>';return}
    if(CUR!==meta.id)return;
    const older=ROUNDS[i+1],newer=ROUNDS[i-1];
    const pn=`<nav class="pn"><a class="btn" ${older?`href="#/${older.id}"`:'disabled'} data-k="prev">◀ รอบก่อน${older?' · '+esc(older.label):''}</a><a class="btn" ${newer?`href="#/${newer.id}"`:'disabled'} data-k="next">${newer?esc(newer.label)+' · ':''}รอบถัดไป ▶</a></nav>`;
    reader.innerHTML=`<article><header class="rh"><div class="rlabel">${esc(d.label)}</div><h1>${esc(d.title)}</h1><div class="rsub">${d.sub||''}</div></header>`+
      `<nav class="toc">`+d.secs.filter(s=>s.c!=='src').map(s=>`<a href="#/${meta.id}/${s.s}">${esc(s.n)}</a>`).join('')+`</nav>`+
      d.secs.map(s=>`<section id="s-${s.s}" class="sec c-${s.c}"><h2>${esc(s.n)}</h2><div class="sb">${s.h}</div>${s.c==='brief'&&document.body.dataset.briefs==='1'?`<button class="btn unlock" data-id="${meta.id}">🔓 ทีมงาน: ปลดล็อก</button>`:''}</section>`).join('')+
      `</article>${pn}<div class="kbd">ใช้ปุ่ม ← → บนคีย์บอร์ดเพื่อเปลี่ยนรอบ · <a href="r/${meta.f}.html">ลิงก์ถาวร</a></div><footer class="foot">อัปเดตล่าสุด ${esc(IDX.updatedLabel)} · ข่าวสาธารณะจากสื่อเปิด ตรวจสอบกับแหล่งต้นทางก่อนอ้างอิง</footer>`;
    document.title=`${d.title} | GrokNews คลังข่าว`;
    if(BRIEFS)fillBriefs();
    buildTree();highlight();
    $('#main').scrollTop=0;
  }
  if(rt.sec){const s=document.getElementById('s-'+rt.sec);if(s){s.scrollIntoView({behavior:FIRST?'auto':'smooth',block:'start'});s.classList.remove('flash');void s.offsetWidth;s.classList.add('flash')}}
}
function highlight(){
  reader.querySelectorAll('mark.qh').forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));reader.normalize();
  const ts=terms();if(!ts.length)return;
  const w=document.createTreeWalker(reader.querySelector('article')||reader,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  for(const n of nodes){const t=n.nodeValue,l=norm(t);let pos=0,frag=null;
    for(;;){let best=-1,bl=0;for(const x of ts){const p=l.indexOf(x,pos);if(p>=0&&(best<0||p<best)){best=p;bl=x.length}}
      if(best<0)break;frag=frag||document.createDocumentFragment();frag.append(t.slice(pos,best));const m=document.createElement('mark');m.className='qh';m.textContent=t.slice(best,best+bl);frag.append(m);pos=best+bl}
    if(frag){frag.append(t.slice(pos));n.replaceWith(frag)}}
}
// ---------- briefs (team only; encrypted bundle)
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function unlock(){
  const pw=prompt('รหัสผ่านทีมงาน');if(!pw)return;
  try{const B=await (await fetch('data/briefs.json',{cache:'no-cache'})).json();
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
    const wk=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(B.salt),iterations:B.it,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
    const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(B.wiv)},wk,b64(B.wkey));
    const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
    const gz=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(B.iv)},k,b64(B.ct));
    const txt=await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    BRIEFS=JSON.parse(txt);fillBriefs();
  }catch(e){alert('รหัสผ่านไม่ถูกต้อง')}
}
function fillBriefs(){reader.querySelectorAll('.c-brief').forEach(s=>{const h=BRIEFS[CUR];s.querySelector('.sb').innerHTML=h||'<p class="lock">ไม่มี Brief ในรอบนี้</p>';const b=s.querySelector('.unlock');if(b)b.remove()})}
reader.addEventListener('click',e=>{if(e.target.closest('.unlock'))unlock()});
// ---------- keys, drawer
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea')){if(e.key==='Escape'){q.blur()}return}
  if(e.key==='/'){e.preventDefault();openDrawer();q.focus();return}
  const k=e.key==='ArrowLeft'?'prev':e.key==='ArrowRight'?'next':'';if(!k||e.altKey||e.metaKey||e.ctrlKey)return;
  const a=reader.querySelector(`.pn [data-k=${k}][href]`);if(a){e.preventDefault();location.hash=a.getAttribute('href')}
});
function openDrawer(){document.body.classList.add('drawer');$('#scrim').hidden=false}
function closeDrawer(){document.body.classList.remove('drawer');$('#scrim').hidden=true}
$('#openSide').onclick=openDrawer;$('#closeSide').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;
$('#openSearch').onclick=()=>{openDrawer();setTimeout(()=>q.focus(),220)};
window.addEventListener('hashchange',render);
// ---------- boot
fetch('data/index.json',{cache:'no-cache'}).then(r=>r.json()).then(d=>{IDX=d;ROUNDS=d.rounds;$('#upd').textContent=d.updatedLabel;buildChips();
  if(!ROUNDS.length){reader.innerHTML='<p>ยังไม่มีข้อมูล</p>';return}
  const sp=new URLSearchParams(location.search),p=sp.get('q'),c=sp.get('cat');
  if(c&&IDX.cats.some(x=>x.k===c&&c!=='src')){CAT=c;buildChips();buildTree&&buildTree()}
  if(p){q.value=p;Q=p;$('#clearQ').hidden=false}
  if(p||CAT)search();
  if(sp.get('drawer')||((p||CAT)&&matchMedia('(max-width:860px)').matches))openDrawer();
  render().then(()=>{FIRST=false})}).catch(()=>reader.innerHTML='<p>โหลดข้อมูลไม่สำเร็จ</p>');
})();
