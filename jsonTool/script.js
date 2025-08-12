// 直接复用根目录最新版脚本（含本地缓存与业务模型分区、Tab全屏、自动比对、防抖等）
// 拷贝于 /Users/wuqia/html/script.js v2.1

// 本地存储键
const STORAGE_KEYS = {
  filter: 'jsonDiff_filterFields',
  important: 'jsonDiff_importantFields',
  models: 'jsonDiff_modelsConfig',
  flags: 'jsonDiff_flags',
  layout: 'jsonDiff_layoutConfig',
  fontSize: 'jsonDiff_fontSize'
};

let currentResults = null; // 比对后的扁平结果（保持顺序）
let currentFilter = 'all';
let currentModels = {}; // { 模型名: [前缀路径, ...] }
let currentLayout = { gridType: 'auto', sectionOrder: [], sectionSizes: {} }; // 布局设置
let currentFontSize = 12; // 当前字体大小

// 工具：localStorage
function saveToStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
function loadFromStorage(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  hydrateFromStorage();
    initializeEventListeners();
  loadExampleData(); // 加载示例数据
});

function hydrateFromStorage() {
  const filter = loadFromStorage(STORAGE_KEYS.filter, '');
  const important = loadFromStorage(STORAGE_KEYS.important, '');
  const flags = loadFromStorage(STORAGE_KEYS.flags, { ignoreCase: false, ignoreWhitespace: false });
  const models = loadFromStorage(STORAGE_KEYS.models, {});
  const layout = loadFromStorage(STORAGE_KEYS.layout, { gridType: 'auto', sectionOrder: [], sectionSizes: {} });

  const filterEl = document.getElementById('filterFields');
  const importantEl = document.getElementById('importantFields');
  const ignoreCaseEl = document.getElementById('ignoreCase');
  const ignoreWhitespaceEl = document.getElementById('ignoreWhitespace');
  if (filterEl) filterEl.value = filter;
  if (importantEl) importantEl.value = important;
  if (ignoreCaseEl) ignoreCaseEl.checked = !!flags.ignoreCase;
  if (ignoreWhitespaceEl) ignoreWhitespaceEl.checked = !!flags.ignoreWhitespace;
  currentModels = models || {};
  currentLayout = layout || { gridType: 'auto', sectionOrder: [], sectionSizes: {} };
  currentFontSize = loadFromStorage(STORAGE_KEYS.fontSize, 12);
  
  // 初始渲染模型列表
  if (typeof renderModelsList === 'function') {
    try { renderModelsList(); } catch(_){}
  }
  
  // 更新字体大小显示
  updateFontSizeDisplay();
}

function persistControlsToStorage() {
  saveToStorage(STORAGE_KEYS.filter, (document.getElementById('filterFields')?.value || ''));
  saveToStorage(STORAGE_KEYS.important, (document.getElementById('importantFields')?.value || ''));
  saveToStorage(STORAGE_KEYS.flags, {
    ignoreCase: !!document.getElementById('ignoreCase')?.checked,
    ignoreWhitespace: !!document.getElementById('ignoreWhitespace')?.checked
  });
}

// 解析模型：支持JSON对象或“模型名: 路径1, 路径2”
function parseModels(inputText) {
  let text = (inputText || '').trim();
  if (!text) return {};
  // 归一化常见全角符号与空白
  text = text
    .replace(/\uFEFF/g, '')            // 去BOM
    .replace(/[\u3000\t]+/g, ' ')     // 全角空格/制表符
    .replace(/[：]/g, ':')             // 全角冒号
    .replace(/[，]/g, ',');            // 全角逗号
  try {
    const obj = JSON.parse(text);
    const normalized = {};
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) normalized[k] = v.map(s => String(s).trim()).filter(Boolean);
      else if (typeof v === 'string') normalized[k] = v.split(',').map(s => s.trim()).filter(Boolean);
    }
    return normalized;
  } catch (_e) {
        const result = {};
    text.split(/\n+/).forEach(line => {
      const raw = line.trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('//')) return; // 忽略空行与注释
      const seg = line.split(':');
      if (seg.length >= 2) {
        const name = seg[0].trim();
        const rest = seg.slice(1).join(':');
        const paths = rest.split(',').map(s => s.trim()).filter(Boolean);
        if (name && paths.length) result[name] = paths;
      }
    });
        return result;
    }
}
function serializeModels(models) { try { return JSON.stringify(models, null, 2); } catch (e) { return ''; } }

// 事件
function initializeEventListeners() {
  const compareBtn = document.getElementById('compareBtn');
  if (compareBtn) {
    // 双绑定，确保点击可触发
    compareBtn.addEventListener('click', compareJSON);
    compareBtn.onclick = compareJSON;
  }
  // 暴露到全局，便于应急调用
  window.compareJSON = compareJSON;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', function() { switchTab(this.dataset.tab); }));
  // 新增模型按钮
  document.getElementById('addModelBtn')?.addEventListener('click', () => openModelModal());
  document.getElementById('resetModels')?.addEventListener('click', () => {
    currentModels = {};
    saveToStorage(STORAGE_KEYS.models, currentModels);
    renderModelsList();
    showNotification('模型设置已重置', 'success');
    if (currentResults) renderResults(currentResults, currentFilter);
  });
  // 弹窗交互
  document.getElementById('modalClose')?.addEventListener('click', closeModelModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModelModal);
  document.getElementById('modalSave')?.addEventListener('click', saveModelFromModal);
  // 自动比对（防抖）
  const debounced = debounce(compareJSON, 400);
  document.getElementById('jsonA')?.addEventListener('input', debounced);
  document.getElementById('jsonB')?.addEventListener('input', debounced);
  // Tab 全屏
  setupTabFullscreen();
}

// 渲染模型列表
function renderModelsList(){
  const listEl = document.getElementById('modelsList');
  if (!listEl) return;
  const entries = Object.entries(currentModels);
  if (entries.length===0){ 
    listEl.innerHTML = '<div style="color:#666;padding:8px;">暂无模型，点击"新增模型"创建</div>'; 
    return; 
  }
  listEl.innerHTML = entries.map(([name, paths], idx)=>{
    const pathsText = Array.isArray(paths)? paths.join(', ') : '';
    return `<div class="model-item" data-index="${idx}">
      <div class="model-info">
        <div class="model-name">${escapeHtml(name)}</div>
        <div class="model-paths">${escapeHtml(pathsText)}</div>
      </div>
      <div class="model-actions">
        <button class="btn-icon" onclick="openModelModal(${idx})"><i class=\"fas fa-pen\"></i> 编辑</button>
        <button class="btn-icon" onclick="deleteModel(${idx})"><i class=\"fas fa-trash\"></i> 删除</button>
        <button class="btn-icon" onclick="moveModel(${idx}, -1)"><i class=\"fas fa-arrow-up\"></i></button>
        <button class="btn-icon" onclick="moveModel(${idx}, 1)"><i class=\"fas fa-arrow-down\"></i></button>
      </div>
    </div>`;
  }).join('');
}

// 弹窗逻辑
function openModelModal(index){
  const modal = document.getElementById('modelModal');
  if (!modal) return;
  const title = document.getElementById('modalTitle');
  const nameEl = document.getElementById('modalModelName');
  const pathsEl = document.getElementById('modalModelPaths');
  modal.dataset.index = (index===undefined||index===null) ? '' : String(index);
  if (index===undefined || index===null){
    title.textContent = '新增模型';
    nameEl.value = '';
    pathsEl.value = '';
  } else {
    const entries = Object.entries(currentModels);
    const [name, paths] = entries[index] || ['', []];
    title.textContent = '编辑模型';
    nameEl.value = name;
    pathsEl.value = Array.isArray(paths) ? paths.join('\n') : '';
  }
  modal.style.display = 'flex';
}
function closeModelModal(){
  const modal = document.getElementById('modelModal');
  if (modal) modal.style.display = 'none';
}
function saveModelFromModal(){
  const modal = document.getElementById('modelModal');
  if (!modal) return;
  const indexStr = modal.dataset.index;
  const name = (document.getElementById('modalModelName')?.value || '').trim();
  const raw = (document.getElementById('modalModelPaths')?.value || '');
  const paths = raw.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
  if (!name){ showNotification('请输入模型名称','error'); return; }
  if (!paths.length){ showNotification('请至少输入一个路径前缀','error'); return; }
  const entries = Object.entries(currentModels);
  if (indexStr){
    const idx = Number(indexStr);
    const [oldName] = entries[idx] || [''];
    if (name===oldName){ currentModels[name] = paths; }
    else {
      const newObj={};
      entries.forEach(([k,v], i)=>{
        if (i===idx) newObj[name]=paths; else newObj[k]=v;
      });
      currentModels = newObj;
    }
            } else {
    currentModels[name] = paths;
  }
  saveToStorage(STORAGE_KEYS.models, currentModels);
  renderModelsList();
  closeModelModal();
  showNotification('模型已保存','success');
  if (currentResults) renderResults(currentResults, currentFilter);
}
function deleteModel(index){
  const entries = Object.entries(currentModels);
  if (index<0 || index>=entries.length) return;
  const newObj={}; entries.forEach(([k,v],i)=>{ if (i!==index) newObj[k]=v; });
  currentModels = newObj;
  saveToStorage(STORAGE_KEYS.models, currentModels);
  renderModelsList();
  showNotification('模型已删除','success');
  if (currentResults) renderResults(currentResults, currentFilter);
}
function moveModel(index, delta){
  const entries = Object.entries(currentModels);
  const to = index + delta; if (to<0 || to>=entries.length) return;
  const [moved] = entries.splice(index,1);
  entries.splice(to,0,moved);
  const newObj={}; entries.forEach(([k,v])=> newObj[k]=v);
  currentModels = newObj;
  saveToStorage(STORAGE_KEYS.models, currentModels);
  renderModelsList();
  if (currentResults) renderResults(currentResults, currentFilter);
}

function debounce(fn, delay) { let t = null; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), delay); }; }

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  currentFilter = tab;
  if (currentResults) renderResults(currentResults, tab);
}

// 比对（不改变字段顺序和值的大小写/空白）
function compareJSON() {
  const jsonAString = (document.getElementById('jsonA')?.value || '').trim();
  const jsonBString = (document.getElementById('jsonB')?.value || '').trim();
  if (!jsonAString || !jsonBString) { showNotification('请输入两个JSON对象', 'error'); return; }

  persistControlsToStorage();

  const ignoreCase = !!document.getElementById('ignoreCase')?.checked;
  const ignoreWhitespace = !!document.getElementById('ignoreWhitespace')?.checked;
    const filterFields = getFilterFields();
    const importantFields = getImportantFields();

    const normalizeForCompare = (s) => {
        let r = s;
        if (ignoreWhitespace) r = r.replace(/\s+/g, '');
        if (ignoreCase) r = r.toLowerCase();
        return r;
    };

  try {
    const btn = document.getElementById('compareBtn');
    const old = btn?.innerHTML; if (btn) { btn.innerHTML = '<div class="loading"></div> 比对中...'; btn.disabled = true; }

    const objA = JSON.parse(jsonAString);
    const objB = JSON.parse(jsonBString);

        const allPathsA = getAllFieldPathsWithOrigin(objA);
        const allPathsB = getAllFieldPathsWithOrigin(objB);

    // 合并，保持A顺序，再补B独有
    const map = new Map();
    for (const p of allPathsA) { const lower = p.pathArr.map(x => x.toLowerCase()).join('.'); if (!map.has(lower)) map.set(lower, p); }
    for (const p of allPathsB) { const lower = p.pathArr.map(x => x.toLowerCase()).join('.'); if (!map.has(lower)) map.set(lower, p); }

        const results = [];
    for (const { pathArr, pathStr } of map.values()) {
            if (shouldFilterField(pathStr, filterFields)) continue;
            const valueA = getFieldValueByArr(objA, pathArr);
            const valueB = getFieldValueByArr(objB, pathArr);
            const isImportant = isImportantField(pathStr, importantFields);
      const existsInA = valueA !== undefined; const existsInB = valueB !== undefined;
      if (!existsInA) results.push({ path: pathStr, type: 'missing', valueA: undefined, valueB, important: isImportant });
      else if (!existsInB) results.push({ path: pathStr, type: 'missing', valueA, valueB: undefined, important: isImportant });
      else {
                let isSame;
        if (typeof valueA === 'string' && typeof valueB === 'string') isSame = normalizeForCompare(valueA) === normalizeForCompare(valueB);
        else isSame = deepEqual(valueA, valueB);
                results.push({ path: pathStr, type: isSame ? 'same' : 'diff', valueA, valueB, important: isImportant });
            }
        }

        currentResults = results;
        displayResults(results);

    if (btn) { btn.innerHTML = old; btn.disabled = false; }
  } catch (e) {
    showNotification('JSON解析错误或比对异常：' + e.message, 'error');
    const btn = document.getElementById('compareBtn'); if (btn) { btn.innerHTML = '<i class="fas fa-magnifying-glass"></i> 开始比对'; btn.disabled = false; }
  }
}

// 字段列表
function getFilterFields(){ return (document.getElementById('filterFields')?.value || '').split(',').map(s=>s.trim()).filter(Boolean); }
function getImportantFields(){ return (document.getElementById('importantFields')?.value || '').split(',').map(s=>s.trim()).filter(Boolean); }

// 过滤/重要判断（路径完全匹配或前缀匹配；大小写不敏感以提升易用性）
function shouldFilterField(path, filters){ if (!filters.length) return false; return filters.some(f=> path===f || path.startsWith(f+'.') || path.toLowerCase()===f.toLowerCase() || path.toLowerCase().startsWith(f.toLowerCase()+'.')); }
function isImportantField(path, importants){ if (!importants.length) return false; return importants.some(f=> path===f || path.startsWith(f+'.') || path.toLowerCase()===f.toLowerCase() || path.toLowerCase().startsWith(f.toLowerCase()+'.')); }

// 路径与取值
function getAllFieldPathsWithOrigin(obj, pathArr=[], pathStr=''){
  const paths=[];
  if (obj && typeof obj==='object' && !Array.isArray(obj)){
    for (const [key,val] of Object.entries(obj)){
      const arr=[...pathArr,key]; const str=arr.join('.');
      if (val && typeof val==='object' && !Array.isArray(val)) paths.push(...getAllFieldPathsWithOrigin(val, arr, str));
      else paths.push({pathArr:arr, pathStr:str});
    }
  }
  return paths;
}
function getFieldValueByArr(obj, arr){ let cur=obj; for (const k of arr){ if (cur && typeof cur==='object' && k in cur) cur=cur[k]; else return undefined; } return cur; }

// 显示结果（按模型分区，剩余字段按原顺序）
function displayResults(results){
  const resultsDiv = document.getElementById('results');
  if (!results || !results.length) { if (resultsDiv) resultsDiv.style.display='none'; return; }
  resultsDiv.style.display='block';
  updateStats(results);
  renderResults(results, currentFilter);
}

function updateStats(results){
  document.getElementById('totalFields').textContent = String(results.length);
  document.getElementById('sameFields').textContent = String(results.filter(r=>r.type==='same').length);
  document.getElementById('diffFields').textContent = String(results.filter(r=>r.type==='diff').length);
  document.getElementById('missingFields').textContent = String(results.filter(r=>r.type==='missing').length);
}

function renderResults(results, filter='all'){
  const diffResultDiv = document.getElementById('diffResult');
  let base = results;
  if (filter!=='all') base = results.filter(r=>r.type===filter);

  // 模型分区
  const sections = [];
  const used = new Array(base.length).fill(false);
  for (const [modelName, prefixes] of Object.entries(currentModels)){
    if (!Array.isArray(prefixes) || prefixes.length===0) continue;
    const normPrefixes = prefixes.map(p=>String(p).trim()).filter(Boolean);
    const group=[]; base.forEach((r,idx)=>{
      if (used[idx]) return;
      if (normPrefixes.some(p=> r.path===p || r.path.startsWith(p+'.'))) { group.push(r); used[idx]=true; }
    });
    if (group.length) sections.push({ title: modelName, rows: group });
  }
  const rest = base.filter((_,idx)=>!used[idx]);
  if (rest.length) sections.push({ title: '其余字段', rows: rest });

  // 根据布局设置排序sections
  const orderedSections = applySectionOrder(sections);

  // 生成可拖拽的HTML
  const html = orderedSections.length ? `<div class="grid-layout grid-${currentLayout.gridType}" id="gridContainer">${orderedSections.map((sec, index) => {
    const tree = {};
    sec.rows.forEach(r => {
      const parts = r.path.split('.'); let node = tree;
      for (let i=0;i<parts.length-1;i++){ node[parts[i]] = node[parts[i]] || {}; node = node[parts[i]]; }
      const last = parts[parts.length-1];
      if (r.type==='same') node[last] = { value: r.valueA, type:'same', important: r.important };
      else if (r.type==='diff') node[last] = { valueA: r.valueA, valueB: r.valueB, type:'diff', important: r.important };
      else if (r.type==='missing') node[last] = { value: r.valueA!==undefined?r.valueA:r.valueB, type: r.valueA!==undefined?'missing-a':'missing-b', important: r.important };
    });
    const sectionId = `section-${encodeURIComponent(sec.title)}`;
    const savedSize = currentLayout.sectionSizes[sec.title] || {};
    const sizeStyle = Object.entries(savedSize).map(([k,v]) => `${k}:${v}`).join(';');
    return `<div class="draggable-section" data-section="${sec.title}" id="${sectionId}" style="${sizeStyle}">
      <div class="section-header" draggable="true">
        <div class="section-title">${escapeHtml(sec.title)}</div>
        <div class="section-controls">
          <button onclick="toggleSection('${sectionId}')" title="展开/收起" class="toggle-btn" id="toggle-${sectionId}">
            <i class="fas fa-expand-alt"></i>
          </button>
        </div>
      </div>
      <div class="section-content">
        <pre>${renderJSONTree(tree,'','')}</pre>
      </div>
      <div class="resize-handle bottom-right"></div>
      <div class="resize-handle bottom"></div>
      <div class="resize-handle right"></div>
    </div>`;
  }).join('')}</div>` : '<div style="color:#666;text-align:center;padding:12px;">没有符合条件的数据</div>';

    diffResultDiv.innerHTML = html;
  
  // 初始化拖拽功能
  if (orderedSections.length) {
    initializeDragAndDrop();
    initializeResizeHandles();
  }
  
  // 应用字体大小设置
  applyFontSize();
  
  // 渲染模型列表（保证与 currentModels 同步）
  renderModelsList();
}

function renderJSONTree(obj, indent='', parentPath=''){
  const lines=[]; const keys=Object.keys(obj); lines.push('{');
  keys.forEach((key, idx) => {
    const value = obj[key]; const isLast = idx===keys.length-1; const comma = isLast?'':','; const fullPath = parentPath? parentPath+'.'+key : key;
    if (typeof value==='object' && value!==null && !value.type){
      const nested = renderJSONTree(value, indent+' ', fullPath);
      lines.push(`${indent} "${key}": ${nested}${comma}`);
        } else {
      const info = value; const classes=['json-field', info.type]; if (info.important) classes.push('important');
      let content='';
      if (info.type==='same') content = `<span class=\"field-value\">${formatJSONValue(info.value)}</span>`;
      else if (info.type==='diff') content = `<span class=\"field-value value-a\">${formatJSONValue(info.valueA)}</span><span class=\"diff-arrow\">→</span><span class=\"field-value value-b\">${formatJSONValue(info.valueB)}</span>`;
      else if (info.type==='missing-a') content = `<span class=\"field-value value-a\">${formatJSONValue(info.value)}</span><span class=\"missing-indicator\">(仅A)</span>`;
      else if (info.type==='missing-b') content = `<span class=\"field-value value-b\">${formatJSONValue(info.value)}</span><span class=\"missing-indicator\">(仅B)</span>`;
      lines.push(`${indent} <span class=\"${classes.join(' ')}\">\"${key}\": ${content}</span>${comma}`);
    }
  });
  lines.push(`${indent}}`); return lines.join('\n');
}

function formatJSONValue(v){
  if (v===undefined) return '<span class=\"json-null\">undefined</span>';
  if (v===null) return '<span class=\"json-null\">null</span>';
  if (typeof v==='string') return `\"${escapeHtml(v)}\"`;
  if (typeof v==='number') return String(v);
  if (typeof v==='boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(formatJSONValue).join(', ')}]`;
  if (typeof v==='object') return '{...}';
  return String(v);
}
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 深比较
function deepEqual(a,b){
  if (typeof a!==typeof b) return false;
  if (a===null || b===null) return a===b;
  if (typeof a==='object'){
    if (Array.isArray(a)!==Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length!==b.length) return false; for (let i=0;i<a.length;i++){ if (!deepEqual(a[i],b[i])) return false; } return true; }
    const ka=Object.keys(a), kb=Object.keys(b); if (ka.length!==kb.length) return false; for (const k of ka){ if (!deepEqual(a[k], b[k])) return false; } return true;
  }
  return a===b;
}

// 通用提示
function showNotification(message,type='info'){
  const n=document.createElement('div'); n.textContent=message; n.style.cssText='position:fixed;top:16px;right:16px;background:#333;color:#fff;padding:8px 12px;border-radius:6px;z-index:99999'; document.body.appendChild(n); setTimeout(()=>n.remove(),1800);
}

// Tab 全屏
function setupTabFullscreen(){
  const content=document.querySelector('.result-content');
  const btn=document.getElementById('tabFullscreenToggle');
  const back=document.getElementById('tabFullscreenReturn');
  let full=false;
  const enter=()=>{ full=true; content?.classList.add('tab-fullscreen-mode'); document.body.classList.add('tab-fullscreen-active'); if (back) back.style.display='flex'; if (btn) btn.style.display='none'; document.body.style.overflow='hidden'; };
  const exit =()=>{ full=false; content?.classList.remove('tab-fullscreen-mode'); document.body.classList.remove('tab-fullscreen-active'); if (back) back.style.display='none'; if (btn) btn.style.display=''; document.body.style.overflow=''; };
  btn?.addEventListener('click', enter); back?.addEventListener('click', exit); document.addEventListener('keydown', e=>{ if (full && (e.key==='Escape'||e.key==='Esc')) exit(); });
}

// JSON格式化/清空按钮
function formatJSON(textareaId){ const t=document.getElementById(textareaId); try{ const j=JSON.parse(t.value); t.value=JSON.stringify(j,null,2);}catch{ showNotification('JSON格式错误，无法格式化','error'); } }
function clearJSON(textareaId){ const t=document.getElementById(textareaId); if (t) t.value=''; }

// 导出和复制结果
function exportResults(){
  if (!currentResults || !currentResults.length) {
    showNotification('没有比对结果可导出', 'error');
        return;
    }
  const data = {
        timestamp: new Date().toISOString(),
        results: currentResults,
    models: currentModels
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `json-diff-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('结果已导出', 'success');
}

function copyResults(){
  if (!currentResults || !currentResults.length) {
    showNotification('没有比对结果可复制', 'error');
        return;
    }
  const text = currentResults.map(r => {
    if (r.type === 'same') return `${r.path}: ${JSON.stringify(r.valueA)} (相同)`;
    if (r.type === 'diff') return `${r.path}: ${JSON.stringify(r.valueA)} → ${JSON.stringify(r.valueB)} (不同)`;
    if (r.type === 'missing') return `${r.path}: ${r.valueA !== undefined ? JSON.stringify(r.valueA) + ' (仅A)' : JSON.stringify(r.valueB) + ' (仅B)'}`;
    return `${r.path}: ${r.type}`;
    }).join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification('结果已复制到剪贴板', 'success');
    }).catch(() => {
    showNotification('复制失败，请手动选择文本', 'error');
  });
}

// 加载示例数据
function loadExampleData(){
  const jsonAEl = document.getElementById('jsonA');
  const jsonBEl = document.getElementById('jsonB');
  
  // 只在首次访问且输入框为空时加载示例
  if (jsonAEl && jsonBEl && !jsonAEl.value.trim() && !jsonBEl.value.trim()) {
    const exampleA = {
      "user": {
        "id": "12345",
        "profile": {
          "name": "张三",
          "email": "zhangsan@example.com",
          "age": 28
        },
        "preferences": {
          "theme": "dark",
          "language": "zh-CN"
        }
      },
      "order": {
        "id": "order_001",
        "total": 199.99,
        "status": "completed"
      },
      "metadata": {
        "created_at": "2024-01-15T10:30:00Z",
        "version": "1.0"
      }
    };

    const exampleB = {
      "user": {
        "id": "12345",
        "profile": {
          "name": "张三丰", // 修改了名字
          "email": "zhangsan@example.com",
          "age": 29 // 修改了年龄
        },
        "preferences": {
          "theme": "light", // 修改了主题
          "language": "zh-CN"
        }
      },
      "order": {
        "id": "order_001",
        "total": 299.99, // 修改了金额
        "status": "completed",
        "shipping": "express" // 新增字段
      },
      "metadata": {
        "created_at": "2024-01-15T10:30:00Z",
        "version": "2.0" // 修改了版本
      }
    };

    jsonAEl.value = JSON.stringify(exampleA, null, 2);
    jsonBEl.value = JSON.stringify(exampleB, null, 2);
    
    // 如果没有保存的模型设置，提供一个示例模型
    if (Object.keys(currentModels).length === 0) {
      currentModels = {
        "用户信息": ["user.id", "user.profile"],
        "订单信息": ["order"]
      };
      saveToStorage(STORAGE_KEYS.models, currentModels);
      renderModelsList();
    }
  }
}

// ==================== 布局和拖拽功能 ====================

// 根据保存的顺序排列sections
function applySectionOrder(sections) {
  if (!currentLayout.sectionOrder.length) return sections;
  
  const ordered = [];
  const sectionMap = new Map(sections.map(s => [s.title, s]));
  
  // 按保存的顺序添加
  for (const title of currentLayout.sectionOrder) {
    if (sectionMap.has(title)) {
      ordered.push(sectionMap.get(title));
      sectionMap.delete(title);
    }
  }
  
  // 添加新的sections
  ordered.push(...sectionMap.values());
  return ordered;
}

// 设置网格布局
function setGridLayout(type) {
  currentLayout.gridType = type;
  const container = document.getElementById('gridContainer');
  if (container) {
    container.className = `grid-layout grid-${type}`;
  }
  saveToStorage(STORAGE_KEYS.layout, currentLayout);
  showNotification(`已切换到${getLayoutName(type)}布局`, 'info');
}

function getLayoutName(type) {
  const names = { 'auto': '自动', '1-col': '单列', '2-col': '双列', '3-col': '三列' };
  return names[type] || type;
}

// 重置布局
function resetLayout() {
  currentLayout = { gridType: 'auto', sectionOrder: [], sectionSizes: {} };
  saveToStorage(STORAGE_KEYS.layout, currentLayout);
  if (currentResults) renderResults(currentResults, currentFilter);
  showNotification('布局已重置', 'success');
}

// 保存当前布局
function saveLayout() {
  // 保存当前section顺序
  const container = document.getElementById('gridContainer');
  if (container) {
    const sections = Array.from(container.querySelectorAll('.draggable-section'));
    currentLayout.sectionOrder = sections.map(el => el.dataset.section);
  }
  
  saveToStorage(STORAGE_KEYS.layout, currentLayout);
  showNotification('布局已保存', 'success');
}

// 初始化拖拽功能
function initializeDragAndDrop() {
  const container = document.getElementById('gridContainer');
  if (!container) return;
  
  let draggedElement = null;
  
  container.addEventListener('dragstart', (e) => {
    // 确保e.target存在且是元素节点
    if (!e.target || typeof e.target.closest !== 'function') {
      e.preventDefault();
      return;
    }
    
    // 只有从section-header开始的拖拽才被允许
    const headerElement = e.target.closest('.section-header');
    const sectionElement = e.target.closest('.draggable-section');
    
    if (headerElement && sectionElement) {
      draggedElement = sectionElement;
      draggedElement.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    } else {
      // 阻止其他区域的拖拽
      e.preventDefault();
    }
  });
  
  container.addEventListener('dragend', (e) => {
    // 确保e.target存在且有classList属性
    if (e.target && e.target.classList && e.target.classList.contains('draggable-section')) {
      e.target.classList.remove('dragging');
    }
    // 无论如何都清理draggedElement
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
      draggedElement = null;
    }
  });
  
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedElement) return;
    
    // 确保e.target存在且支持closest方法
    if (!e.target || typeof e.target.closest !== 'function') return;
    
    const dropTarget = e.target.closest('.draggable-section');
    if (dropTarget && dropTarget !== draggedElement) {
      const containerEl = dropTarget.parentNode;
      const allSections = Array.from(containerEl.children);
      const draggedIndex = allSections.indexOf(draggedElement);
      const targetIndex = allSections.indexOf(dropTarget);
      
      if (draggedIndex < targetIndex) {
        containerEl.insertBefore(draggedElement, dropTarget.nextSibling);
      } else {
        containerEl.insertBefore(draggedElement, dropTarget);
      }
      
      // 更新section顺序
      currentLayout.sectionOrder = Array.from(containerEl.querySelectorAll('.draggable-section'))
        .map(el => el.dataset.section);
      saveToStorage(STORAGE_KEYS.layout, currentLayout);
      showNotification('模块顺序已调整', 'info');
    }
  });
}

// 初始化调整大小功能
function initializeResizeHandles() {
  const container = document.getElementById('gridContainer');
  if (!container) return;
  
  let isResizing = false;
  let currentSection = null;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  
  container.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) {
      isResizing = true;
      currentSection = e.target.closest('.draggable-section');
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = currentSection.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      
      e.preventDefault();
      document.body.style.cursor = e.target.style.cursor;
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing || !currentSection) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(200, startWidth + deltaX);
    const newHeight = Math.max(150, startHeight + deltaY);
    
    currentSection.style.width = newWidth + 'px';
    currentSection.style.height = newHeight + 'px';
    currentSection.style.minWidth = 'auto';
    currentSection.style.minHeight = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing && currentSection) {
      // 保存大小设置
      const sectionTitle = currentSection.dataset.section;
      currentLayout.sectionSizes[sectionTitle] = {
        width: currentSection.style.width,
        height: currentSection.style.height,
        'min-width': 'auto',
        'min-height': 'auto'
      };
      saveToStorage(STORAGE_KEYS.layout, currentLayout);
    }
    
    isResizing = false;
    currentSection = null;
    document.body.style.cursor = '';
  });
}

// 展开/收起section
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const toggleBtn = document.getElementById(`toggle-${sectionId}`);
  
  if (!section || !toggleBtn) return;
  
  const content = section.querySelector('.section-content');
  const icon = toggleBtn.querySelector('i');
  
  // 检查当前状态
  const isExpanded = section.classList.contains('expanded');
  
  if (isExpanded) {
    // 收起 - 设置容器最小高度
    section.style.minHeight = '200px';
    section.style.height = '';
    icon.className = 'fas fa-expand-alt';
    toggleBtn.title = '展开';
    section.classList.remove('expanded');
  } else {
    // 展开 - 移除高度限制，让内容完全展示
    section.style.minHeight = 'auto';
    section.style.height = 'auto';
    icon.className = 'fas fa-compress-alt';
    toggleBtn.title = '收起';
    section.classList.add('expanded');
  }
}

// ==================== 字体大小控制 ====================

// 调整字体大小
function adjustFontSize(delta) {
  const newSize = Math.max(10, Math.min(16, currentFontSize + delta));
  if (newSize !== currentFontSize) {
    currentFontSize = newSize;
    saveToStorage(STORAGE_KEYS.fontSize, currentFontSize);
    applyFontSize();
    updateFontSizeDisplay();
    showNotification(`字体大小已调整为 ${currentFontSize}px`, 'info');
  }
}

// 重置字体大小
function resetFontSize() {
  currentFontSize = 12;
  saveToStorage(STORAGE_KEYS.fontSize, currentFontSize);
  applyFontSize();
  updateFontSizeDisplay();
  showNotification('字体大小已重置', 'success');
}

// 应用字体大小
function applyFontSize() {
  const container = document.getElementById('diffResult');
  if (container) {
    // 移除所有字体大小类
    for (let i = 10; i <= 16; i++) {
      container.classList.remove(`font-size-${i}`);
    }
    // 添加当前字体大小类
    container.classList.add(`font-size-${currentFontSize}`);
  }
}

// 更新字体大小显示
function updateFontSizeDisplay() {
  const display = document.getElementById('fontSizeDisplay');
  if (display) {
    display.textContent = currentFontSize;
  }
}


