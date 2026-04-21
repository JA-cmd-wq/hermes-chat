// app.js - Hermes Agent Chat UI Logic

// ==========================================
// 全局状态管理
// ==========================================
const state = {
    messages: [],          // { role: 'user'|'assistant'|'error', content: '', timestamp: Date }
    isStreaming: false,    // 是否正在接收流式响应
    abortController: null, // 用于停止生成
    sessionId: null,       // X-Hermes-Session-Id
    isConnected: false,    // 连接状态
};

// 配置（从 localStorage 读取）
const config = {
    apiUrl: localStorage.getItem('hermes_api_url') || '',
    apiKey: localStorage.getItem('hermes_api_key') || 'hermes-orangepi-2026',
    systemPrompt: localStorage.getItem('hermes_system_prompt') || '你是 Hermes Agent，一个强大的 AI 助手。请用中文回答。',
};

// DOM 元素引用
const els = {
    messagesContainer: document.getElementById('messagesContainer'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsDrawer: document.getElementById('settingsDrawer'),
    statusIndicator: document.getElementById('statusIndicator'),
    apiUrl: document.getElementById('apiUrl'),
    apiKey: document.getElementById('apiKey'),
    systemPrompt: document.getElementById('systemPrompt'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    testConnBtn: document.getElementById('testConnBtn'),
    testConnStatus: document.getElementById('testConnStatus'),
    togglePasswordBtn: document.getElementById('togglePasswordBtn'),
    clearBtn: document.getElementById('clearBtn'),
    footerNote: document.querySelector('.footer-note'),
    quickApiInput: document.getElementById('quick-api-input'),
    quickConnectBtn: document.getElementById('quickConnectBtn')
};

// ==========================================
// 初始化与事件绑定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    init();
    bindEvents();
});

function init() {
    // 检查 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    let configChanged = false;
    
    if (urlParams.has('api')) {
        config.apiUrl = urlParams.get('api');
        localStorage.setItem('hermes_api_url', config.apiUrl);
        configChanged = true;
    }
    if (urlParams.has('key')) {
        config.apiKey = urlParams.get('key');
        localStorage.setItem('hermes_api_key', config.apiKey);
        configChanged = true;
    }

    // 读取后清除 URL 参数（隐藏密钥）
    if (configChanged) {
        window.history.replaceState({}, '', window.location.pathname);
    }

    // 填充设置表单
    els.apiUrl.value = config.apiUrl;
    els.apiKey.value = config.apiKey;
    els.systemPrompt.value = config.systemPrompt;

    if (config.apiUrl) {
        testConnection(config.apiUrl, config.apiKey, false);
    } else {
        updateStatusIndicator('disconnected');
        // 首次打开（从未配置过 API 地址），自动弹出设置
        if (!localStorage.getItem('hermes_api_url')) {
            setTimeout(() => openSettings(), 300);
        }
    }

    renderWelcome();
}

function bindEvents() {
    // 自动高度 Textarea
    els.userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        els.sendBtn.disabled = this.value.trim().length === 0;
    });

    els.userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!els.sendBtn.disabled && !state.isStreaming) {
                handleSend();
            }
        }
    });

    // 按钮事件
    els.sendBtn.addEventListener('click', () => {
        if (state.isStreaming) {
            stopGeneration();
        } else {
            handleSend();
        }
    });
    
    els.clearBtn.addEventListener('click', clearChat);

    // 状态灯点击 → 打开设置
    els.statusIndicator.addEventListener('click', openSettings);
    els.statusIndicator.style.cursor = 'pointer';

    // 欢迎页快捷连接
    if (els.quickConnectBtn) {
        els.quickConnectBtn.addEventListener('click', quickConnect);
    }
    if (els.quickApiInput) {
        els.quickApiInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') quickConnect();
        });
    }

    // 设置抽屉
    els.settingsBtn.addEventListener('click', openSettings);
    els.closeSettingsBtn.addEventListener('click', closeSettings);
    els.settingsOverlay.addEventListener('click', closeSettings);
    
    els.saveSettingsBtn.addEventListener('click', saveSettings);
    els.testConnBtn.addEventListener('click', () => {
        testConnection(els.apiUrl.value.trim(), els.apiKey.value.trim(), true);
    });

    // 密码显隐
    els.togglePasswordBtn.addEventListener('click', () => {
        const type = els.apiKey.getAttribute('type') === 'password' ? 'text' : 'password';
        els.apiKey.setAttribute('type', type);
        const icon = type === 'password' 
            ? '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        els.togglePasswordBtn.innerHTML = icon;
    });
}

// ==========================================
// 核心逻辑：发送与流式解析
// ==========================================
async function handleSend() {
    const text = els.userInput.value.trim();
    if (!text) return;

    if (!config.apiUrl) {
        openSettings();
        alert('请先配置 API 地址');
        return;
    }

    // 隐藏欢迎屏
    if (els.welcomeScreen) {
        els.welcomeScreen.style.display = 'none';
    }

    // 添加用户消息
    addMessage('user', text);
    
    // 清空输入框
    els.userInput.value = '';
    els.userInput.style.height = 'auto';
    els.sendBtn.disabled = true;

    // 准备发送
    state.abortController = new AbortController();
    state.isStreaming = true;
    updateSendButton();

    // 显示助手气泡（带等待动画）
    const loadingId = addLoadingBubble();
    scrollToBottom();

    // 构建消息数组
    const messages = [];
    if (config.systemPrompt) {
        messages.push({ role: 'system', content: config.systemPrompt });
    }
    state.messages.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content });
        }
    });

    let assistantContent = '';
    let hasError = false;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        if (state.sessionId) headers['X-Hermes-Session-Id'] = state.sessionId;

        // 注意：API 路径默认为 /v1/chat/completions，如果用户没有填，则补齐
        let endpoint = config.apiUrl;
        if (!endpoint.endsWith('/v1/chat/completions')) {
            endpoint = endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: 'hermes-agent',
                messages,
                stream: true,
            }),
            signal: state.abortController.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
        }

        // 保存 session ID
        const newSessionId = response.headers.get('X-Hermes-Session-Id');
        if (newSessionId) state.sessionId = newSessionId;

        updateStatusIndicator('connected');

        // 逐块读取 SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        removeLoadingBubble(loadingId);
        const bubbleId = createAssistantBubble();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整行

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue;
                if (!trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        assistantContent += delta;
                        updateAssistantBubble(bubbleId, assistantContent, true);
                        scrollToBottom(false);
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
        
        // 最终定稿
        updateAssistantBubble(bubbleId, assistantContent, false);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            // 用户主动停止
            if(assistantContent) {
                 updateAssistantBubble(loadingId, assistantContent, false); // loadingId 即已被替换的 bubbleId 占位符引用问题规避
            } else {
                 removeLoadingBubble(loadingId);
            }
        } else {
            hasError = true;
            removeLoadingBubble(loadingId);
            addMessage('error', `连接失败: ${error.message}`);
            updateStatusIndicator('error');
        }
    } finally {
        state.isStreaming = false;
        state.abortController = null;
        if (assistantContent && !hasError) {
            state.messages.push({ role: 'assistant', content: assistantContent, timestamp: new Date() });
        }
        updateSendButton();
        els.userInput.focus();
        scrollToBottom(true);
    }
}

function stopGeneration() {
    if (state.abortController) {
        state.abortController.abort();
    }
}

// ==========================================
// UI 更新与渲染
// ==========================================

function updateSendButton() {
    if (state.isStreaming) {
        els.sendBtn.className = 'stop-btn';
        els.sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>';
        els.sendBtn.disabled = false;
        els.sendBtn.title = "停止生成";
    } else {
        els.sendBtn.className = 'send-btn';
        els.sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        els.sendBtn.disabled = els.userInput.value.trim().length === 0;
        els.sendBtn.title = "发送";
    }
}

function addMessage(role, content) {
    const msg = { role, content, timestamp: new Date() };
    if(role !== 'error') {
        state.messages.push(msg);
    }
    
    const div = document.createElement('div');
    div.className = `message ${role}`;
    
    const timeStr = formatTime(msg.timestamp);
    
    if (role === 'user') {
        div.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">${escapeHTML(content)}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        `;
    } else if (role === 'error') {
        div.innerHTML = `
            <div class="message-bubble">
                <div class="message-content" style="color:var(--color-error)">${escapeHTML(content)}</div>
            </div>
        `;
    }
    
    els.messagesContainer.appendChild(div);
    scrollToBottom(true);
}

function addLoadingBubble() {
    const id = 'bubble-' + Date.now();
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = id;
    div.innerHTML = `
        <div class="message-bubble">
            <div class="assistant-icon"><svg viewBox="0 0 32 32" width="16" height="16"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="4" x2="16" y2="28" /><path d="M16 8 C12 6, 6 6, 4 10 C6 11, 10 10, 16 11" /><path d="M16 8 C20 6, 26 6, 28 10 C26 11, 22 10, 16 11" /><path d="M12 12 C16 10, 20 14, 16 16 C12 18, 12 22, 16 24" /><path d="M20 12 C16 10, 12 14, 16 16 C20 18, 20 22, 16 24" /></g></svg></div>
            <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
    `;
    els.messagesContainer.appendChild(div);
    return id;
}

function removeLoadingBubble(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function createAssistantBubble() {
    const id = 'bubble-' + Date.now();
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = id;
    div.innerHTML = `
        <div class="message-bubble">
            <div class="assistant-icon"><svg viewBox="0 0 32 32" width="16" height="16"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="4" x2="16" y2="28" /><path d="M16 8 C12 6, 6 6, 4 10 C6 11, 10 10, 16 11" /><path d="M16 8 C20 6, 26 6, 28 10 C26 11, 22 10, 16 11" /><path d="M12 12 C16 10, 20 14, 16 16 C12 18, 12 22, 16 24" /><path d="M20 12 C16 10, 12 14, 16 16 C20 18, 20 22, 16 24" /></g></svg></div>
            <div class="message-content assistant-content markdown-body"></div>
            <div class="message-time" style="display:none;"></div>
        </div>
    `;
    els.messagesContainer.appendChild(div);
    return id;
}

function updateAssistantBubble(id, content, isStreaming) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const contentEl = el.querySelector('.message-content');
    const timeEl = el.querySelector('.message-time');
    
    contentEl.innerHTML = renderMarkdown(content) + (isStreaming ? '<span class="streaming-cursor">▎</span>' : '');
    
    if (!isStreaming) {
        timeEl.textContent = formatTime(new Date());
        timeEl.style.display = 'block';
    }
}

function renderWelcome() {
    if (state.messages.length === 0) {
        els.welcomeScreen.style.display = 'flex';
    } else {
        els.welcomeScreen.style.display = 'none';
    }
}

function clearChat() {
    if(confirm("确定要清空当前对话吗？")) {
        state.messages = [];
        state.sessionId = null;
        els.messagesContainer.innerHTML = '';
        els.messagesContainer.appendChild(els.welcomeScreen);
        renderWelcome();
    }
}

// ==========================================
// 设置与辅助功能
// ==========================================
function openSettings() {
    els.settingsOverlay.classList.add('open');
    els.settingsDrawer.classList.add('open');
}

function closeSettings() {
    els.settingsOverlay.classList.remove('open');
    els.settingsDrawer.classList.remove('open');
}

function saveSettings() {
    const url = els.apiUrl.value.trim();
    const key = els.apiKey.value.trim();
    const prompt = els.systemPrompt.value.trim();
    
    config.apiUrl = url;
    config.apiKey = key;
    config.systemPrompt = prompt;
    
    localStorage.setItem('hermes_api_url', url);
    localStorage.setItem('hermes_api_key', key);
    localStorage.setItem('hermes_system_prompt', prompt);
    
    closeSettings();
    if(url) {
        testConnection(url, key, false);
    }
}

async function testConnection(url, key, showUI) {
    if (!url) return;
    
    if (showUI) {
        els.testConnStatus.textContent = '测试中...';
        els.testConnStatus.className = 'test-status';
    }
    updateStatusIndicator('connecting');
    
    try {
        let endpoint = url.replace(/\/+$/, '');
        // 尝试访问 /v1/models 或 health check，这里以访问 /v1/models 为例作为测试
        const res = await fetch(`${endpoint}/v1/models`, {
            method: 'GET',
            headers: key ? { 'Authorization': `Bearer ${key}` } : {}
        });
        
        if (res.ok) {
            if (showUI) {
                els.testConnStatus.textContent = '● 已连接';
                els.testConnStatus.className = 'test-status success';
            }
            updateStatusIndicator('connected');
        } else {
            throw new Error(`Status: ${res.status}`);
        }
    } catch (e) {
        if (showUI) {
            els.testConnStatus.textContent = `❌ ${e.message}`;
            els.testConnStatus.className = 'test-status error';
        }
        updateStatusIndicator('error');
    }
}

function updateStatusIndicator(status) {
    els.statusIndicator.className = 'status-dot ' + status;
    let titles = {
        'disconnected': '未配置（点击设置）',
        'connecting': '连接中...',
        'connected': '已连接',
        'error': '连接失败（点击设置）'
    };
    els.statusIndicator.title = titles[status] || '';
    state.isConnected = (status === 'connected');

    // 同步更新底部信息
    updateFooterNote();
}

function updateFooterNote() {
    if (!els.footerNote) return;
    if (state.isConnected && config.apiUrl) {
        const short = truncateUrl(config.apiUrl, 30);
        els.footerNote.textContent = `Hermes Agent · 已连接 ${short}`;
    } else {
        els.footerNote.textContent = 'Hermes Agent · 未连接';
    }
}

function truncateUrl(url, maxLen) {
    try {
        const u = new URL(url);
        let host = u.hostname;
        if (host.length > maxLen) {
            return host.slice(0, 12) + '...' + host.slice(-18);
        }
        return host;
    } catch {
        return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
    }
}

// 欢迎页快捷连接
function quickConnect() {
    const input = els.quickApiInput;
    if (!input) return;
    const url = input.value.trim();
    if (!url) { input.focus(); return; }

    config.apiUrl = url;
    localStorage.setItem('hermes_api_url', url);

    // 确保密钥已保存
    if (!localStorage.getItem('hermes_api_key')) {
        localStorage.setItem('hermes_api_key', config.apiKey);
    }

    // 填充设置表单
    els.apiUrl.value = url;

    // 隐藏欢迎页，聚焦聊天输入
    if (els.welcomeScreen) els.welcomeScreen.style.display = 'none';
    els.userInput.focus();

    // 测试连接
    testConnection(url, config.apiKey, false);
}
// 暴露给 HTML onclick
window.quickConnect = quickConnect;

// Markdown 解析配置
function renderMarkdown(content) {
    if (typeof marked === 'undefined') return escapeHTML(content);
    
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
            if (typeof hljs !== 'undefined') {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            }
            return escapeHTML(code);
        }
    });

    let html = marked.parse(content);

    // 为 <pre><code> 注入 header
    html = html.replace(
        /<pre><code class="language-(\w+)">/g,
        '<pre><div class="code-header"><span class="code-lang">$1</span><button class="copy-btn" onclick="copyCode(this)">复制</button></div><code class="language-$1">'
    );
    html = html.replace(
        /<pre><code>(?!<div)/g,
        '<pre><div class="code-header"><span class="code-lang">code</span><button class="copy-btn" onclick="copyCode(this)">复制</button></div><code>'
    );

    return html;
}

// 暴露给全局以供 onclick 使用
window.copyCode = function(btn) {
    const codeEl = btn.closest('pre').querySelector('code');
    if (!codeEl) return;
    const code = codeEl.textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '复制';
            btn.classList.remove('copied');
        }, 2000);
    });
};

function scrollToBottom(force = false) {
    const container = els.messagesContainer;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    if (force || distanceToBottom < 150) {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: force ? 'auto' : 'smooth'
        });
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}
