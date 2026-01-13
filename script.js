async function load(){
  const res = await fetch('./data.json');
  const data = await res.json();
  document.getElementById('title').textContent = data.title || '行程';
  document.getElementById('subtitle').textContent = data.subtitle || '';
  document.getElementById('generated').textContent = `產出日期：${data.generated_on || ''}`;

  // Mini chips (areas)
  const chips = document.getElementById('miniChips');
  const areas = collectAreas(data.days || []);
  chips.innerHTML = areas.slice(0,6).map(a=>`<span class="chip">${escapeHtml(a)}</span>`).join('');

  renderDays(data.days || [], data.enrichment || {});
  renderOverview(data.days || []);
  renderTransportCards(data.transport_cards || []);
  bindSearch(); bindExpandCollapse(); bindTabs();
}

function collectAreas(days){
  const set = new Set();
  days.forEach(d=>{
    (d.items||[]).forEach(it=>{
      const a=(it.area||'').trim();
      if (a) set.add(a);
    });
  });
  return Array.from(set);
}

function renderOverview(days){
  // tight days list
  const tight = document.getElementById('tightDays');
  const tightDays = days.filter(d => (d.warnings||[]).some(w => (w.title||'').includes('跨區')));
  tight.innerHTML='';
  if (!tightDays.length){
    tight.innerHTML = '<li class="muted">未偵測到高跨區日（或表內未明確標示）。</li>';
  }else{
    tightDays.forEach(d=>{
      const li=document.createElement('li');
      li.textContent = `${d.day_label}：建議保留可刪點，必要時二選一。`;
      tight.appendChild(li);
    });
  }

  // summary viz
  const stats = computeStats(days);
  const box = document.getElementById('summaryViz');
  box.innerHTML = '';
  box.appendChild(vizCard('類別比例（整趟）', stats.total, stats.counts));
  // per-day top 2
  const top = [...days].map(d=>({day:d.day_label, counts:bucketCounts(d.items||[])}));
  const busiest = top.sort((a,b)=>sumCounts(b.counts)-sumCounts(a.counts)).slice(0,2);
  busiest.forEach(x=>{
    box.appendChild(vizCard(`項目密度：${x.day}`, sumCounts(x.counts), x.counts));
  });
}

function vizCard(title, total, counts){
  const card=document.createElement('div');
  card.className='vizCard';
  card.innerHTML = `<strong>${escapeHtml(title)}</strong>
    <div class="muted" style="margin-top:4px">總項目：${total}</div>
    <div class="bars">
      ${barRow('重點', counts.focus||0, total, 'fillFocus')}
      ${barRow('景點', counts.spot||0, total, 'fillSpot')}
      ${barRow('交通', counts.move||0, total, 'fillMove')}
      ${barRow('餐食', counts.food||0, total, 'fillFood')}
      ${barRow('備案', counts.backup||0, total, 'fillBackup')}
    </div>`;
  return card;
}

function barRow(label, n, total, cls){
  const pct = total ? Math.round((n/total)*100) : 0;
  return `<div class="barRow">
    <div class="barLabel">${escapeHtml(label)} <span class="muted">(${n})</span></div>
    <div class="bar"><div class="fill ${cls}" style="width:${pct}%"></div></div>
    <div class="muted" style="width:42px;text-align:right">${pct}%</div>
  </div>`;
}

function computeStats(days){
  const counts={focus:0,spot:0,move:0,food:0,backup:0,other:0};
  let total=0;
  days.forEach(d=>{
    const c=bucketCounts(d.items||[]);
    Object.keys(counts).forEach(k=>counts[k]+= (c[k]||0));
    total += sumCounts(c);
  });
  return {counts, total};
}

function bucketCounts(items){
  const c={focus:0,spot:0,move:0,food:0,backup:0,other:0};
  items.forEach(it=>{
    const b=it.bucket||'';
    if (b==='今日重點') c.focus++;
    else if (b==='景點' || b==='逛街/補給') c.spot++;
    else if (b==='行程說明/交通') c.move++;
    else if (b==='餐食') c.food++;
    else if (b==='備案/警示') c.backup++;
    else c.other++;
  });
  return c;
}
function sumCounts(c){ return Object.values(c||{}).reduce((a,b)=>a+b,0); }

function markerClass(bucket){
  if (bucket==='今日重點') return 'mFocus';
  if (bucket==='景點' || bucket==='逛街/補給') return 'mSpot';
  if (bucket==='行程說明/交通') return 'mMove';
  if (bucket==='餐食') return 'mFood';
  if (bucket==='備案/警示') return 'mBackup';
  return 'mOther';
}

function renderDays(days, enrich){
  const box=document.getElementById('days');
  box.innerHTML='';
  const makeMapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  const buckets = [
    {key:'今日重點', label:'今日重點（不建議刪）'},
    {key:'景點', label:'順遊景點（視體力）'},
    {key:'行程說明/交通', label:'交通/控時'},
    {key:'餐食', label:'餐食'},
    {key:'逛街/補給', label:'逛街/補給'},
    {key:'備案/警示', label:'備案/警示'},
    {key:'其他', label:'其他'}
  ];

  days.forEach((d, idx)=>{
    const dayEl=document.createElement('div');
    dayEl.className='day';

    // promote highlights
    const highlights=(d.highlights||[]).filter(Boolean);
    (d.items||[]).forEach(it=>{ if (highlights.includes(it.title)) it.bucket='今日重點'; });

    const head=document.createElement('div');
    head.className='dayHead';
    head.innerHTML = `
      <div>
        <h3>${escapeHtml(d.day_label)}</h3>
        ${highlights.length ? `<div class="muted" style="margin-top:4px">今日重點：<span style="color:#d1fae5">${escapeHtml(highlights.join('、'))}</span></div>` : ''}
      </div>
      <div class="badges">
        <span class="badge">${(d.items||[]).length} 項</span>
        ${highlights.length ? `<span class="badge badgeStrong">⭐ 重點 ${highlights.length}</span>` : ''}
        ${ (d.warnings||[]).length ? `<span class="badge">⚠️ ${d.warnings.length}</span>` : '' }
      </div>
    `;
    head.addEventListener('click', ()=> dayEl.classList.toggle('open'));

    const body=document.createElement('div');
    body.className='dayBody';

    // warnings
    const warnings=d.warnings||[];
    if (warnings.length){
      const wr=document.createElement('div');
      wr.className='warningRow';
      warnings.forEach(w=>{
        const x=document.createElement('div');
        x.className='warn';
        x.innerHTML = `<div class="t">${escapeHtml(w.level||'')} ${escapeHtml(w.title||'')}</div><div class="d">${escapeHtml(w.detail||'')}</div>`;
        wr.appendChild(x);
      });
      body.appendChild(wr);
    }

    // at-a-glance pills
    const bc=bucketCounts(d.items||[]);
    const glance=document.createElement('div');
    glance.className='dayAtAGlance';
    glance.innerHTML = `
      <span class="pill2"><strong>⭐</strong>重點 ${bc.focus||0}</span>
      <span class="pill2"><strong>📍</strong>景點 ${bc.spot||0}</span>
      <span class="pill2"><strong>🚌</strong>交通 ${bc.move||0}</span>
      <span class="pill2"><strong>🍜</strong>餐食 ${bc.food||0}</span>
      <span class="pill2"><strong>🧩</strong>備案 ${bc.backup||0}</span>
    `;
    body.appendChild(glance);

    // timeline (by time_of_day groups)
    const t=document.createElement('div');
    t.className='timeline';
    const groups = groupByTimeOfDay(d.items||[]);
    t.innerHTML = `<div class="tHead"><strong>時間軸（親子化整理）</strong><span class="muted">先跑重點，再加順遊</span></div>`;
    const tBody=document.createElement('div');
    tBody.className='tBody';
    ['上午','中午','下午','晚上','行程'].forEach(slot=>{
      const list = groups[slot] || [];
      list.forEach(it=>{
        const row=document.createElement('div');
        row.className='tRow';
        row.innerHTML = `
          <div class="tTime">${escapeHtml(slot)}</div>
          <div class="tCard">
            <div class="tTitle">
              <span class="marker ${markerClass(it.bucket)}"></span>
              <div style="flex:1">
                <div class="name">${escapeHtml(it.icon||'')} ${escapeHtml(it.title||'備註')}</div>
                ${it.title ? `<div class="muted" style="margin-top:2px"><a href="${makeMapLink(it.title)}" target="_blank" rel="noopener">地圖</a>${it.area? ` · ${escapeHtml(it.area)}`:''}</div>` : ''}
              </div>
            </div>
            ${it.note ? `<div class="note">${escapeHtml(it.note)}</div>` : ''}
            ${(it.tags||[]).length ? `<div class="tags">${it.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            ${it.title && enrich[it.title] ? enrichBlock(enrich[it.title]) : ''}
          </div>
        `;
        tBody.appendChild(row);
      });
    });
    t.appendChild(tBody);
    body.appendChild(t);

    // classified sections (optional, still available but not dominant)
    const sections=document.createElement('div');
    sections.className='sections';
    buckets.forEach(b=>{
      const list=(d.items||[]).filter(it => (it.bucket||'')===b.key);
      if (!list.length) return;
      const sec=document.createElement('div');
      sec.className='section';
      sec.innerHTML = `
        <div class="sectionHead">
          <div class="sectionTitle">
            <span class="marker ${markerClass(b.key)}"></span>
            <strong>${escapeHtml(b.label)}</strong>
          </div>
          <span class="badge">${list.length} 項</span>
        </div>
        <div class="sectionBody">
          ${list.map(it=>`
            <div class="item">
              <div class="itemTitle">
                <span class="name">${escapeHtml(it.icon||'')} ${escapeHtml(it.title||'備註')}</span>
                ${it.title ? ` · <a href="${makeMapLink(it.title)}" target="_blank" rel="noopener">地圖</a>` : ''}
              </div>
              ${it.note ? `<div class="note">${escapeHtml(it.note)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
      sections.appendChild(sec);
    });
    body.appendChild(sections);

    dayEl.appendChild(head);
    dayEl.appendChild(body);
    box.appendChild(dayEl);
    if (idx===0) dayEl.classList.add('open');
  });
}

function groupByTimeOfDay(items){
  const g={上午:[],中午:[],下午:[],晚上:[],行程:[]};
  items.forEach(it=>{
    const t=(it.time_of_day||'行程');
    if (t==='中午') g['中午'].push(it);
    else if (t==='晚上') g['晚上'].push(it);
    else if (t==='上午') g['上午'].push(it);
    else if (t==='下午') g['下午'].push(it);
    else g['行程'].push(it);
  });
  // heuristic: if no afternoon, keep empty
  return g;
}

function enrichBlock(e){
  const parts=[];
  if (e.category) parts.push(`<div class="muted">類型：${escapeHtml(e.category)}</div>`);
  if (e.area) parts.push(`<div class="muted">區域：${escapeHtml(e.area)}</div>`);
  if (e.time_suggest) parts.push(`<div class="muted">建議停留：${escapeHtml(e.time_suggest)}</div>`);
  if (e.kid_tip) parts.push(`<div class="muted">親子提示：${escapeHtml(e.kid_tip)}</div>`);
  return `<div class="enrich"><strong>補充資訊</strong>${parts.join('')}</div>`;
}

function renderTransportCards(items){
  const tc=document.getElementById('transportCards');
  tc.innerHTML='';
  const ul=document.createElement('ul');
  ul.className='bullets';
  items.forEach(x=>{
    const li=document.createElement('li');
    const k=(x.k||'').trim();
    const v=(x.v||'').trim();
    if (v.startsWith('http')){
      li.innerHTML = `<span class="muted">${k ? escapeHtml(k)+'：' : ''}</span><a href="${v}" target="_blank" rel="noopener">連結</a>`;
    }else{
      li.innerHTML = `${k ? `<strong>${escapeHtml(k)}</strong>：` : ''}<span class="muted">${escapeHtml(v)}</span>`;
    }
    ul.appendChild(li);
  });
  tc.appendChild(ul);
}

function bindSearch(){
  const search=document.getElementById('search');
  search.addEventListener('input', ()=>{
    const q=(search.value||'').trim().toLowerCase();
    document.querySelectorAll('.day').forEach(dayEl=>{
      if (!q){ dayEl.style.display=''; return; }
      const text=dayEl.innerText.toLowerCase();
      dayEl.style.display = text.includes(q) ? '' : 'none';
    });
  });
}
function bindExpandCollapse(){
  document.getElementById('expandAll').addEventListener('click', ()=>{
    document.querySelectorAll('.day').forEach(d=>d.classList.add('open'));
  });
  document.getElementById('collapseAll').addEventListener('click', ()=>{
    document.querySelectorAll('.day').forEach(d=>d.classList.remove('open'));
  });
}
function bindTabs(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });
}
function escapeHtml(str){
  return String(str||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

load().catch(err=>{
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin','<p style="color:#fff;padding:16px">資料載入失敗，請確認 data.json 與檔案路徑。</p>');
});
