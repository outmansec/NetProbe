// 全局变量
let currentLanguage = 'zh-CN';
let translations = {};
let tabCounter = 1;
let activeTabId = 'tab-1';

// HTML转义函数，防止XSS攻击
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return unsafe;
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 加载语言文件
async function loadTranslations(lang) {
    try {
        const response = await fetch(`i18n/${lang}.json`);
        translations = await response.json();
        applyTranslations();
        return true;
    } catch (error) {
        console.error('Failed to load translations:', error);
        return false;
    }
}

// 应用翻译
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const keys = key.split('.');
        let value = translations;

        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                value = key;
                break;
            }
        }

        if (typeof value === 'string') {
            // 跳过已经被用户重命名的标签标题
            if (element.classList.contains('tab-title') &&
                element.closest('.tab') &&
                element.closest('.tab').getAttribute('data-renamed') === 'true') {
                return;
            }

            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = value;
            } else {
                element.textContent = value;
            }
        }
    });

    // 更新所有标签页的数据格式示例
    document.querySelectorAll('[id^="dataFormat-"]').forEach(select => {
        const tabId = select.id.split('-')[1];
        updateDataPlaceholder(tabId);
    });
}

// 切换语言
async function changeLanguage(lang) {
    currentLanguage = lang;
    document.documentElement.lang = lang;
    
    // 同时更新后端的语言设置
    try {
        await window.go.main.App.SetLanguage(lang);
    } catch (error) {
        console.error("Failed to set backend language:", error);
    }
    
    // 加载前端翻译
    loadTranslations(lang);
}

// 创建新标签页
function createNewTab() {
    tabCounter++;
    const tabId = `tab-${tabCounter}`;

    // 创建标签头
    const tabHeader = document.createElement('div');
    tabHeader.className = 'tab';
    tabHeader.setAttribute('data-tab-id', tabId);
    tabHeader.onclick = () => activateTab(tabId);

    // 创建标题元素，但不使用data-i18n属性，避免被翻译覆盖
    const titleSpan = document.createElement('span');
    titleSpan.className = 'tab-title';
    titleSpan.textContent = translations.tabs?.untitled || '未命名';
    titleSpan.onclick = (event) => startRenameTab(event, tabId);

    // 创建输入框
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'tab-title-input';
    titleInput.id = `tab-title-input-${tabId}`;
    titleInput.onblur = () => finishRenameTab(tabId);
    titleInput.onkeypress = (event) => handleTabTitleKeyPress(event, tabId);
    titleInput.style.display = 'none';

    // 创建关闭按钮
    const closeSpan = document.createElement('span');
    closeSpan.className = 'tab-close';
    closeSpan.textContent = '×';
    closeSpan.onclick = (event) => closeTab(event, tabId);

    // 添加元素到标签头
    tabHeader.appendChild(titleSpan);
    tabHeader.appendChild(titleInput);
    tabHeader.appendChild(closeSpan);

    // 插入标签头到容器中
    const tabsContainer = document.getElementById('tabs-container');
    const newTabButton = tabsContainer.querySelector('.new-tab');
    if (newTabButton) {
        tabsContainer.insertBefore(tabHeader, newTabButton);
    } else {
        tabsContainer.appendChild(tabHeader);
        // 添加新标签按钮
        const newTab = document.createElement('div');
        newTab.className = 'new-tab';
        newTab.onclick = createNewTab;
        newTab.textContent = '+';
        tabsContainer.appendChild(newTab);
    }

    // 创建标签内容
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = tabId;
    tabContent.innerHTML = `
        <div class="form-section">
            <div class="form-row">
                <div class="form-group" style="flex: 0.8;">
                    <label for="ip-${tabId}" data-i18n="connection.ip">IP地址:</label>
                    <input type="text" id="ip-${tabId}" placeholder="127.0.0.1" value="127.0.0.1">
                </div>
                <div class="form-group" style="flex: 0.4;">
                    <label for="protocol-${tabId}" data-i18n="connection.protocol">协议:</label>
                    <select id="protocol-${tabId}">
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 0.4;">
                    <label for="port-${tabId}" data-i18n="connection.port">端口:</label>
                    <input type="text" id="port-${tabId}" placeholder="23" value="23">
                </div>
                <div class="form-group" style="flex: 0.8;">
                    <label for="dataFormat-${tabId}" data-i18n="connection.dataFormat">发送数据格式:</label>
                    <select id="dataFormat-${tabId}" onchange="updateDataPlaceholder('${tabId}')">
                        <option value="raw_string" selected data-i18n="formats.rawString">原始字符串</option>
                        <option value="hex_comma" data-i18n="formats.hexComma">十六进制 (0x)</option>
                        <option value="hex_slash" data-i18n="formats.hexSlash">十六进制 (\\x)</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="inputData-${tabId}" data-i18n="connection.inputData">发送数据 (可选):</label>
                <textarea id="inputData-${tabId}" placeholder="hello"></textarea>
                <div class="example" id="dataExample-${tabId}" data-i18n="examples.rawString">直接输入原始字符串，如 hello</div>
            </div>

            <button class="btn" onclick="connectProbe('${tabId}')" data-i18n="connection.connect">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                </svg>
                <span data-i18n="connection.connect">连接</span>
            </button>
        </div>

        <div class="loading" id="loading-${tabId}">
            <div class="spinner"></div>
            <div data-i18n="results.connecting">正在连接...</div>
        </div>

        <div class="result-section" id="results-${tabId}" style="display: none;">
            <div id="resultContent-${tabId}"></div>
        </div>
    `;

    // 添加标签内容到容器
    document.querySelector('.container').insertBefore(tabContent, document.querySelector('.footer'));

    // 激活新标签页
    activateTab(tabId);

    // 应用翻译
    applyTranslations();

    // 更新滚动按钮状态
    updateScrollButtonsVisibility();
}

// 激活标签页
function activateTab(tabId) {
    // 检查标签页是否存在
    const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
    const contentElement = document.getElementById(tabId);

    if (!tabElement || !contentElement) {
        console.error(`Tab ${tabId} not found`);
        return;
    }

    // 取消激活所有标签
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 激活选中的标签
    tabElement.classList.add('active');
    contentElement.classList.add('active');

    activeTabId = tabId;

    // 确保标签在可视区域内
    tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

// 关闭标签页
function closeTab(event, tabId) {
    // 阻止事件冒泡，避免触发标签激活
    if (event) {
        event.stopPropagation();
    }

    // 如果只有一个标签页，不允许关闭
    if (document.querySelectorAll('.tab').length <= 1) {
        return;
    }

    // 在移除标签前，找到要激活的下一个标签
    let nextTabId = null;

    // 如果关闭的是当前激活的标签，则需要确定下一个要激活的标签
    if (activeTabId === tabId) {
        const tabs = Array.from(document.querySelectorAll('.tab'));
        const currentIndex = tabs.findIndex(tab => tab.getAttribute('data-tab-id') === tabId);

        // 优先选择右侧标签，如果没有则选择左侧标签
        if (currentIndex < tabs.length - 1) {
            // 有右侧标签
            nextTabId = tabs[currentIndex + 1].getAttribute('data-tab-id');
        } else if (currentIndex > 0) {
            // 没有右侧标签，但有左侧标签
            nextTabId = tabs[currentIndex - 1].getAttribute('data-tab-id');
        }
    }

    // 移除标签头和内容
    document.querySelector(`[data-tab-id="${tabId}"]`).remove();
    document.getElementById(tabId).remove();

    // 如果关闭的是当前激活的标签，则激活下一个标签
    if (activeTabId === tabId && nextTabId) {
        activateTab(nextTabId);
    }

    // 更新滚动按钮状态
    updateScrollButtonsVisibility();
}

// 开始重命名标签
function startRenameTab(event, tabId) {
    // 阻止事件冒泡，避免触发标签激活
    event.stopPropagation();

    const titleSpan = document.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
    const titleInput = document.querySelector(`#tab-title-input-${tabId}`);

    // 设置输入框的值为当前标题
    titleInput.value = titleSpan.textContent;

    // 隐藏标题，显示输入框
    titleSpan.style.display = 'none';
    titleInput.style.display = 'block';

    // 聚焦输入框
    titleInput.focus();
    titleInput.select();
}

// 完成重命名标签
function finishRenameTab(tabId) {
    const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
    const titleSpan = tabElement.querySelector(`.tab-title`);
    const titleInput = document.querySelector(`#tab-title-input-${tabId}`);

    // 如果输入框有值，则更新标题
    if (titleInput.value.trim()) {
        titleSpan.textContent = titleInput.value.trim();
        // 标记该标签已被重命名，避免被翻译覆盖
        tabElement.setAttribute('data-renamed', 'true');
    }

    // 隐藏输入框，显示标题
    titleInput.style.display = 'none';
    titleSpan.style.display = 'block';
}

// 处理标签标题输入框的按键事件
function handleTabTitleKeyPress(event, tabId) {
    // 如果按下回车键，完成重命名
    if (event.key === 'Enter') {
        event.preventDefault();
        finishRenameTab(tabId);
    }
}

// 获取数据格式的显示名称
function getDataFormatDisplayName(tabId) {
    const dataFormat = document.getElementById(`dataFormat-${tabId}`).value;
    const key = `formats.${dataFormat === 'hex_comma' ? 'hexComma' : dataFormat === 'hex_slash' ? 'hexSlash' : 'rawString'}`;

    // 从翻译中获取
    if (translations.formats) {
        if (dataFormat === 'hex_comma' && translations.formats.hexComma) {
            return translations.formats.hexComma;
        } else if (dataFormat === 'hex_slash' && translations.formats.hexSlash) {
            return translations.formats.hexSlash;
        } else if (dataFormat === 'raw_string' && translations.formats.rawString) {
            return translations.formats.rawString;
        }
    }

    // 默认值
    switch (dataFormat) {
        case 'hex_comma': return '十六进制 (0x格式)';
        case 'hex_slash': return '十六进制 (\\x格式)';
        case 'raw_string': return '原始字符串';
        default: return dataFormat;
    }
}

// 根据选择的数据格式更新输入框提示和示例
function updateDataPlaceholder(tabId) {
    const dataFormat = document.getElementById(`dataFormat-${tabId}`).value;
    const inputData = document.getElementById(`inputData-${tabId}`);
    const dataExample = document.getElementById(`dataExample-${tabId}`);

    let placeholderKey, exampleKey;

    switch (dataFormat) {
        case 'hex_comma':
            inputData.placeholder = "0x68,0x65,0x6c,0x6c,0x6f";
            placeholderKey = "examples.hexComma";
            break;
        case 'hex_slash':
            inputData.placeholder = "\\x68\\x65\\x6c\\x6c\\x6f";
            placeholderKey = "examples.hexSlash";
            break;
        case 'raw_string':
            inputData.placeholder = "hello";
            placeholderKey = "examples.rawString";
            break;
    }

    // 设置示例文本
    if (translations.examples) {
        const exampleText = translations.examples[dataFormat === 'hex_comma' ? 'hexComma' :
            dataFormat === 'hex_slash' ? 'hexSlash' : 'rawString'];
        if (exampleText) {
            dataExample.textContent = exampleText;
        } else {
            dataExample.setAttribute('data-i18n', placeholderKey);
        }
    } else {
        dataExample.setAttribute('data-i18n', placeholderKey);
    }
}

// 连接网络探测
async function connectProbe(tabId) {
    const ip = document.getElementById(`ip-${tabId}`).value.trim();
    const port = document.getElementById(`port-${tabId}`).value.trim();
    let inputData = document.getElementById(`inputData-${tabId}`).value.trim();
    const protocol = document.getElementById(`protocol-${tabId}`).value;
    const dataFormat = document.getElementById(`dataFormat-${tabId}`).value;

    if (!ip || !port) {
        showError(tabId, translations.results?.error || '错误',
            '请输入IP地址和端口');
        return;
    }

    // 处理原始字符串中的转义序列
    if (dataFormat === 'raw_string') {
        // 替换常见的转义序列为实际字符
        inputData = inputData
            .replace(/\\r\\n/g, '\r\n')  // 替换 \r\n 字符串为实际的回车换行
            .replace(/\\n/g, '\n')       // 替换 \n 字符串为实际的换行
            .replace(/\\r/g, '\r')       // 替换 \r 字符串为实际的回车
            .replace(/\\t/g, '\t')       // 替换 \t 字符串为实际的制表符
            .replace(/\\"/g, '"')        // 替换 \" 字符串为实际的双引号
            .replace(/\\'/g, "'")        // 替换 \' 字符串为实际的单引号
            .replace(/\\\\/g, '\\');     // 替换 \\ 字符串为实际的反斜杠
    }

    // 显示加载状态
    document.getElementById(`loading-${tabId}`).style.display = 'block';
    document.getElementById(`results-${tabId}`).style.display = 'none';

    try {
        const result = await window.go.main.App.ConnectProbe(ip, port, inputData, protocol, dataFormat);
        showResult(tabId, result);
    } catch (error) {
        showError(tabId, translations.results?.failure || '连接失败', error);
    } finally {
        document.getElementById(`loading-${tabId}`).style.display = 'none';
    }
}

// 显示结果
function showResult(tabId, result) {
    const resultsDiv = document.getElementById(`results-${tabId}`);
    const contentDiv = document.getElementById(`resultContent-${tabId}`);

    if (!result.success) {
        contentDiv.innerHTML = `
            <div class="result-card error">
                <div class="result-title">${translations.results?.failure || '连接失败'}</div>
                <div class="result-content">${escapeHtml(result.error)}</div>
            </div>
        `;
    } else {
        contentDiv.innerHTML = `
            <div class="result-card success">
                <div class="result-title">${translations.results?.success || '连接成功'}</div>
                <div class="result-content">${translations.results?.protocol || '协议'}: ${document.getElementById(`protocol-${tabId}`).value.toUpperCase()}
${translations.results?.dataFormat || '发送数据格式'}: ${getDataFormatDisplayName(tabId)}
${translations.results?.receiveTime || '接收时间'}: ${result.time}
${translations.results?.dataLength || '接收数据长度'}: ${result.length}</div>
            </div>

            <div class="result-card">
                <div class="result-title">${translations.results?.hexGo || '十六进制 (0x格式)'}</div>
                <div class="result-content">${escapeHtml(result.hexGo)}</div>
            </div>

            <div class="result-card">
                <div class="result-title">${translations.results?.hexSlash || '十六进制 (\\x格式)'}</div>
                <div class="result-content">${escapeHtml(result.hexSlash)}</div>
            </div>

            <div class="result-card">
                <div class="result-title">${translations.results?.decimal || '十进制'}</div>
                <div class="result-content">[${Array.from(result.decimal).join(', ')}]</div>
            </div>

            <div class="result-card">
                <div class="result-title">${translations.results?.string || '字符串'}</div>
                <div class="result-content">${escapeHtml(result.string)}</div>
            </div>
        `;
    }

    resultsDiv.style.display = 'block';
}

// 显示错误
function showError(tabId, title, message) {
    const resultsDiv = document.getElementById(`results-${tabId}`);
    const contentDiv = document.getElementById(`resultContent-${tabId}`);

    contentDiv.innerHTML = `
        <div class="result-card error">
            <div class="result-title">${title}</div>
            <div class="result-content">${escapeHtml(message)}</div>
        </div>
    `;

    resultsDiv.style.display = 'block';
}

// 滚动标签
function scrollTabs(direction) {
    const tabsContainer = document.getElementById('tabs-container');
    const scrollAmount = 150; // 滚动量

    if (direction === 'left') {
        tabsContainer.scrollLeft -= scrollAmount;
    } else {
        tabsContainer.scrollLeft += scrollAmount;
    }

    // 更新滚动按钮状态
    updateScrollButtonsVisibility();
}

// 检查标签是否溢出并更新滚动按钮的可见性
function updateScrollButtonsVisibility() {
    const tabsContainer = document.getElementById('tabs-container');
    const leftButton = document.getElementById('tab-scroll-left');
    const rightButton = document.getElementById('tab-scroll-right');

    // 强制重新计算布局，确保获取准确的滚动宽度
    void tabsContainer.offsetWidth;
    
    // 计算所有标签的总宽度（包括新建标签按钮）
    let totalTabsWidth = 0;
    const tabs = tabsContainer.querySelectorAll('.tab, .new-tab');
    tabs.forEach(tab => {
        totalTabsWidth += tab.offsetWidth;
    });
    
    // 检查是否有水平溢出（更精确的计算）
    const containerWidth = tabsContainer.clientWidth;
    const hasOverflow = totalTabsWidth > containerWidth;
    
    console.log('Total tabs width:', totalTabsWidth, 'Container width:', containerWidth, 'Has overflow:', hasOverflow);
    
    // 只有在有溢出时才显示按钮
    if (hasOverflow) {
        // 左侧按钮仅在有可滚动内容时显示
        leftButton.style.display = tabsContainer.scrollLeft > 0 ? 'block' : 'none';

        // 右侧按钮仅在还有更多内容可滚动时显示
        rightButton.style.display =
            tabsContainer.scrollLeft + containerWidth < tabsContainer.scrollWidth - 1 ? 'block' : 'none';
    } else {
        // 没有溢出，隐藏两个按钮
        leftButton.style.display = 'none';
        rightButton.style.display = 'none';
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function () {
    // 获取后端当前语言设置
    try {
        const langSettings = await window.go.main.App.GetLanguageSettings();
        if (langSettings && langSettings.currentLanguage) {
            currentLanguage = langSettings.currentLanguage;
        }
    } catch (error) {
        console.error("Failed to get backend language:", error);
    }
    
    // 加载默认语言
    loadTranslations(currentLanguage);

    // 初始化第一个标签页
    updateDataPlaceholder('tab-1');
    activateTab('tab-1'); // 确保第一个标签页被激活

    // 设置语言选择器的默认值
    document.getElementById('language-select').value = currentLanguage;

    // 添加标签容器的滚动事件
    const tabsContainer = document.getElementById('tabs-container');
    tabsContainer.addEventListener('wheel', function (event) {
        event.preventDefault();
        tabsContainer.scrollLeft += event.deltaY;
        updateScrollButtonsVisibility();
    });

    // 初始化滚动按钮状态 - 使用setTimeout确保DOM完全渲染
    setTimeout(updateScrollButtonsVisibility, 100);

    // 监听窗口大小变化，更新滚动按钮状态
    window.addEventListener('resize', updateScrollButtonsVisibility);
    
    // 创建一个MutationObserver来监视标签容器的变化
    const tabsObserver = new MutationObserver(updateScrollButtonsVisibility);
    tabsObserver.observe(tabsContainer, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    // 初始化标签页标题双击编辑功能
    document.querySelectorAll('.tab-title').forEach(title => {
        title.addEventListener('dblclick', function (event) {
            const tabId = this.closest('.tab').getAttribute('data-tab-id');
            startRenameTab(event, tabId);
        });
    });
});

// 回车键连接
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && activeTabId) {
        connectProbe(activeTabId);
    }
});