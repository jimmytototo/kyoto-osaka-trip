async function load(){
  const res = await fetch('./data.json');
  const data = await res.json();
  document.getElementById('title').textContent = data.title || '行程';
  document.getElementById('subtitle').textContent = data.subtitle || '';
  document.getElementById('generated').textContent = `產出日期：${data.generated_on || ''}`;

  // Hero stats
  const stats = computeStats(data.days || []);
  const heroStats = document.getElementById('heroStats');
  heroStats.innerHTML = '';
  [
    {k:'天數', v: `${stats.days} 天`},
    {k:'今日重點', v: `${stats.focus} 個`},
    {k:'景點/順遊', v: `${stats.spots} 個`},
    {k:'備案/警示', v: `${stats.backups} 個`}
  ].forEach(s=>{
    const d=document.createElement('div');
    d.className='stat';
    d.innerHTML = `<div class="k">${s.k}</div><div class="v">${s.v}</div>`;
    heroStats.appendChild(d);
  });

  // Overview bullets
  const pace = [
    '抵達日＋京都站周邊晚餐：留有緩衝，親子友善。',
    '清水寺/祇園日：動線順但步行多，建議早出發避人潮。',
    '伏見稻荷＋宇治＋奈良同日：對 2 大 2 小偏緊湊，務必保留可刪點。',
    '大阪段落以室內景點作為雨備：策略正確。'
  ];
  const risks = [
    '東山、伏見稻荷多階梯與坡道：推車行動成本高。',
    '京都市巴士尖峰易塞車：請保留轉乘與排隊時間。',
    '奈良餵鹿：小孩需成人陪同、餅乾收好避免被追。',
    '熱門景點（大阪城、海遊館）可能排隊：建議線上票或一早/傍晚入場。'
  ];
  const tweaks = [
    '把每天分成：今日重點（不刪）＋順遊（可刪）＋交通控時＋餐食。',
    '跨區日（京都/宇治/奈良）若超時：先保留今日重點，其餘點直接跳過。',
    '排隊>30分鐘：啟用備案（室內點或商圈）。',
    '每 90 分鐘安排休息/點心，下午保留室內或商圈降低情緒成本。'
  ];
  fillList('pace', pace);
  fillList('risks', risks);
  fillList('tweaks', tweaks);

  const opsTips = [
    {title:'交通與步行', body:'Google Maps 到站後步行時間加 10–15 分鐘緩衝；京都公車塞車時，地鐵＋短程計程車常更快。'},
    {title:'票券策略', body:'大阪付費景點多時再買周遊卡；只跑 1–2 個付費點，單買門票＋刷卡/地鐵票更彈性。'},
    {title:'親子節奏', body:'上午跑重點、下午留室內或商圈；每 90 分鐘補水/點心一次。'},
    {title:'用餐', body:'熱門店以「開店即到」或「離峰」為原則；若排隊過長，直接啟用備案。'}
  ];
  renderTips('opsTips', opsTips);

  // Transport cards
  renderTransportCards(data.transport_cards || []);

  // Days
  renderDays(data.days || [], data.enrichment || {});

  // Search / controls
  bindSearch();
  bindExpandCollapse();
  bindTabs();
}

function computeStats(days){
  let focus=0, spots=0, back=0;
  days.forEach(d=>{
    (d.items||[]).forEach(it=>{
      const b=it.bucket||'';
      if (b==='今日重點') focus++;
      else if (b==='景點' || b==='逛街/補給' || b==='其他') spots++;
      else if (b==='備案/警示') back++;
    });
  });
  return {days: days.length, focus, spots, backups: back};
}

function fillList(id, arr){
  const ul=document.getElementById(id);
  ul.innerHTML='';
  arr.forEach(t=>{
    const li=document.createElement('li');
    li.textContent=t;
    ul.appendChild(li);
  });
}

function renderTips(id, tips){
  const box=document.getElementById(id);
  box.innerHTML='';
  tips.forEach(t=>{
    const d=document.createElement('div');
    d.className='tip';
    d.innerHTML = `<strong>${escapeHtml(t.title)}</strong><div class="muted" style="margin-top:6px">${escapeHtml(t.body)}</div>`;
    box.appendChild(d);
  });
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

function renderDays(days, enrich){
  const daysBox=document.getElementById('days');
  daysBox.innerHTML='';
  const makeMapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  days.forEach((d, idx)=>{
    const dayEl=document.createElement('div');
    dayEl.className='day';

    const highlights=(d.highlights||[]).filter(Boolean);
    const headBadges=[];
    if ((d.items||[]).length) headBadges.push(`${(d.items||[]).length} 項`);
    if (highlights.length) headBadges.push(`重點：${highlights.join('、')}`);

    const head=document.createElement('div');
    head.className='dayHead';
    head.innerHTML = `
      <div>
        <h3>${escapeHtml(d.day_label)}</h3>
        ${highlights.length ? `<div class="muted" style="margin-top:4px">今日重點：<span style="color:#d1fae5">${escapeHtml(highlights.join('、'))}</span></div>` : ''}
      </div>
      <div class="badges">
        ${headBadges.map(b=>`<span class="badge ${b.startsWith('重點')?'badgeStrong':''}">${escapeHtml(b)}</span>`).join('')}
      </div>
    `;
    head.addEventListener('click', ()=> dayEl.classList.toggle('open'));

    const body=document.createElement('div');
    body.className='dayBody';

    // Warnings
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

    // Buckets
    const buckets = [
      {key:'今日重點', label:'今日重點（不建議刪）', marker:'mFocus'},
      {key:'景點', label:'順遊景點（視體力增減）', marker:'mSpot'},
      {key:'行程說明/交通', label:'交通/行程說明（控時關鍵）', marker:'mMove'},
      {key:'餐食', label:'餐食（親子優先）', marker:'mFood'},
      {key:'逛街/補給', label:'逛街/補給（彈性）', marker:'mSpot'},
      {key:'備案/警示', label:'備案/警示（雨天/排隊/超時）', marker:'mBackup'},
      {key:'其他', label:'其他', marker:'mSpot'}
    ];

    const items=d.items||[];
    // promote enriched attractions to 今日重點 if listed in highlights
    items.forEach(it=>{
      if (highlights.includes(it.title)) it.bucket='今日重點';
    });

    const sections=document.createElement('div');
    sections.className='sections';

    buckets.forEach(b=>{
      const list=items.filter(it=> (it.bucket||'')===b.key);
      if (!list.length) return;

      const sec=document.createElement('div');
      sec.className='section';

      const secHead=document.createElement('div');
      secHead.className='sectionHead';
      secHead.innerHTML = `
        <div class="sectionTitle">
          <span class="marker ${b.marker}"></span>
          <strong>${escapeHtml(b.label)}</strong>
        </div>
        <span class="badge">${list.length} 項</span>
      `;
      const secBody=document.createElement('div');
      secBody.className='sectionBody';

      list.forEach(it=>{
        const name=(it.title||'').trim();
        const note=(it.note||'').trim();
        const item=document.createElement('div');
        item.className='item';

        const tagHtml = (it.tags||[]).length
          ? `<div class="tags" style="margin-top:6px">${it.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
          : '';

        const titleBits=[];
        if (name){
          titleBits.push(`<span class="name">${escapeHtml(name)}</span>`);
          titleBits.push(`<a href="${makeMapLink(name)}" target="_blank" rel="noopener">地圖</a>`);
        }else{
          titleBits.push(`<span class="muted">備註</span>`);
        }

        item.innerHTML = `
          <div class="itemTitle">${titleBits.join(' · ')}</div>
          ${note ? `<div class="note">${escapeHtml(note)}</div>` : ''}
          ${tagHtml}
        `;

        // enrichment block
        if (name && enrich[name]){
          const e=enrich[name];
          const enrichHtml = `
            <div class="enrich">
              <strong>補充資訊 · ${escapeHtml(e.category||'')}</strong>
              ${e.area ? `<div class="muted">區域：${escapeHtml(e.area)}</div>` : ''}
              ${e.time_suggest ? `<div class="muted">建議停留：${escapeHtml(e.time_suggest)}</div>` : ''}
              ${e.best_time ? `<div class="muted">建議時段：${escapeHtml(e.best_time)}</div>` : ''}
              ${e.ticket ? `<div class="muted">票券：${escapeHtml(e.ticket)}</div>` : ''}
              ${e.kid_tip ? `<div class="muted">親子提示：${escapeHtml(e.kid_tip)}</div>` : ''}
            </div>
          `;
          item.insertAdjacentHTML('beforeend', enrichHtml);
        }

        secBody.appendChild(item);
      });

      sec.appendChild(secHead);
      sec.appendChild(secBody);
      sections.appendChild(sec);
    });

    body.appendChild(sections);

    dayEl.appendChild(head);
    dayEl.appendChild(body);
    daysBox.appendChild(dayEl);

    if (idx===0) dayEl.classList.add('open');
  });
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
