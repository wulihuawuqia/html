document.addEventListener('DOMContentLoaded', function() {
    const jsonInput = document.getElementById('jsonInput');
    const jsonPreview = document.getElementById('jsonPreview');
    const formatBtn = document.getElementById('formatBtn');
    const clearBtn = document.getElementById('clearBtn');
    const sampleBtn = document.getElementById('sampleBtn');
    const expandAllBtn = document.getElementById('expandAllBtn');
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    const copyBtn = document.getElementById('copyBtn');
    const notification = document.getElementById('notification');

    // 格式化按钮事件
    formatBtn.addEventListener('click', formatJSON);
    
    // 清空按钮事件
    clearBtn.addEventListener('click', () => {
        jsonInput.value = '';
        jsonPreview.innerHTML = '';
        showNotification('已清空内容', 'success');
    });
    
    // 示例按钮事件
    sampleBtn.addEventListener('click', loadSample);
    
    // 展开所有按钮事件
    expandAllBtn.addEventListener('click', () => {
        toggleAll(true);
        showNotification('已展开所有节点', 'success');
    });
    
    // 折叠所有按钮事件
    collapseAllBtn.addEventListener('click', () => {
        toggleAll(false);
        showNotification('已折叠所有节点', 'success');
    });
    
    // 复制按钮事件
    copyBtn.addEventListener('click', copyToClipboard);
    
    // 实时预览
    jsonInput.addEventListener('input', debounce(renderPreview, 300));

    // 格式化JSON
    function formatJSON() {
        try {
            const jsonString = jsonInput.value;
            if (!jsonString.trim()) {
                showNotification('请输入JSON内容', 'error');
                return;
            }
            
            const jsonObject = JSON.parse(jsonString);
            jsonInput.value = JSON.stringify(jsonObject, null, 2);
            renderPreview();
            showNotification('JSON格式化成功', 'success');
        } catch (e) {
            showNotification('JSON格式错误: ' + e.message, 'error');
        }
    }

    // 渲染预览
    function renderPreview() {
        try {
            const jsonString = jsonInput.value;
            if (!jsonString.trim()) {
                jsonPreview.innerHTML = '';
                return;
            }
            
            const jsonObject = JSON.parse(jsonString);
            jsonPreview.innerHTML = '<div class="json-tree">' + buildJSONTree(jsonObject) + '</div>';
            
            // 添加折叠/展开事件
            addToggleEvents();
        } catch (e) {
            jsonPreview.innerHTML = '<div class="error">JSON解析错误: ' + e.message + '</div>';
        }
    }

    // 构建JSON树
    function buildJSONTree(obj, isLast = true, key = '', isRoot = true) {
        if (obj === null) {
            return `<span class="json-value-null">null</span>`;
        }
        
        if (typeof obj === 'string') {
            return `<span class="json-value-string">"${escapeHtml(obj)}"</span>`;
        }
        
        if (typeof obj === 'number') {
            return `<span class="json-value-number">${obj}</span>`;
        }
        
        if (typeof obj === 'boolean') {
            return `<span class="json-value-boolean">${obj}</span>`;
        }
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) {
                return '<span class="json-bracket">[]</span>';
            }
            
            let html = '<span class="json-toggle">▼</span><span class="json-bracket">[</span><ul class="json-collapsible">';
            obj.forEach((item, index) => {
                const isLastItem = index === obj.length - 1;
                html += `<li>${buildJSONTree(item, isLastItem, index, false)}${!isLastItem ? '<span class="json-comma">,</span>' : ''}</li>`;
            });
            html += '</ul><span class="json-bracket">]</span>';
            return html;
        }
        
        // 对象类型
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) {
                return '<span class="json-bracket">{}</span>';
            }
            
            let html = '<span class="json-toggle">▼</span><span class="json-bracket">{</span><ul class="json-collapsible">';
            keys.forEach((k, index) => {
                const isLastItem = index === keys.length - 1;
                html += `<li><span class="json-key">"${escapeHtml(k)}"</span>: ${buildJSONTree(obj[k], isLastItem, k, false)}${!isLastItem ? '<span class="json-comma">,</span>' : ''}</li>`;
            });
            html += '</ul><span class="json-bracket">}</span>';
            return html;
        }
        
        return String(obj);
    }

    // 添加折叠/展开事件
    function addToggleEvents() {
        const toggles = document.querySelectorAll('.json-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', function() {
                const parent = this.parentElement;
                parent.classList.toggle('json-collapsed');
                
                // 切换图标
                if (parent.classList.contains('json-collapsed')) {
                    this.textContent = '▶';
                } else {
                    this.textContent = '▼';
                }
            });
        });
    }

    // 全部展开/折叠
    function toggleAll(expand) {
        const collapsibles = document.querySelectorAll('.json-collapsible');
        const toggles = document.querySelectorAll('.json-toggle');
        
        collapsibles.forEach(collapsible => {
            const parent = collapsible.parentElement;
            if (expand) {
                parent.classList.remove('json-collapsed');
            } else {
                parent.classList.add('json-collapsed');
            }
        });
        
        toggles.forEach(toggle => {
            if (expand) {
                toggle.textContent = '▼';
            } else {
                toggle.textContent = '▶';
            }
        });
    }

    // 复制到剪贴板
    function copyToClipboard() {
        const jsonString = jsonInput.value;
        if (!jsonString.trim()) {
            showNotification('没有内容可复制', 'error');
            return;
        }
        
        navigator.clipboard.writeText(jsonString).then(() => {
            showNotification('已复制到剪贴板', 'success');
        }).catch(err => {
            showNotification('复制失败: ' + err, 'error');
        });
    }

    // 加载示例
    function loadSample() {
        const sample = {
            "姓名": "张三",
            "年龄": 25,
            "职业": "软件工程师",
            "技能": [
                "JavaScript",
                "Python",
                "React",
                "Node.js"
            ],
            "地址": {
                "国家": "中国",
                "城市": "北京",
                "邮编": "100000"
            },
            "已婚": false,
            "工作经验": null
        };
        
        jsonInput.value = JSON.stringify(sample, null, 2);
        renderPreview();
        showNotification('已加载示例JSON', 'success');
    }

    // 显示通知
    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = 'notification ' + type + ' show';
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // 工具函数：HTML转义
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});