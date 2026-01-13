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
  renderCharts(data.days || []);
  renderTransportCards(data.transport_cards || []);
  renderKids(data.days || []);
  bindSearch(); bindExpandCollapse(); bindTabs();
}

function collectAreas(days){
  const set = new Set();
  days.forEach(d=>{
    (d.items||[]).forEach(it=>{
      const a=(it.area||'').trim();
      if (a) set.add(shortArea(a));
    });
  });
  return Array.from(set);
}
function shortArea(a){
  // normalize to short label
  if (a.includes('京都')) return '京都';
  if (a.includes('大阪')) return '大阪';
  if (a.includes('奈良')) return '奈良';
  if (a.includes('宇治')) return '宇治';
  if (a.includes('KIX') || a.includes('關西')) return 'KIX';
  if (a.length>10) return a.slice(0,10)+'…';
  return a;
}

function renderOverview(days){
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

  const stats = computeStats(days);
  const box = document.getElementById('summaryViz');
  box.innerHTML = '';
  box.appendChild(vizCard('類別比例（整趟）', stats.total, stats.counts));
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

function dayCoverEmoji(day, enrich){
  for (const t of (day.highlights||[])){
    if (enrich[t] && enrich[t].cover) return enrich[t].cover;
  }
  // fallback by area
  const a = dominantArea(day.items||[]);
  if (a.includes('京都')) return '🏯';
  if (a.includes('奈良')) return '🦌';
  if (a.includes('大阪')) return '🌆';
  if (a.includes('KIX')) return '✈️';
  return '🗺️';
}
function dominantArea(items){
  const c=new Map();
  items.forEach(it=>{
    const a=shortArea(it.area||'');
    if (!a) return;
    c.set(a, (c.get(a)||0)+1);
  });
  let best='', bestN=0;
  for (const [k,v] of c.entries()){
    if (v>bestN){ bestN=v; best=k; }
  }
  return best;
}

function extractRoute(day){
  const stops=[];
  const push=(x)=>{
    const s=shortArea(x||'').trim();
    if (!s) return;
    if (!stops.length || stops[stops.length-1]!==s) stops.push(s);
  };
  (day.items||[]).forEach(it=>{
    // prefer explicit area; otherwise infer from title/note
    if (it.area) push(it.area);
    else{
      const t=(it.title||'')+' '+(it.note||'');
      ['KIX','京都','宇治','奈良','大阪','梅田','難波','天保山'].forEach(k=>{
        if (t.includes(k)) push(k);
      });
    }
  });
  // keep compact
  const uniq=[];
  stops.forEach(s=>{ if (!uniq.includes(s)) uniq.push(s); });
  return uniq.slice(0,6);
}

function routeSvg(stops){
  // simple inline svg route
  const w=520, h=74, pad=24;
  const n=Math.max(stops.length, 2);
  const dx=(w-2*pad)/(n-1);
  const y=36;
  let nodes='';
  for (let i=0;i<n;i++){
    const x=pad+i*dx;
    const label=stops[i] || (i===0?'Start':'');
    nodes += `
      <circle cx="${x}" cy="${y}" r="9" fill="rgba(255,255,255,.06)" stroke="rgba(31,42,68,.95)" />
      <circle cx="${x}" cy="${y}" r="4" fill="rgba(96,165,250,.95)" />
      <text x="${x}" y="${y+28}" text-anchor="middle" font-size="12" fill="rgba(229,231,235,.95)">${escapeXml(label)}</text>
    `;
    if (i<n-1){
      const x2=pad+(i+1)*dx;
      nodes += `<line x1="${x+9}" y1="${y}" x2="${x2-9}" y2="${y}" stroke="rgba(31,42,68,.95)" stroke-width="2" />`;
    }
  }
  return `
  <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="當日路線示意">
    <rect x="0" y="0" width="${w}" height="${h}" rx="14" fill="rgba(255,255,255,.02)" stroke="rgba(31,42,68,.9)"/>
    ${nodes}
  </svg>`;
}

function coverSvg(emoji, title, subtitle){
  const w=520, h=120;
  const t=escapeXml(title||'');
  const s=escapeXml(subtitle||'');
  const e=escapeXml(emoji||'🗺️');
  return `
  <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="每日封面插圖">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="rgba(96,165,250,.35)"/>
        <stop offset="1" stop-color="rgba(167,139,250,.25)"/>
      </linearGradient>
      <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="12"/>
      </filter>
    </defs>
    <rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="rgba(255,255,255,.02)" stroke="rgba(31,42,68,.9)"/>
    <circle cx="420" cy="20" r="46" fill="url(#g)" filter="url(#blur)"/>
    <circle cx="480" cy="98" r="36" fill="rgba(34,197,94,.18)" filter="url(#blur)"/>
    <text x="18" y="44" font-size="34">${e}</text>
    <text x="62" y="42" font-size="16" fill="rgba(229,231,235,.95)" font-weight="800">${t}</text>
    <text x="62" y="68" font-size="12" fill="rgba(148,163,184,.95)">${s}</text>
    <path d="M18 96 C 78 78, 160 122, 238 96 S 390 78, 500 98" fill="none" stroke="rgba(96,165,250,.45)" stroke-width="2"/>
    <path d="M18 104 C 96 86, 172 126, 260 104 S 408 86, 500 108" fill="none" stroke="rgba(167,139,250,.35)" stroke-width="2"/>
  </svg>`;
}

function renderDays(days, enrich){
  const box=document.getElementById('days');
  box.innerHTML='';
  const makeMapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  days.forEach((d, idx)=>{
    const dayEl=document.createElement('div');
    dayEl.className='day';

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

    // cover + route visual
    const domArea = dominantArea(d.items||[]);
    const emoji = dayCoverEmoji(d, enrich);
    const coverTitle = domArea ? `${domArea} 日` : '當日行程';
    const coverSub = highlights.length ? `重點：${highlights.join('、')}` : '依體力彈性調整';
    const cover=document.createElement('div');
    cover.className='cover';
    const route = extractRoute(d);
    cover.innerHTML = `
      <div class="coverLeft">
        <div class="coverTitle"><span class="coverEmoji">${escapeHtml(emoji)}</span><strong>${escapeHtml(coverTitle)}</strong></div>
        <div class="coverSub">${escapeHtml(coverSub)}</div>
        <div class="routeViz">${routeSvg(route)}</div>
        <div class="muted" style="margin-top:8px">路線示意：${escapeHtml(route.join(' → ') || '—')}</div>
      </div>
      <div class="coverRight">
        ${coverSvg(emoji, d.day_label, coverSub)}
      </div>
    `;
    body.appendChild(cover);

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

    // at-a-glance
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

    // timeline
    const t=document.createElement('div');
    t.className='timeline';
    t.innerHTML = `<div class="tHead"><strong>時間軸（親子化整理）</strong><span class="muted">先跑重點，再加順遊</span></div>`;
    const tBody=document.createElement('div');
    tBody.className='tBody';
    const groups = groupByTimeOfDay(d.items||[]);
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
                ${it.title ? `<div class="muted" style="margin-top:2px"><a href="${makeMapLink(it.title)}" target="_blank" rel="noopener">地圖</a>${it.area? ` · ${escapeHtml(shortArea(it.area))}`:''}</div>` : ''}
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
  return g;
}
function enrichBlock(e){
  const parts=[];
  if (e.category) parts.push(`<div class="muted">類型：${escapeHtml(e.category)}</div>`);
  if (e.area) parts.push(`<div class="muted">區域：${escapeHtml(shortArea(e.area))}</div>`);
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


function renderCharts(days){
  // KPIs
  const totals = computeTripKPIs(days);
  const kpiGrid = document.getElementById('kpiGrid');
  if (kpiGrid){
    kpiGrid.innerHTML = '';
    const kpis = [
      {k:'餐食項目', v: totals.foodCount, s:'包含早餐/午餐/晚餐/甜點等（依表內文字判斷）'},
      {k:'高步行點', v: totals.walkCount, s:'含 🚶/階梯/坂道/神社寺院等（依標籤與文字）'},
      {k:'可能排隊', v: totals.queueCount, s:'含 海遊館/大阪城/樂高/熱門點（依警示/文字）'}
    ];
    kpis.forEach(x=>{
      const d=document.createElement('div');
      d.className='kpi';
      d.innerHTML = `<div class="k">${escapeHtml(x.k)}</div><div class="v">${escapeHtml(String(x.v))}</div><div class="s">${escapeHtml(x.s)}</div>`;
      kpiGrid.appendChild(d);
    });
  }

  // Food chart: top keywords + per-day counts
  const food = summarizeFood(days);
  const foodBox = document.getElementById('foodChart');
  if (foodBox){
    foodBox.innerHTML = `<h4>餐食彙整（依你表格文字）</h4>` +
      chartBlock(food.byType, food.total, {
        hint: '用於快速看「哪一天餐食安排較密集」與「餐食類型分布」。',
        palette: 'food'
      }) +
      listBlock('推薦你檢查的餐食點', food.samples);
  }

  // Walk chart
  const walk = summarizeWalking(days);
  const walkBox = document.getElementById('walkChart');
  if (walkBox){
    walkBox.innerHTML = `<h4>步行/體力彙整（估算）</h4>` +
      chartBlock(walk.byDay, walk.maxDay, {hint:'以「步行/階梯關鍵字與標籤」估算；數字越高代表越需要留緩衝。', palette:'walk'}) +
      listBlock('高步行提醒', walk.tips);
  }
}

function chartBlock(mapObj, maxValue, opts){
  const keys = Object.keys(mapObj || {});
  if (!keys.length) return `<div class="muted">（沒有足夠資料可產生圖表）</div>`;
  const rows = keys.map(k=>{
    const v = mapObj[k] || 0;
    const pct = maxValue ? Math.round((v / maxValue) * 100) : 0;
    const cls = (opts && opts.palette==='food') ? 'fillFood' : 'fillMove';
    return `<div class="chartRow">
      <div class="chartLabel">${escapeHtml(k)}</div>
      <div class="chartBar"><div class="chartFill ${cls}" style="width:${pct}%"></div></div>
      <div class="chartVal">${escapeHtml(String(v))}</div>
    </div>`;
  }).join('');
  const hint = (opts && opts.hint) ? `<div class="muted" style="margin:4px 0 8px 0">${escapeHtml(opts.hint)}</div>` : '';
  return hint + rows;
}

function listBlock(title, items){
  if (!items || !items.length) return '';
  return `<div style="margin-top:12px">
    <div class="muted" style="font-weight:800;margin-bottom:6px">${escapeHtml(title)}</div>
    <ul class="bullets">${items.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
  </div>`;
}

function computeTripKPIs(days){
  let foodCount=0, walkCount=0, queueCount=0;
  days.forEach(d=>{
    (d.items||[]).forEach(it=>{
      if (isFood(it)) foodCount++;
      if (isWalkHeavy(it)) walkCount++;
      if (isQueueLikely(it, d)) queueCount++;
    });
  });
  return {foodCount, walkCount, queueCount};
}

function isFood(it){
  const t=((it.title||'')+' '+(it.note||'')).toLowerCase();
  const kw=['早餐','午餐','晚餐','拉麵','壽司','咖啡','茶','甜點','燒肉','居酒屋','麵','吃到飽','迴轉'];
  return (it.bucket==='餐食') || kw.some(k=>t.includes(k));
}

function isWalkHeavy(it){
  const t=(it.title||'')+' '+(it.note||'');
  const tagStr=(it.tags||[]).join(' ');
  const kw=['步行','階','階梯','坂','鳥居','寺','神社','清水','稻荷','東山'];
  return tagStr.includes('🚶') || tagStr.includes('階梯') || kw.some(k=>t.includes(k));
}

function isQueueLikely(it, day){
  const t=(it.title||'')+' '+(it.note||'');
  const kw=['海遊館','大阪城','樂高','排隊','熱門'];
  const dayWarn = (day.warnings||[]).some(w => String(w.title||'').includes('排隊'));
  return dayWarn || kw.some(k=>t.includes(k));
}

function summarizeFood(days){
  const byType={'早餐/早午餐':0,'午餐':0,'晚餐':0,'甜點/咖啡':0,'其他餐食':0};
  const samples=[];
  days.forEach(d=>{
    (d.items||[]).forEach(it=>{
      if (!isFood(it)) return;
      const t=(it.title||'')+' '+(it.note||'');
      const lower=t.toLowerCase();
      if (t.includes('早餐')) byType['早餐/早午餐']++;
      else if (t.includes('午餐')) byType['午餐']++;
      else if (t.includes('晚餐')) byType['晚餐']++;
      else if (t.includes('咖啡') || t.includes('茶') || t.includes('甜點')) byType['甜點/咖啡']++;
      else byType['其他餐食']++;
      if (it.title && samples.length<10) samples.push(`${d.day_label}：${it.title}`);
    });
  });
  const total = Math.max(...Object.values(byType));
  return {byType, total, samples};
}

function summarizeWalking(days){
  const byDay={};
  const tips=[];
  let maxDay=0;
  days.forEach(d=>{
    let n=0;
    (d.items||[]).forEach(it=>{ if (isWalkHeavy(it)) n++; });
    byDay[d.day_label]=n;
    maxDay=Math.max(maxDay,n);
    if ((d.warnings||[]).some(w=>String(w.title||'').includes('步行')) && tips.length<8){
      tips.push(`${d.day_label}：步行/階梯偏多，建議背巾或留休息點。`);
    }
  });
  if (!tips.length){
    tips.push('若推車同行：東山/稻荷等路段建議改背巾或只走前段。');
  }
  return {byDay, maxDay, tips};
}


function escapeHtml(str){
  return String(str||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
function escapeXml(str){
  return String(str||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

load().catch(err=>{
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin','<p style="color:#fff;padding:16px">資料載入失敗，請確認 data.json 與檔案路徑。</p>');
});


function renderKids(days){
  const box=document.getElementById('kidTasks');
  if (!box) return;
  const tasks=[];
  days.forEach(d=>{
    const dayTasks=[];
    (d.items||[]).forEach(it=>{
      if ((it.kid_tags||[]).length){
        if (it.kid_tags.includes("🧠 知識型")) dayTasks.push(`找出一個你覺得最厲害的知識：${it.title}`);
        if (it.kid_tags.includes("🎮 體驗型")) dayTasks.push(`完成體驗並說出最好玩的一件事：${it.title}`);
        if (it.kid_tags.includes("🛍️ 自主型")) dayTasks.push(`自己決定一樣想買或想吃的東西：${it.title}`);
      }
    });
    if (dayTasks.length){
      tasks.push({day:d.day_label, tasks: dayTasks.slice(0,3)});
    }
  });
  box.innerHTML = tasks.map(t=>`
    <div class="card" style="margin-top:12px">
      <h3>${escapeHtml(t.day)}</h3>
      ${t.tasks.map(x=>`<label class="check"><input type="checkbox"> ${escapeHtml(x)}</label>`).join('')}
    </div>
  `).join('');
}
