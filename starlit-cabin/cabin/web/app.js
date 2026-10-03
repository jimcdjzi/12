const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
let session = null, page = 0, busy = false, pollGeneration = 0, flowGeneration = 0, libraryGeneration = 0, audio = null, soundOn = false, stage='home', visitor='旅人', spreadTimer=null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function notice(message = '') { $('#notice').textContent = message; $('#notice').hidden = !message; }
async function api(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {...(body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}), signal:controller.signal});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '暂时未能连接，请稍后重试。');
    return data;
  } catch(error) {
    if(error.name==='AbortError') throw new Error('连接超时，请稍后重试。');
    if(error instanceof TypeError) throw new Error('暂时无法连接小屋，请确认服务正在运行后重试。');
    throw error;
  } finally { clearTimeout(timeout); }
}
function cancelFlow(clearSession=false) {
  flowGeneration++; pollGeneration++; clearTimeout(spreadTimer); busy=false;
  $('#begin-button').disabled=false;
  $('#card-fan').getAnimations({subtree:true}).forEach(a=>a.cancel());
  $('#card-fan').dataset.arriving='false';
  if(clearSession)session=null;
  return flowGeneration;
}
function setStage(next){
  stage=next;document.body.dataset.stage=next;
  if(next!=='spread'){$('#card-fan').dataset.arriving='false';$('#card-fan').getAnimations({subtree:true}).forEach(a=>a.cancel());}
  $('#scene-back').hidden=next==='home';$('#ready-action').hidden=next!=='ready';
  const guiding=next==='home'||next==='question'?'crystal':next==='ready'?'deck':null;
  document.querySelectorAll('.room-locations [data-object]').forEach(b=>b.classList.toggle('guided',b.dataset.object===guiding));
  $('#object-guide').hidden=!guiding||next==='question';$('#object-guide').dataset.object=guiding||'crystal';
  $('#object-guide').textContent=guiding==='deck'?'塔罗牌 · 心事已安放，轻触选牌':'水晶球 · 从这里开始';
  const titles={home:`${visitor}，先让水晶球听见你的心事`,question:'让心事落在月光里',ready:'顺着微光，走向桌上的塔罗牌',spread:'78 张牌，静候你的选择',reveal:'牌已落定，答案从这里展开',reading:`${visitor}，这是留给你的启示`};
  $('#journey-title').textContent=titles[next]||'';
  $('#journey-subtitle').textContent=next==='spread'?`请选择 ${session?.positions.length||3} 张牌 · 每一张都来自本局已洗好的完整牌组`:next==='reading'?'原书依据与综合解读，都留在这张桌上':next==='home'?'循着微光，轻触水晶球':next==='reveal'?'正逆位已揭晓 · 轻触下方按钮，翻阅原书与综合解读':'';
  window.dispatchEvent(new CustomEvent('cabin-view',{detail:next}));
}
function show(view) {
  for (const name of ['question','draw','reading']) $(`#${name}-view`).hidden = name !== view;
  const index = ['question','draw','reading'].indexOf(view);
  document.querySelectorAll('.steps li').forEach((n,i) => n.classList.toggle('active', i === index));
  document.body.classList.toggle('drawing', view !== 'question');
  setStage(view==='draw'?(session?.status==='drawing'?'spread':'reveal'):view);
  notice();
}
function scrollPanel() { /* The room stays in place; controls arrive at its foot. */ }
function history() {
  try {
    const value=JSON.parse(localStorage.getItem('starlit-history') || '[]');
    if(!Array.isArray(value))return [];
    return value.filter(h=>h && typeof h.token==='string' && /^[\w-]{43}$/.test(h.token) && typeof h.question==='string' && Number.isFinite(h.created) && [1,3].includes(h.count)).slice(0,30);
  } catch { return []; }
}
function remember() {
  try { localStorage.setItem('starlit-history', JSON.stringify([{token:session.token, question:session.question, created:session.created, count:session.positions.length}, ...history().filter(h=>h.token!==session.token)].slice(0,30))); }
  catch { notice('浏览器未允许保存记录；本次抽牌仍可继续。'); }
}
$('#question').addEventListener('input', () => $('#char-count').textContent = `${$('#question').value.length} / 300`);
document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{ $('#question').value=b.dataset.question; $('#question').dispatchEvent(new Event('input')); $('#question').focus(); });
$('#question-form').onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  const gen=cancelFlow(true);
  busy=true; notice(); $('#begin-button').disabled=true;
  try {
    const created=await api('/api/sessions',{question:$('#question').value,spread:$('input[name="spread"]:checked').value});
    if(gen!==flowGeneration)return;
    session=created;
    pollGeneration++; page=0; renderDraw(); remember(); setStage('ready');
  } catch(e) { if(gen===flowGeneration)notice(e.message); }
  finally { if(gen===flowGeneration){busy=false; $('#begin-button').disabled=false;} }
};
function renderDraw() {
  $('#draw-question').textContent=session.question;
  $('#draw-instruction').textContent=session.status==='drawing' ? `第 ${session.draws.length+1} 张 · ${session.positions[session.draws.length]}。不必急，选择你想靠近的一张。` : '牌已落定。让我们一起看看，它们与你的心事如何相遇。';
  const slots=$('#draw-slots'); slots.replaceChildren();
  session.positions.forEach((position,i)=>{
    const wrap=el('div','draw-slot'); const drawn=session.draws[i];
    if(drawn){ const img=el('img',drawn.reversed?'reversed':''); img.src=drawn.card.image; img.alt=drawn.card.name+(drawn.reversed?'逆位':'正位'); if(i<session.draws.length-1)img.style.animation='none';wrap.append(img,el('strong','',drawn.card.name),el('span','',drawn.reversed?'逆位':'正位')); }
    else wrap.append(el('div','slot-placeholder', ['Ⅰ','Ⅱ','Ⅲ'][i]));
    wrap.append(el('div','',position)); slots.append(wrap);
  });
  const complete=session.draws.length===session.positions.length;
  $('#card-fan').hidden=complete; $('.deck-heading').hidden=complete; $('.deck-navigation').hidden=complete;
  $('#interpret-area').hidden=!complete;
  $('#interpret-button').disabled=session.status==='interpreting';
  $('#interpret-status').textContent=session.status==='interpreting'?'正在翻阅原书，为你整理这次牌阵。可以先看看已抽中的牌。':'';
  renderDeck();
}
function renderDeck() {
  const fan=$('#card-fan');
  if(fan.children.length===78){fan.querySelectorAll('button').forEach(b=>{const selected=session.draws.some(d=>d.index===Number(b.dataset.index));b.classList.toggle('selected',selected);b.disabled=selected||busy;b.setAttribute('aria-label',`抽取第 ${Number(b.dataset.index)+1} 张牌${selected?'，已抽取':''}`);});return;}
  fan.replaceChildren();
  for(let i=0;i<78;i++) {
    const selected=session.draws.some(d=>d.index===i);
    const b=el('button',`card-back${selected?' selected':''}`); b.setAttribute('aria-label',`抽取第 ${i+1} 张牌${selected?'，已抽取':''}`); b.disabled=selected||busy; b.dataset.index=i;
    b.onclick=()=>draw(i); fan.append(b);
  }
}
async function openDeck(){
  if(busy)return;
  if(!session){show('question');$('#question').focus();return;}
  const gen=cancelFlow(),token=session.token;
  busy=true;
  try {
    const current=await api(`/api/sessions/${token}`);
    if(gen!==flowGeneration)return;
    session=current;
  }catch(error){if(gen===flowGeneration){busy=false;notice(error.message);}return;}
  busy=false;
  if(session.status==='complete'){await renderReading();return;}
  show('draw');renderDraw();
  if(session.status!=='drawing'){if(session.status==='interpreting')poll(gen).catch(e=>{if(gen===flowGeneration)notice(e.message);});return;}
  busy=true;renderDeck();clearTimeout(spreadTimer);$('#card-fan').dataset.arriving='true';
  spreadTimer=setTimeout(()=>{
    if(gen!==flowGeneration||stage!=='spread')return;
    const fan=$('#card-fan');fan.dataset.arriving='false';const origin={x:innerWidth*.5,y:innerHeight*.56};
    fan.querySelectorAll('.card-back').forEach((b,i)=>{if(reduced)return;const r=b.getBoundingClientRect();b.animate([{transform:`translate(${origin.x-r.x-r.width/2}px,${origin.y-r.y-r.height/2}px) rotate(${(i%5-2)*2}deg) scale(.5)`,opacity:0},{opacity:1,offset:.12},{transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1}],{duration:850,delay:i*7,easing:'cubic-bezier(.16,.75,.2,1)',fill:'backwards'});});
    spreadTimer=setTimeout(()=>{if(gen!==flowGeneration)return;busy=false;if(session)renderDeck();},reduced?0:1450);
  },reduced?0:450);
}
$('#open-deck').onclick=openDeck;
async function draw(index) {
  if(busy) return; busy=true; renderDeck(); notice();
  const gen=flowGeneration,token=session.token;
  try { const drawn=await api(`/api/sessions/${token}/draw`,{index});if(gen!==flowGeneration||session?.token!==token)return;session=drawn;renderDraw();remember();if(session.status==='drawn'){setStage('reveal');}else{$('#journey-subtitle').textContent=`已选 ${session.draws.length} / ${session.positions.length} 张 · 下一张：${session.positions[session.draws.length]}`;} }
  catch(e) { if(gen===flowGeneration)notice(e.message); }
  finally { if(gen===flowGeneration){busy=false; if(session)renderDeck();} }
}
$('#deck-prev').onclick=()=>{page=Math.max(0,page-1);renderDeck();};
$('#deck-next').onclick=()=>{page=Math.min(6,page+1);renderDeck();};
async function generateReading(retry=false){
  if(busy) return; busy=true; $('#interpret-button').disabled=true; notice();
  const gen=flowGeneration,token=session.token;
  try {
    const current=await api(`/api/sessions/${token}/interpret`,{retry});
    if(gen!==flowGeneration||session?.token!==token)return;
    session=current;show('draw');renderDraw();await poll(gen);
  }
  catch(e) { if(gen===flowGeneration){notice(e.message); $('#interpret-button').disabled=false;} }
  finally { if(gen===flowGeneration)busy=false; }
}
$('#interpret-button').onclick=()=>generateReading();
$('#retry-reading').onclick=()=>generateReading(true);
async function poll(expectedFlow=flowGeneration) {
  const gen=++pollGeneration, token=session.token;
  for(let i=0;i<240;i++) {
    if(gen!==pollGeneration||expectedFlow!==flowGeneration) return;
    const current=await api(`/api/sessions/${token}`);
    if(gen!==pollGeneration||expectedFlow!==flowGeneration||session?.token!==token) return;
    session=current;
    if(session.status==='complete') { await renderReading(); remember(); return; }
    if(session.status==='drawn') { renderDraw(); throw new Error('整理过程中遇到问题，请再次点击解读。'); }
    await new Promise(r=>setTimeout(r,1000));
  }
  $('#interpret-button').disabled=false;
  throw new Error('解读仍在进行。请稍后从手记重新打开这一局查看。');
}
async function renderReading() {
  const gen=flowGeneration,current=session;
  renderDraw();show('reading'); $('#reading-question').textContent=session.question; const target=$('#reading-cards'); target.replaceChildren();
  for(const reading of session.reading.cards) {
    const drawn=session.draws.find(d=>d.card.id===reading.card_id);
    const article=el('article','reading-card'), header=el('div','reading-card-header'), img=el('img',reading.reversed?'reversed':'');
    img.src=drawn.card.image;img.alt=reading.name; const title=el('div'); title.append(el('span','position',reading.position),el('h3','',reading.name),el('span','orientation',reading.reversed?'逆位 · 换个角度看看':'正位 · 顺着此刻的光'));
    header.append(img,title); article.append(header,el('p','',reading.excerpt));
    for(const source of reading.sources) {
      const detail=el('details');detail.append(el('summary','',`原书依据 · PDF 第 ${source.pages.join('、')} 页 · ${source.subsection}`),el('p','source-text',source.text));article.append(detail);
    }
    target.append(article);
  }
  $('#reading-summary').textContent=session.reading.summary.replace(/\*\*/g,'');
  $('.reading-summary h3').textContent=session.reading.mode==='model'?'结合你的问题 · 综合解读':'留给你的思考';
  $('#reading-note').textContent=session.reading.note+' 仅供娱乐与自我探索。';
  $('#retry-reading').hidden=!session.reading.can_retry;
  $('#audit-hash').textContent=session.commitment;
  try {
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(session.proof));
    if(gen!==flowGeneration||session?.token!==current.token)return;
    const hex=[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
    const proof=JSON.parse(session.proof);
    const valid=hex===session.commitment && proof.deck.length===78 && new Set(proof.deck.map(d=>d.id)).size===78 && session.draws.every(d=>proof.deck[d.index].id===d.card.id && proof.deck[d.index].reversed===d.reversed);
    $('#audit-result').textContent=valid?'校验通过：完整 78 张牌无重复，抽中的牌与开局锁定的牌序一致。正逆位由服务器独立随机决定。此校验验证牌序未改动，不证明随机源质量。':'校验未通过，请保留本次记录并检查服务。';
  } catch { if(gen===flowGeneration)$('#audit-result').textContent='当前浏览器无法完成校验，已保留服务器承诺值。'; }
}
document.querySelectorAll('.restart').forEach(b=>b.onclick=()=>{cancelFlow(true);show('question');$('#question').focus();});
$('#scene-back').onclick=()=>{cancelFlow();setStage('home');notice();};
function openLibrary(){ $('#library-modal').showModal();$('#library-query').focus(); }
$('#library-button').onclick=openLibrary;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
async function searchLibrary(query) {
  const gen=++libraryGeneration;
  const target=$('#library-result');target.textContent='正在翻阅藏书…';
  try { const result=await api('/api/knowledge?q='+encodeURIComponent(query));if(gen===libraryGeneration)target.textContent=result.answer; }
  catch(e){ if(gen===libraryGeneration)target.textContent=e.message; }
}
$('#library-form').onsubmit=e=>{e.preventDefault();searchLibrary($('#library-query').value);};
document.querySelectorAll('[data-search]').forEach(b=>b.onclick=()=>{$('#library-query').value=b.dataset.search;searchLibrary(b.dataset.search);});
function openHistory() {
  const target=$('#history-list');target.replaceChildren();
  const entries=history();if(!entries.length)target.append(el('p','muted','手记还是空白。你的第一次相遇，会被轻轻记在这里。'));
  entries.forEach(h=>{const b=el('button','history-entry');b.append(el('small','',new Date(h.created*1000).toLocaleString('zh-CN')+` · ${h.count} 张牌`),el('strong','',h.question));b.onclick=async()=>{const gen=cancelFlow();busy=true;try{const current=await api(`/api/sessions/${h.token}`);if(gen!==flowGeneration)return;session=current;$('#history-modal').close();page=0;busy=false;if(session.status==='complete')await renderReading();else{show('draw');renderDraw();if(session.status==='interpreting')poll(gen).catch(e=>{if(gen===flowGeneration)notice(e.message);});}scrollPanel();}catch(e){if(gen===flowGeneration){notice(e.message);$('#history-modal').close();}}finally{if(gen===flowGeneration)busy=false;}};target.append(b);});
  if(!$('#history-modal').open)$('#history-modal').showModal();
}
$('#history-button').onclick=openHistory;
$('#clear-history').onclick=()=>{try{localStorage.removeItem('starlit-history');openHistory();}catch{}};
async function toggleSound() {
  if($('#sound-button').disabled)return;$('#sound-button').disabled=true;
  try {
    if(!audio){audio=new Audio('/assets/moonlit-piano.wav');audio.loop=true;audio.volume=.38;}
    if(soundOn){audio.pause();soundOn=false;}else{await audio.play();soundOn=true;}
    $('#sound-button').setAttribute('aria-pressed',soundOn);$('#sound-button span').textContent=soundOn?'月光钢琴':'静音';$('#sound-button').title=soundOn?'关闭月光钢琴':'播放柔和的月光钢琴';
  }catch{notice('当前浏览器无法播放环境音，抽牌功能仍可使用。');}
  finally{$('#sound-button').disabled=false;}
}
$('#sound-button').onclick=toggleSound;
function interact(name){if(name==='books')openLibrary();else if(name==='journal')openHistory();else if(name==='candle')toggleSound();else if(name==='crystal'){const gen=cancelFlow(true);show('question');setTimeout(()=>{if(gen===flowGeneration&&stage==='question')$('#question').focus({preventScroll:true});},reduced?0:500);}else openDeck();}
document.querySelectorAll('[data-object]').forEach(b=>b.onclick=()=>interact(b.dataset.object));
window.addEventListener('cabin-object',e=>interact(e.detail));
api('/api/health').then(r=>$('#connection').textContent=r.status==='ok'?'● 知识库已连接':'连接待检查').catch(()=>{$('#connection').textContent='知识库未连接';notice('请确认本机小屋服务已经启动。');});
import('./scene.js').catch(()=>{$('#scene').hidden=true;$('#scene-fallback').hidden=false;});
function welcome(name){visitor=name.trim().slice(0,20)||'旅人';try{localStorage.setItem('starlit-name',visitor);}catch{}$('#welcome-modal').close();setStage('home');}
$('#welcome-form').onsubmit=e=>{e.preventDefault();welcome($('#visitor-name').value);};
$('#welcome-skip').onclick=()=>welcome('旅人');
$('#welcome-modal').addEventListener('cancel',e=>{e.preventDefault();welcome('旅人');});
try{visitor=localStorage.getItem('starlit-name')||'';}catch{visitor='';}
if(!visitor){visitor='旅人';$('#welcome-modal').showModal();}setStage('home');
