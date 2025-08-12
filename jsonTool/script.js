// 全局变量
let currentResults = null;
let currentFilter = 'all';

// 示例数据
const examples = {
    basic: {
        jsonA: `{
  "name": "张三",
  "age": 25,
  "email": "zhangsan@example.com",
  "city": "北京",
  "hobbies": ["读书", "游泳"]
}`,
        jsonB: `{
  "name": "张三",
  "age": 26,
  "email": "zhangsan@example.com",
  "city": "上海",
  "hobbies": ["读书", "跑步"]
}`
    },
    nested: {
        jsonA: `{
  "user": {
    "id": 1,
    "profile": {
      "name": "李四",
      "age": 30,
      "address": {
        "city": "广州",
        "street": "天河路"
      }
    },
    "settings": {
      "theme": "dark",
      "language": "zh-CN"
    }
  },
  "metadata": {
    "created": "2024-01-01",
    "version": "1.0"
  }
}`,
        jsonB: `{
  "user": {
    "id": 1,
    "profile": {
      "name": "李四",
      "age": 30,
      "address": {
        "city": "深圳",
        "street": "天河路"
      }
    },
    "settings": {
      "theme": "light",
      "language": "zh-CN"
    }
  },
  "metadata": {
    "created": "2024-01-01",
    "version": "1.1"
  }
}`
    },
    array: {
        jsonA: `{
  "products": [
    {
      "id": 1,
      "name": "手机",
      "price": 2999,
      "category": "电子产品"
    },
    {
      "id": 2,
      "name": "笔记本",
      "price": 5999,
      "category": "电子产品"
    }
  ],
  "total": 2,
  "timestamp": "2024-01-01T10:00:00Z"
}`,
        jsonB: `{
  "products": [
    {
      "id": 1,
      "name": "手机",
      "price": 2999,
      "category": "电子产品"
    },
    {
      "id": 3,
      "name": "平板",
      "price": 3999,
      "category": "电子产品"
    }
  ],
  "total": 2,
  "timestamp": "2024-01-01T10:00:00Z"
}`
    }
};

// 防抖函数
function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadExample('basic');
    // 自动比对防抖
    const debouncedCompare = debounce(compareJSON, 400);
    document.getElementById('jsonA').addEventListener('input', debouncedCompare);
    document.getElementById('jsonB').addEventListener('input', debouncedCompare);
    // Tab内容全屏切换
    const resultTabs = document.querySelector('.result-tabs');
    const resultContent = document.querySelector('.result-content');
    const tabFullscreenBtn = document.getElementById('tabFullscreenToggle');
    const tabFullscreenReturn = document.getElementById('tabFullscreenReturn');
    // 兜底：初始隐藏返回按钮
    if (tabFullscreenReturn) tabFullscreenReturn.style.display = 'none';
    let isTabFullscreen = false;
    function enterTabFullscreen() {
        isTabFullscreen = true;
        resultContent.classList.add('tab-fullscreen-mode');
        document.body.classList.add('tab-fullscreen-active');
        tabFullscreenBtn.style.display = 'none';
        tabFullscreenReturn.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    function exitTabFullscreen() {
        isTabFullscreen = false;
        resultContent.classList.remove('tab-fullscreen-mode');
        document.body.classList.remove('tab-fullscreen-active');
        tabFullscreenBtn.style.display = '';
        tabFullscreenReturn.style.display = 'none';
        document.body.style.overflow = '';
    }
    tabFullscreenBtn.addEventListener('click', enterTabFullscreen);
    tabFullscreenReturn.addEventListener('click', exitTabFullscreen);
    // ESC退出Tab全屏
    document.addEventListener('keydown', function(e) {
        if (isTabFullscreen && (e.key === 'Escape' || e.key === 'Esc')) {
            exitTabFullscreen();
        }
    });
});

// 初始化事件监听器
function initializeEventListeners() {
    // 比对按钮
    document.getElementById('compareBtn').addEventListener('click', compareJSON);
    
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // 回车键触发比对
    document.getElementById('jsonA').addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            compareJSON();
        }
    });
    
    document.getElementById('jsonB').addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            compareJSON();
        }
    });
}

// 加载示例数据
function loadExample(type) {
    if (examples[type]) {
        document.getElementById('jsonA').value = examples[type].jsonA;
        document.getElementById('jsonB').value = examples[type].jsonB;
        formatJSON('jsonA');
        formatJSON('jsonB');
    }
}

// 格式化JSON
function formatJSON(textareaId) {
    const textarea = document.getElementById(textareaId);
    try {
        const json = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(json, null, 2);
    } catch (e) {
        showNotification('JSON格式错误，无法格式化', 'error');
    }
}

// 清空JSON
function clearJSON(textareaId) {
    document.getElementById(textareaId).value = '';
}

// 只对字符串值做大小写处理，不处理key
function normalizeCaseValueOnly(obj) {
    if (typeof obj === 'string') {
        return obj.toLowerCase();
    } else if (Array.isArray(obj)) {
        return obj.map(normalizeCaseValueOnly);
    } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = normalizeCaseValueOnly(value);
        }
        return result;
    }
    return obj;
}

// 解析JSON字符串（不修改任何值或字段名）
function parseJSON(jsonString, ignoreCase = false, ignoreWhitespace = false) {
    try {
        const processedString = jsonString.trim();
        const parsed = JSON.parse(processedString);
        // 忽略大小写/空白仅在比较时生效，这里不改动数据
        return parsed;
    } catch (e) {
        throw new Error(`JSON解析错误: ${e.message}`);
    }
}

// 获取过滤字段列表
function getFilterFields() {
    const filterInput = document.getElementById('filterFields').value;
    return filterInput.split(',').map(field => field.trim()).filter(field => field);
}

// 获取重要字段列表
function getImportantFields() {
    const importantInput = document.getElementById('importantFields').value;
    return importantInput.split(',').map(field => field.trim()).filter(field => field);
}

// 检查字段是否应该被过滤
function shouldFilterField(path, filterFields) {
    if (filterFields.length === 0) return false;
    
    return filterFields.some(filterField => {
        const pathParts = path.split('.');
        return pathParts.some(part => part.toLowerCase() === filterField.toLowerCase());
    });
}

// 检查字段是否重要
function isImportantField(path, importantFields) {
    if (importantFields.length === 0) return false;
    
    return importantFields.some(importantField => {
        const pathParts = path.split('.');
        return pathParts.some(part => part.toLowerCase() === importantField.toLowerCase());
    });
}

// 比较两个值
function compareValues(valueA, valueB) {
    if (typeof valueA !== typeof valueB) {
        return false;
    }
    
    if (valueA === null && valueB === null) {
        return true;
    }
    
    if (valueA === null || valueB === null) {
        return false;
    }
    
    if (typeof valueA === 'object') {
        if (Array.isArray(valueA) !== Array.isArray(valueB)) {
            return false;
        }
        
        if (Array.isArray(valueA)) {
            if (valueA.length !== valueB.length) {
                return false;
            }
            return valueA.every((item, index) => compareValues(item, valueB[index]));
        }
        
        const keysA = Object.keys(valueA);
        const keysB = Object.keys(valueB);
        
        if (keysA.length !== keysB.length) {
            return false;
        }
        
        return keysA.every(key => compareValues(valueA[key], valueB[key]));
    }
    
    return valueA === valueB;
}

// 递归比较对象
function compareObjects(objA, objB, path = '', filterFields = [], importantFields = []) {
    const results = [];
    
    // 获取所有唯一键
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    
    for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // 检查是否应该过滤此字段
        if (shouldFilterField(currentPath, filterFields)) {
            continue;
        }
        
        const valueA = objA[key];
        const valueB = objB[key];
        const isImportant = isImportantField(currentPath, importantFields);
        
        // 检查字段是否存在
        const existsInA = key in objA;
        const existsInB = key in objB;
        
        if (!existsInA) {
            results.push({
                path: currentPath,
                type: 'missing',
                valueA: undefined,
                valueB: valueB,
                important: isImportant
            });
        } else if (!existsInB) {
            results.push({
                path: currentPath,
                type: 'missing',
                valueA: valueA,
                valueB: undefined,
                important: isImportant
            });
        } else {
            // 比较值
            if (typeof valueA === 'object' && valueA !== null && 
                typeof valueB === 'object' && valueB !== null &&
                !Array.isArray(valueA) && !Array.isArray(valueB)) {
                // 递归比较嵌套对象
                const nestedResults = compareObjects(valueA, valueB, currentPath, filterFields, importantFields);
                results.push(...nestedResults);
            } else {
                const isSame = compareValues(valueA, valueB);
                results.push({
                    path: currentPath,
                    type: isSame ? 'same' : 'diff',
                    valueA: valueA,
                    valueB: valueB,
                    important: isImportant
                });
            }
        }
    }
    
    return results;
}

// 获取对象的所有字段路径（包括嵌套字段）
function getAllFieldPaths(obj, path = '') {
    const paths = [];
    
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // 递归获取嵌套对象的字段路径
                const nestedPaths = getAllFieldPaths(value, currentPath);
                paths.push(...nestedPaths);
            } else {
                paths.push(currentPath);
            }
        }
    }
    
    return paths;
}

// 获取所有字段路径及原始字段名链路
function getAllFieldPathsWithOrigin(obj, pathArr = [], pathStr = '') {
    const paths = [];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [key, value] of Object.entries(obj)) {
            const newPathArr = [...pathArr, key];
            const newPathStr = newPathArr.join('.');
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const nestedPaths = getAllFieldPathsWithOrigin(value, newPathArr, newPathStr);
                paths.push(...nestedPaths);
            } else {
                paths.push({
                    pathArr: newPathArr,
                    pathStr: newPathStr
                });
            }
        }
    }
    return paths;
}

// 获取字段值（支持嵌套路径，pathArr为原始字段名数组）
function getFieldValueByArr(obj, pathArr) {
    let current = obj;
    for (const key of pathArr) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return undefined;
        }
    }
    return current;
}

// 主比对函数
function compareJSON() {
    console.log('开始比对 - 保留原始字段名和值 v1.5');
    const jsonAString = document.getElementById('jsonA').value.trim();
    const jsonBString = document.getElementById('jsonB').value.trim();
    if (!jsonAString || !jsonBString) {
        showNotification('请输入两个JSON对象', 'error');
        return;
    }
    const ignoreCase = document.getElementById('ignoreCase').checked;
    const ignoreWhitespace = document.getElementById('ignoreWhitespace').checked;
    const filterFields = getFilterFields();
    const importantFields = getImportantFields();
    // 字符串比较归一化，仅用于比较，不改变显示值
    const normalizeForCompare = (s) => {
        let r = s;
        if (ignoreWhitespace) r = r.replace(/\s+/g, '');
        if (ignoreCase) r = r.toLowerCase();
        return r;
    };
    try {
        // 显示加载状态
        const compareBtn = document.getElementById('compareBtn');
        const originalText = compareBtn.innerHTML;
        compareBtn.innerHTML = '<div class="loading"></div> 比对中...';
        compareBtn.disabled = true;
        // 解析JSON（不改变大小写或空白）
        const objA = parseJSON(jsonAString, false, false);
        const objB = parseJSON(jsonBString, false, false);
        // 获取所有字段路径（含原始字段名链路）
        const allPathsA = getAllFieldPathsWithOrigin(objA);
        const allPathsB = getAllFieldPathsWithOrigin(objB);
        // 合并所有路径，保留A的原始顺序，再追加B中独有路径，仍保留其原始顺序
        const pathMap = new Map();
        for (const p of allPathsA) {
            const lower = p.pathArr.map(x => x.toLowerCase()).join('.');
            if (!pathMap.has(lower)) pathMap.set(lower, p);
        }
        for (const p of allPathsB) {
            const lower = p.pathArr.map(x => x.toLowerCase()).join('.');
            if (!pathMap.has(lower)) pathMap.set(lower, p);
        }
        // 生成完整的结果列表（不排序，保持插入顺序）
        const results = [];
        for (const {pathArr, pathStr} of pathMap.values()) {
            if (shouldFilterField(pathStr, filterFields)) continue;
            const valueA = getFieldValueByArr(objA, pathArr);
            const valueB = getFieldValueByArr(objB, pathArr);
            const isImportant = isImportantField(pathStr, importantFields);
            const existsInA = valueA !== undefined;
            const existsInB = valueB !== undefined;
            if (!existsInA) {
                results.push({ path: pathStr, type: 'missing', valueA: undefined, valueB, important: isImportant });
            } else if (!existsInB) {
                results.push({ path: pathStr, type: 'missing', valueA, valueB: undefined, important: isImportant });
            } else {
                let isSame;
                if (typeof valueA === 'string' && typeof valueB === 'string') {
                    isSame = normalizeForCompare(valueA) === normalizeForCompare(valueB);
                } else {
                    isSame = compareValues(valueA, valueB);
                }
                results.push({ path: pathStr, type: isSame ? 'same' : 'diff', valueA, valueB, important: isImportant });
            }
        }
        // 不排序，保持原有顺序
        currentResults = results;
        displayResults(results);
        compareBtn.innerHTML = originalText;
        compareBtn.disabled = false;
    } catch (error) {
        showNotification(error.message, 'error');
        const compareBtn = document.getElementById('compareBtn');
        compareBtn.innerHTML = '<i class="fas fa-search"></i> 开始比对';
        compareBtn.disabled = false;
    }
}

// 显示比对结果
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    const diffResultDiv = document.getElementById('diffResult');
    
    // 更新统计信息
    updateStats(results);
    
    // 显示结果区域
    resultsDiv.style.display = 'block';
    
    // 渲染结果
    renderResults(results, 'all');
    
    // 滚动到结果区域
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// 更新统计信息
function updateStats(results) {
    const stats = {
        total: results.length,
        same: results.filter(r => r.type === 'same').length,
        diff: results.filter(r => r.type === 'diff').length,
        missing: results.filter(r => r.type === 'missing').length
    };
    
    document.getElementById('totalFields').textContent = stats.total;
    document.getElementById('sameFields').textContent = stats.same;
    document.getElementById('diffFields').textContent = stats.diff;
    document.getElementById('missingFields').textContent = stats.missing;
}

// 渲染结果
function renderResults(results, filter = 'all') {
    const diffResultDiv = document.getElementById('diffResult');
    
    // 过滤结果
    let filteredResults = results;
    if (filter !== 'all') {
        filteredResults = results.filter(r => r.type === filter);
    }
    
    if (filteredResults.length === 0) {
        diffResultDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">没有找到符合条件的字段</p>';
        return;
    }
    
    // 构建JSON样式的显示
    const jsonStructure = {};
    
    // 按路径分组构建嵌套结构
    filteredResults.forEach(result => {
        const pathParts = result.path.split('.');
        let current = jsonStructure;
        
        // 构建嵌套路径
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        
        // 设置最终值
        const finalPart = pathParts[pathParts.length - 1];
        if (result.type === 'same') {
            current[finalPart] = {
                value: result.valueA,
                type: 'same',
                important: result.important
            };
        } else if (result.type === 'diff') {
            current[finalPart] = {
                valueA: result.valueA,
                valueB: result.valueB,
                type: 'diff',
                important: result.important
            };
        } else if (result.type === 'missing') {
            if (result.valueA !== undefined) {
                current[finalPart] = {
                    value: result.valueA,
                    type: 'missing-a',
                    important: result.important
                };
            } else {
                current[finalPart] = {
                    value: result.valueB,
                    type: 'missing-b',
                    important: result.important
                };
            }
        }
    });
    
    // 渲染JSON样式
    const html = renderJSONStructure(jsonStructure, '');
    diffResultDiv.innerHTML = html;
    // 不再调用setupFieldFullscreen
}

// 递归渲染JSON结构（不排序keys，保持插入顺序）
function renderJSONStructure(obj, indent = '', parentPath = '') {
    const lines = [];
    const keys = Object.keys(obj); // 不排序，保持插入顺序
    lines.push('{');
    keys.forEach((key, index) => {
        const value = obj[key];
        const isLast = index === keys.length - 1;
        const comma = isLast ? '' : ',';
        const fullPath = parentPath ? parentPath + '.' + key : key;
        if (typeof value === 'object' && value !== null && !value.type) {
            const nestedContent = renderJSONStructure(value, indent + '  ', fullPath);
            lines.push(`${indent}  "${key}": ${nestedContent}${comma}`);
        } else {
            const fieldInfo = value;
            const fieldClasses = ['json-field', fieldInfo.type];
            if (fieldInfo.important) fieldClasses.push('important');
            let fieldContent = '';
            if (fieldInfo.type === 'same') {
                fieldContent = `<span class="field-value">${formatJSONValue(fieldInfo.value)}</span>`;
            } else if (fieldInfo.type === 'diff') {
                fieldContent = `<span class="field-value value-a">${formatJSONValue(fieldInfo.valueA)}</span> <span class="diff-arrow">→</span> <span class="field-value value-b">${formatJSONValue(fieldInfo.valueB)}</span>`;
            } else if (fieldInfo.type === 'missing-a') {
                fieldContent = `<span class="field-value value-a">${formatJSONValue(fieldInfo.value)}</span> <span class="missing-indicator">(仅A)</span>`;
            } else if (fieldInfo.type === 'missing-b') {
                fieldContent = `<span class="field-value value-b">${formatJSONValue(fieldInfo.value)}</span> <span class="missing-indicator">(仅B)</span>`;
            }
            lines.push(`${indent}  <span class="${fieldClasses.join(' ')}">"${key}": ${fieldContent}</span>${comma}`);
        }
    });
    lines.push(`${indent}}`);
    return lines.join('\n');
}

// 格式化JSON值显示
function formatJSONValue(value) {
    if (value === undefined) {
        return '<span class="json-null">undefined</span>';
    }
    if (value === null) {
        return '<span class="json-null">null</span>';
    }
    if (typeof value === 'string') {
        return `<span class="json-string">"${value}"</span>`;
    }
    if (typeof value === 'number') {
        return `<span class="json-number">${value}</span>`;
    }
    if (typeof value === 'boolean') {
        return `<span class="json-boolean">${value}</span>`;
    }
    if (Array.isArray(value)) {
        return `<span class="json-array">[${value.map(formatJSONValue).join(', ')}]</span>`;
    }
    if (typeof value === 'object') {
        return `<span class="json-object">{...}</span>`;
    }
    return String(value);
}

// 格式化值显示
function formatValue(value) {
    if (value === undefined) {
        return '<em>undefined</em>';
    }
    if (value === null) {
        return '<em>null</em>';
    }
    if (typeof value === 'string') {
        return `"${value}"`;
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

// 切换标签页
function switchTab(tabName) {
    // 更新标签页状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 更新当前过滤器
    currentFilter = tabName;
    
    // 重新渲染结果
    if (currentResults) {
        renderResults(currentResults, tabName);
    }
}

// 导出结果
function exportResults() {
    if (!currentResults) {
        showNotification('没有可导出的结果', 'error');
        return;
    }
    
    const exportData = {
        timestamp: new Date().toISOString(),
        filterFields: getFilterFields(),
        importantFields: getImportantFields(),
        results: currentResults,
        stats: {
            total: currentResults.length,
            same: currentResults.filter(r => r.type === 'same').length,
            diff: currentResults.filter(r => r.type === 'diff').length,
            missing: currentResults.filter(r => r.type === 'missing').length
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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

// 复制结果
function copyResults() {
    if (!currentResults) {
        showNotification('没有可复制的结果', 'error');
        return;
    }
    
    const text = currentResults.map(result => {
        let line = `${result.path}: `;
        if (result.type === 'same') {
            line += `相同 - ${formatValue(result.valueA)}`;
        } else if (result.type === 'diff') {
            line += `不同 - A: ${formatValue(result.valueA)}, B: ${formatValue(result.valueB)}`;
        } else if (result.type === 'missing') {
            if (result.valueA !== undefined) {
                line += `仅在A中存在 - ${formatValue(result.valueA)}`;
            } else {
                line += `仅在B中存在 - ${formatValue(result.valueB)}`;
            }
        }
        if (result.important) {
            line += ' [重要]';
        }
        return line;
    }).join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification('结果已复制到剪贴板', 'success');
    }).catch(() => {
        showNotification('复制失败', 'error');
    });
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // 设置背景色
    if (type === 'error') {
        notification.style.backgroundColor = '#dc3545';
    } else if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else {
        notification.style.backgroundColor = '#17a2b8';
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style); 