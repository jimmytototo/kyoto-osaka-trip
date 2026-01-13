async function load(){
  const res = await fetch('./data.json');
  const data = await res.json();
  document.getElementById('title').textContent = data.title || '行程';
  document.getElementById('subtitle').textContent = data.subtitle || '';
  document.getElementById('generated').textContent = `產出日期：${data.generated_on || ''}`;

  // Overview bullets (opinionated but grounded in the sheet structure)
  const pace = [
    '2/4 抵達＋入住＋京都站周邊晚餐：安排合理，留有緩衝。',
    '2/5 清水寺＋東山＋祇園：動線順、步行多，建議早出發避開人潮。',
    '2/6 伏見稻荷＋宇治＋奈良：對 2 大 2 小偏緊湊，若要更舒適建議拆成兩天。',
    '大阪段落以室內景點（海遊館／樂高）作為雨備：策略正確。'
  ];
  const risks = [
    '東山、伏見稻荷多階梯與坡道：推車行動成本高。',
    '京都市巴士尖峰易塞車：請保留轉乘與排隊時間。',
    '奈良餵鹿：小孩需成人陪同、餅乾收好避免被追。',
    '熱門景點（大阪城天守閣、海遊館）可能排隊：建議線上票或一早/傍晚入場。'
  ];
  const tweaks = [
    '若 2/6 要保留宇治任天堂博物館：奈良建議改到大阪段落或另一天，避免一天跨三地。',
    '清水寺安排「早到」：08:00 前到最省體力與拍照品質最好。',
    '晚餐點位集中在車站/商圈：親子行程優先選擇免排隊或可訂位的店家。',
    '每天保留 1 個「可抽掉」的彈性點，避免超時影響孩子情緒。'
  ];
  const opsTips = [
    {title:'交通與步行', body:'用 Google Maps 設定「到站後步行時間」並加 10–15 分鐘緩衝；京都公車遇塞車時，改地鐵＋短程計程車常更快。'},
    {title:'票券策略', body:'大阪需要付費景點多時再買周遊卡；若只跑 1–2 個付費點，單買門票＋地鐵一日券可能更省。'},
    {title:'親子節奏', body:'上午跑重點、下午留室內或商圈；每 90 分鐘安排一次休息/點心。'},
    {title:'用餐', body:'熱門店以「開店即到」或「離峰」為原則；若遇排隊超過 20–30 分鐘，直接啟用備案。'}
  ];

  const ulFill = (id, arr) => {
    const ul = document.getElementById(id);
    ul.innerHTML = '';
    arr.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
  };
  ulFill('pace', pace);
  ulFill('risks', risks);
  ulFill('tweaks', tweaks);

  const tipsBox = document.getElementById('opsTips');
  tipsBox.innerHTML = '';
  opsTips.forEach(t => {
    const d = document.createElement('div');
    d.className = 'tip';
    d.innerHTML = `<strong>${t.title}</strong><div class="muted" style="margin-top:6px">${t.body}</div>`;
    tipsBox.appendChild(d);
  });

  // Transport cards
  const tc = document.getElementById('transportCards');
  tc.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'bullets';
  const ul = document.createElement('ul');
  ul.className = 'bullets';
  (data.transport_cards || []).forEach(x => {
    const li = document.createElement('li');
    const k = (x.k || '').trim();
    const v = (x.v || '').trim();
    if (v.startsWith('http')){
      li.innerHTML = `<span class="muted">${k ? k + '：' : ''}</span><a href="${v}" target="_blank" rel="noopener">連結</a>`;
    }else{
      li.innerHTML = `${k ? `<strong>${k}</strong>：` : ''}<span class="muted">${escapeHtml(v)}</span>`;
    }
    ul.appendChild(li);
  });
  list.appendChild(ul);
  tc.appendChild(list);

  // Days rendering
  const daysBox = document.getElementById('days');
  const enrich = data.enrichment || {};
  const makeMapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  daysBox.innerHTML = '';
  (data.days || []).forEach((d, idx) => {
    const day = document.createElement('div');
    day.className = 'day';
    day.dataset.day = d.day_label;

    const items = d.items || [];
    const highlights = countHighlights(items, enrich);
    const badges = [];
    if (items.length) badges.push(`${items.length} 項`);
    if (highlights) badges.push(`${highlights} 個重點補強`);
    const head = document.createElement('div');
    head.className = 'dayHead';
    head.innerHTML = `
      <h3>${escapeHtml(d.day_label)}</h3>
      <div class="badges">${badges.map(b=>`<span class="badge">${b}</span>`).join('')}</div>
    `;
    head.addEventListener('click', () => day.classList.toggle('open'));

    const body = document.createElement('div');
    body.className = 'dayBody';

    items.forEach(it => {
      const name = (it.title || '').trim();
      const note = (it.note || '').trim();

      const item = document.createElement('div');
      item.className = 'item';

      const titleBits = [];
      if (name){
        titleBits.push(`<span class="name">${escapeHtml(name)}</span>`);
        titleBits.push(`<a href="${makeMapLink(name)}" target="_blank" rel="noopener">地圖</a>`);
      }else{
        titleBits.push(`<span class="muted">備註</span>`);
      }

      item.innerHTML = `
        <div class="itemTitle">${titleBits.join(' · ')}</div>
        ${note ? `<div class="note">${escapeHtml(note)}</div>` : ''}
      `;

      if (name && enrich[name]){
        const e = enrich[name];
        const parts = [];
        if (e.tag) parts.push(`<span class="badge">${escapeHtml(e.tag)}</span>`);
        const enrichHtml = `
          <div class="enrich">
            <strong>補充資訊 ${parts.join(' ')}</strong>
            ${e.time_suggest ? `<div class="muted">建議停留：${escapeHtml(e.time_suggest)}</div>` : ''}
            ${e.best_time ? `<div class="muted">建議時段：${escapeHtml(e.best_time)}</div>` : ''}
            ${e.ticket ? `<div class="muted">票券：${escapeHtml(e.ticket)}</div>` : ''}
            ${e.kid_tip ? `<div class="muted">親子提示：${escapeHtml(e.kid_tip)}</div>` : ''}
          </div>
        `;
        item.insertAdjacentHTML('beforeend', enrichHtml);
      }

      body.appendChild(item);
    });

    day.appendChild(head);
    day.appendChild(body);
    daysBox.appendChild(day);

    // open first day by default
    if (idx === 0) day.classList.add('open');
  });

  // Search
  const search = document.getElementById('search');
  search.addEventListener('input', () => {
    const q = (search.value || '').trim().toLowerCase();
    document.querySelectorAll('.day').forEach(dayEl => {
      if (!q){ dayEl.style.display=''; return; }
      const text = dayEl.innerText.toLowerCase();
      dayEl.style.display = text.includes(q) ? '' : 'none';
    });
  });

  document.getElementById('expandAll').addEventListener('click', () => {
    document.querySelectorAll('.day').forEach(d => d.classList.add('open'));
  });
  document.getElementById('collapseAll').addEventListener('click', () => {
    document.querySelectorAll('.day').forEach(d => d.classList.remove('open'));
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });
}

function countHighlights(items, enrich){
  let n=0;
  items.forEach(it=>{
    const name = (it.title||'').trim();
    if (name && enrich[name]) n++;
  });
  return n;
}

function escapeHtml(str){
  return String(str||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

load().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', '<p style="color:#fff;padding:16px">資料載入失敗，請確認 data.json 與檔案路徑。</p>');
});
