/* ===================================================================
   DocuFlow — Document Intelligence Dashboard
   Core: categorization, formatting, PDF export, history, theme
   =================================================================== */

(() => {
    'use strict';

    /* ========== STATE ========== */
    let selectedCategory = 'auto';
    let history = [];
    let currentResult = null;

    try {
        history = JSON.parse(localStorage.getItem('docuflow-history') || '[]');
    } catch (e) { /* ignore */ }

    /* ========== DOM REFS ========== */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const docInput = $('#docInput');
    const charCount = $('#charCount');
    const processBtn = $('#processBtn');
    const clearBtn = $('#clearBtn');
    const copyBtn = $('#copyBtn');
    const pdfBtn = $('#pdfBtn');
    const backBtn = $('#backBtn');
    const outputContent = $('#outputContent');
    const outputCategory = $('#outputCategory');
    const historyList = $('#historyList');
    const toast = $('#toast');
    const hamburger = $('#hamburger');
    const sidebar = $('#sidebar');
    const themeToggle = $('#themeToggle');
    const mobileThemeToggle = $('#mobileThemeToggle');
    const themeLabel = $('#themeLabel');
    const root = document.documentElement;

    /* ========== THEME ========== */
    const setTheme = (theme) => {
        root.setAttribute('data-theme', theme);
        if (themeLabel) themeLabel.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode';
        try { localStorage.setItem('docuflow-theme', theme); } catch (e) { /* */ }
    };

    const initTheme = () => {
        let saved = null;
        try { saved = localStorage.getItem('docuflow-theme'); } catch (e) { /* */ }
        if (saved === 'light' || saved === 'dark') setTheme(saved);
        else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) setTheme('dark');
        else setTheme('light');
    };

    initTheme();
    themeToggle?.addEventListener('click', () => {
        setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    mobileThemeToggle?.addEventListener('click', () => {
        setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    /* ========== MOBILE NAV ========== */
    hamburger?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== hamburger) {
            sidebar.classList.remove('open');
        }
    });

    /* ========== NAV ========== */
    const views = $$('.view');
    const navItems = $$('.nav-item');

    const switchView = (id) => {
        views.forEach((v) => v.classList.remove('active'));
        navItems.forEach((n) => n.classList.remove('active'));
        const target = $(`#view${id.charAt(0).toUpperCase() + id.slice(1)}`);
        if (target) target.classList.add('active');
        const navItem = $(`.nav-item[data-view="${id}"]`);
        if (navItem) navItem.classList.add('active');
        sidebar.classList.remove('open');
    };

    navItems.forEach((item) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if (view === 'history') renderHistory();
            switchView(view);
        });
    });

    /* ========== CATEGORY SELECTOR ========== */
    $$('.selector-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            $$('.selector-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = btn.getAttribute('data-category');
        });
    });

    /* ========== CHAR COUNT ========== */
    docInput?.addEventListener('input', () => {
        const len = docInput.value.length;
        charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
    });

    /* ========== CATEGORIZATION ENGINE ========== */
    const categorize = (text) => {
        const lower = text.toLowerCase();

        // Email signals
        const emailSignals = [
            /\b(dear|hello|hi)\b.*\b(sir|madam|team|all|everyone)\b/i,
            /\b(from|to|cc|bcc|subject|sent|received)\s*:/i,
            /\b(thank you|regards|sincerely|best|cheers|kindly|please)\b/i,
            /\b(meeting|schedule|agenda|follow.up|deadline|asap|urgent)\b/i,
            /\b@\b/,
            /\bdear\s+(team|all|colleague|manager|sir|madam)/i,
            /\blooking forward|please find|as discussed|for your (review|approval|reference)/i,
        ];

        // Contract signals
        const contractSignals = [
            /\b(agreement|contract|terms and conditions|hereinafter|whereas|thereof)\b/i,
            /\b(clause|section|article|paragraph|sub.?section)\s*\d/i,
            /\b(liability|indemnif|warranty|governing law|jurisdiction)\b/i,
            /\b(shall|hereby|pursuant|notwithstanding|in the event of)\b/i,
            /\b(effective date|termination|confidential|non.disclosure|nda)\b/i,
            /\b(party|parties|signatory|witness|executed on)\b/i,
            /\b(terms of service|privacy policy|user agreement|license agreement)\b/i,
            /\b(annual fee|payment terms|intellectual property|force majeure)\b/i,
        ];

        // Notes signals
        const notesSignals = [
            /\b(meeting notes?|key takeaways?|action items?|minutes of|recap)\b/i,
            /\b(bullet points?|notes|brainstorm|ideas?|todo|to.do)\b/i,
            /^[\s]*[-*•]\s+/m,
            /\b(agenda|discussion|summary|overview|highlights?)\b/i,
            /\b(assigned to|deadline|follow up|next steps?)\b/i,
        ];

        let emailScore = 0, contractScore = 0, notesScore = 0;

        emailSignals.forEach((rx) => { if (rx.test(text)) emailScore++; });
        contractSignals.forEach((rx) => { if (rx.test(text)) contractScore++; });
        notesSignals.forEach((rx) => { if (rx.test(text)) notesScore++; });

        const max = Math.max(emailScore, contractScore, notesScore);
        if (max === 0) return 'notes';
        if (emailScore === max) return 'email';
        if (contractScore === max) return 'contract';
        return 'notes';
    };

    /* ========== METADATA EXTRACTION ========== */
    const extractEmailMeta = (text) => {
        const meta = { sender: '', date: '', urgency: 'Normal' };

        // Sender
        const fromMatch = text.match(/(?:from|from:)\s*(.+)/i);
        if (fromMatch) meta.sender = fromMatch[1].trim().substring(0, 60);

        const dearMatch = text.match(/(?:dear|hello|hi)\s+([^,\n]+)/i);
        if (!meta.sender && dearMatch) meta.sender = dearMatch[1].trim();

        // Date
        const dateMatch = text.match(/(?:date|sent|on)\s*:\s*(.+)/i);
        if (dateMatch) meta.date = dateMatch[1].trim().substring(0, 40);
        else {
            const genericDate = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s*\d{4}/i);
            if (genericDate) meta.date = genericDate[0];
        }

        // Urgency
        if (/\b(urgent|asap|immediately|critical|emergency|time.sensitive)\b/i.test(text)) meta.urgency = 'High';
        else if (/\b(when you can|no rush|at your convenience|low priority)\b/i.test(text)) meta.urgency = 'Low';

        return meta;
    };

    const extractContractMeta = (text) => {
        const meta = { type: 'General Agreement', parties: '', date: '', jurisdiction: '' };

        // Contract type
        if (/\bnon.disclosure|nda\b/i.test(text)) meta.type = 'Non-Disclosure Agreement (NDA)';
        else if (/\blease\b/i.test(text)) meta.type = 'Lease Agreement';
        else if (/\bservice\b.*\bagreement\b/i.test(text)) meta.type = 'Service Agreement';
        else if (/\bsoftware\b.*\b(license|agreement)\b/i.test(text)) meta.type = 'Software License';
        else if (/\bemployment\b.*\b(agreement|contract)\b/i.test(text)) meta.type = 'Employment Contract';
        else if (/\bterms of (service|use)\b/i.test(text)) meta.type = 'Terms of Service';
        else if (/\bprivacy policy\b/i.test(text)) meta.type = 'Privacy Policy';

        // Parties
        const partyMatch = text.match(/(?:between|by and between|entered into by)\s+(.+?)(?:\n|\.|,)/i);
        if (partyMatch) meta.parties = partyMatch[1].trim().substring(0, 80);

        // Date
        const dateMatch = text.match(/(?:effective (?:date|as of)|dated?|executed on)\s*[:=]?\s*(.+)/i);
        if (dateMatch) meta.date = dateMatch[1].trim().substring(0, 40);

        // Jurisdiction
        const jurMatch = text.match(/(?:governing law|jurisdiction|venue)\s*(?:of|shall be)\s+(.+?)(?:\.|\n)/i);
        if (jurMatch) meta.jurisdiction = jurMatch[1].trim().substring(0, 60);

        return meta;
    };

    /* ========== TEXT ANALYSIS ========== */
    const extractKeyPoints = (text, category) => {
        const sentences = text.replace(/\n+/g, '. ').split(/\./).filter((s) => s.trim().length > 15);
        const points = [];

        if (category === 'email') {
            sentences.forEach((s) => {
                const t = s.trim();
                if (/\b(request|action|please|need|require|schedule|meeting|deadline|confirm|review|approve|send|provide|update)\b/i.test(t) && t.length < 200) {
                    points.push(t);
                }
            });
            if (points.length === 0) {
                sentences.slice(0, 4).forEach((s) => { if (s.trim().length > 15) points.push(s.trim()); });
            }
        } else if (category === 'contract') {
            sentences.forEach((s) => {
                const t = s.trim();
                if (/\b(shall|must|required|liable|indemn|terminat|confidential|payment|fee|warranty|breach|remedy)\b/i.test(t) && t.length < 250) {
                    points.push(t);
                }
            });
            if (points.length === 0) {
                sentences.slice(0, 4).forEach((s) => { if (s.trim().length > 15) points.push(s.trim()); });
            }
        } else {
            sentences.forEach((s) => {
                const t = s.trim();
                if (/\b(important|key|note|action|todo|follow|next|assigned|deadline|decided|agreed|discussed)\b/i.test(t) && t.length < 200) {
                    points.push(t);
                }
            });
            if (points.length === 0) {
                sentences.slice(0, 3).forEach((s) => { if (s.trim().length > 15) points.push(s.trim()); });
            }
        }

        return points.slice(0, 5);
    };

    const generateSummary = (text, category) => {
        const sentences = text.replace(/\n+/g, ' ').split(/\./).filter((s) => s.trim().length > 20);
        const maxLen = category === 'notes' ? 120 : 250;
        if (sentences.length > 0) {
            return sentences[0].trim().substring(0, maxLen) + (sentences[0].trim().length > maxLen ? '...' : '.');
        }
        return text.substring(0, maxLen) + (text.length > maxLen ? '...' : '');
    };

    /* ========== FORMAT OUTPUT ========== */
    const formatOutput = (text, category) => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        let emoji, title, badgeClass;

        if (category === 'email') {
            emoji = '\u2709\uFE0F';
            title = 'Email Insights';
            badgeClass = 'email';
        } else if (category === 'contract') {
            emoji = '\u2696\uFE0F';
            title = 'Contract Analysis';
            badgeClass = 'contract';
        } else {
            emoji = '\u270D\uFE0F';
            title = 'Notebook Summary';
            badgeClass = 'notes';
        }

        let html = '';

        // Header
        html += `<div class="output-header">`;
        html += `<div class="output-header-left">`;
        html += `<div><span class="doc-category-badge ${badgeClass}">${category.toUpperCase()}</span></div>`;
        html += `<div class="output-emoji">${emoji}</div>`;
        html += `<h2 class="output-title">${title}</h2>`;
        html += `<div class="output-meta">`;
        html += `<span class="meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> ${timeStr}</span>`;
        html += `<span class="meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> ${dateStr}</span>`;
        html += `<span class="meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> ${text.length.toLocaleString()} chars</span>`;
        html += `</div></div></div>`;

        html += `<div class="output-divider"></div>`;

        // Body
        html += `<div class="output-body">`;

        if (category === 'email') {
            const meta = extractEmailMeta(text);
            html += `<h3>\uD83D\uDCE7 Key Metadata</h3>`;
            html += `<div class="highlight-box">`;
            html += `<strong>From:</strong> ${meta.sender || 'Not detected'}<br>`;
            html += `<strong>Date:</strong> ${meta.date || 'Not specified'}<br>`;
            html += `<strong>Urgency:</strong> ${meta.urgency}`;
            html += `</div>`;

            html += `<h3>Core Summary</h3>`;
            html += `<p>${generateSummary(text, category)}</p>`;

            const points = extractKeyPoints(text, category);
            if (points.length > 0) {
                html += `<h3>Key Takeaways</h3><ul>`;
                points.forEach((p) => { html += `<li>${escapeHtml(p)}</li>`; });
                html += `</ul>`;
            }

        } else if (category === 'contract') {
            const meta = extractContractMeta(text);
            html += `<h3>\u2696\uFE0F Contract Analysis</h3>`;
            html += `<div class="highlight-box">`;
            html += `<strong>Contract Type:</strong> ${meta.type}<br>`;
            html += `<strong>Parties:</strong> ${meta.parties || 'Not specified'}<br>`;
            html += `<strong>Effective Date:</strong> ${meta.date || 'Not specified'}<br>`;
            if (meta.jurisdiction) html += `<strong>Governing Law:</strong> ${meta.jurisdiction}`;
            html += `</div>`;

            html += `<h3>Critical Clauses & Important Points</h3>`;
            const points = extractKeyPoints(text, category);
            if (points.length > 0) {
                html += `<ul>`;
                points.forEach((p) => { html += `<li>${escapeHtml(p)}</li>`; });
                html += `</ul>`;
            } else {
                html += `<p>${generateSummary(text, category)}</p>`;
            }

        } else {
            html += `<h3>\u270D\uFE0F Notebook Summary</h3>`;
            html += `<p>${generateSummary(text, category)}</p>`;

            const points = extractKeyPoints(text, category);
            if (points.length > 0) {
                html += `<h3>Key Points</h3>`;
                points.forEach((p) => { html += `<p>${escapeHtml(p)}</p>`; });
            }

            const hasList = /^[\s]*[-*•]\s+/m.test(text);
            if (hasList) {
                const listItems = text.split('\n').filter((l) => /^[\s]*[-*•]\s+/.test(l));
                if (listItems.length > 0) {
                    html += `<h3>Extracted Items</h3>`;
                    const itemsText = listItems.map((item) => escapeHtml(item.replace(/^[\s]*[-*•]\s+/, ''))).join('. ');
                    html += `<p>${itemsText}.</p>`;
                }
            }
        }

        html += `</div>`;

        // Footer
        html += `<div class="output-footer">`;
        html += `<span style="font-size:12px;color:var(--text-muted);">Processed by DocuFlow Intelligence</span>`;
        html += `<div class="output-actions">`;
        html += `<button class="btn btn-secondary" onclick="docuflowCopy()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg> Copy</button>`;
        html += `<button class="btn btn-primary" onclick="docuflowPDF()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> PDF</button>`;
        html += `</div></div>`;

        return html;
    };

    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /* ========== PROCESS DOCUMENT ========== */
    const processDocument = () => {
        const text = docInput.value.trim();
        if (!text) {
            showToast('\u26A0\uFE0F', 'Please paste some text to process');
            return;
        }

        const category = selectedCategory === 'auto' ? categorize(text) : selectedCategory;
        currentResult = { text, category, time: new Date().toISOString() };

        outputCategory.textContent = `Auto-detected as: ${category.charAt(0).toUpperCase() + category.slice(1)} \u2022 ${text.length.toLocaleString()} characters`;
        outputContent.innerHTML = formatOutput(text, category);

        // Save to history
        history.unshift({
            category,
            preview: text.substring(0, 80).replace(/\n/g, ' '),
            time: currentResult.time,
            text: text.substring(0, 2000),
        });
        if (history.length > 20) history = history.slice(0, 20);
        try { localStorage.setItem('docuflow-history', JSON.stringify(history)); } catch (e) { /* */ }

        updateStats();
        switchView('output');
        showToast('\u2705', `Document processed as ${category}`);
    };

    processBtn?.addEventListener('click', processDocument);
    clearBtn?.addEventListener('click', () => {
        docInput.value = '';
        charCount.textContent = '0 characters';
        docInput.focus();
    });

    /* ========== BACK BUTTON ========== */
    backBtn?.addEventListener('click', () => {
        switchView('input');
    });

    /* ========== COPY ========== */
    const copyToClipboard = () => {
        if (!currentResult) return;
        const text = outputContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            showToast('\uD83D\uDCCB', 'Copied to clipboard');
        }).catch(() => {
            showToast('\u274C', 'Failed to copy');
        });
    };

    copyBtn?.addEventListener('click', copyToClipboard);
    window.docuflowCopy = copyToClipboard;

    /* ========== PDF EXPORT ========== */
    const exportPDF = () => {
        if (!currentResult) return;

        const printWindow = window.open('', '_blank');
        const theme = root.getAttribute('data-theme') || 'light';

        const bgPrimary = theme === 'dark' ? '#1A1714' : '#FAF7F2';
        const bgCard = theme === 'dark' ? '#262220' : '#FFFFFF';
        const textPrimary = theme === 'dark' ? '#F5F0E8' : '#2D2A26';
        const textSecondary = theme === 'dark' ? '#B5ADA3' : '#6B6560';
        const accent = theme === 'dark' ? '#C9A96E' : '#C87941';
        const border = theme === 'dark' ? '#332F2A' : '#E8E1D8';

        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>DocuFlow Report</title>
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: ${bgPrimary}; color: ${textPrimary}; padding: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid ${border}; }
        .header h1 { font-family: 'DM Serif Display', serif; font-size: 32px; margin-bottom: 4px; }
        .header p { color: ${textSecondary}; font-size: 13px; }
        .badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; background: ${accent}20; color: ${accent}; margin-bottom: 12px; }
        .card { background: ${bgCard}; border: 1px solid ${border}; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
        h2 { font-family: 'DM Serif Display', serif; font-size: 22px; margin-bottom: 12px; border-bottom: 1px solid ${border}; padding-bottom: 8px; }
        p, li { color: ${textSecondary}; font-size: 14px; line-height: 1.7; }
        ul, ol { padding-left: 20px; margin-bottom: 12px; }
        li { margin-bottom: 6px; }
        .meta { background: ${accent}12; border-left: 3px solid ${accent}; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 12px 0; font-size: 13px; }
        .meta strong { color: ${accent}; }
        .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid ${border}; font-size: 11px; color: ${textSecondary}; }
    </style>
</head>
<body>
    <div class="header">
        <span class="badge">${currentResult.category.toUpperCase()}</span>
        <h1>${currentResult.category === 'email' ? '\u2709\uFE0F Email Insights' : currentResult.category === 'contract' ? '\u2696\uFE0F Contract Analysis' : '\u270D\uFE0F Notebook Summary'}</h1>
        <p>Generated by DocuFlow \u2022 ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>
    ${outputContent.innerHTML}
    <div class="footer">DocuFlow Document Intelligence Dashboard</div>
</body>
</html>
        `);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 800);

        showToast('\uD83D\uDCC4', 'PDF export ready');
    };

    pdfBtn?.addEventListener('click', exportPDF);
    window.docuflowPDF = exportPDF;

    /* ========== HISTORY ========== */
    const renderHistory = () => {
        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    <p>No documents processed yet</p>
                    <span>Paste your first document to get started</span>
                </div>`;
            return;
        }

        historyList.innerHTML = history.map((item, i) => {
            const icon = item.category === 'email' ? '\u2709\uFE0F' : item.category === 'contract' ? '\uD83D\uDCC4' : '\uD83D\uDCDD';
            const time = new Date(item.time);
            const timeAgo = getTimeAgo(time);

            return `
                <div class="history-item" data-index="${i}">
                    <div class="history-icon ${item.category}">${icon}</div>
                    <div class="history-info">
                        <div class="history-name">${escapeHtml(item.preview)}</div>
                        <div class="history-detail">${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</div>
                    </div>
                    <span class="history-time">${timeAgo}</span>
                </div>`;
        }).join('');

        historyList.querySelectorAll('.history-item').forEach((el) => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-index'));
                const item = history[idx];
                if (item) {
                    docInput.value = item.text;
                    charCount.textContent = `${item.text.length.toLocaleString()} characters`;
                    selectedCategory = item.category;
                    $$('.selector-btn').forEach((b) => b.classList.remove('active'));
                    const matchBtn = $(`.selector-btn[data-category="${item.category}"]`);
                    if (matchBtn) matchBtn.classList.add('active');
                    else $(`.selector-btn[data-category="auto"]`).classList.add('active');
                    switchView('input');
                }
            });
        });
    };

    const getTimeAgo = (date) => {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    /* ========== STATS ========== */
    const updateStats = () => {
        const total = history.length;
        const emails = history.filter((h) => h.category === 'email').length;
        const contracts = history.filter((h) => h.category === 'contract').length;
        const notes = history.filter((h) => h.category === 'notes').length;

        $('#totalDocs').textContent = total;
        $('#totalEmails').textContent = emails;
        $('#totalContracts').textContent = contracts;
        $('#totalNotes').textContent = notes;
    };

    updateStats();

    /* ========== TOAST ========== */
    const showToast = (icon, message) => {
        toast.querySelector('.toast-icon').textContent = icon;
        toast.querySelector('.toast-text').textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    };

    /* ========== KEYBOARD SHORTCUTS ========== */
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter to process
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            processDocument();
        }
        // Escape to go back
        if (e.key === 'Escape') {
            const activeView = $('.view.active');
            if (activeView && activeView.id !== 'viewInput') {
                switchView('input');
            }
        }
    });

    /* ========== PASTE HANDLER ========== */
    docInput?.addEventListener('paste', () => {
        setTimeout(() => {
            const len = docInput.value.length;
            charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
            if (len > 50) {
                showToast('\uD83D\uDCCB', 'Text pasted! Click Process to continue.');
            }
        }, 100);
    });

    /* ========== FILE UPLOAD & TEXT EXTRACTION ========== */
    const dropzone = $('#dropzone');
    const dropzoneInput = $('#dropzoneInput');
    const fileInfo = $('#fileInfo');
    const fileName = $('#fileName');
    const fileSize = $('#fileSize');
    const fileRemove = $('#fileRemove');
    const fileInput = $('#fileInput');

    // Initialize PDF.js worker
    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const showFileInfo = (name, size) => {
        fileName.textContent = name;
        fileSize.textContent = formatBytes(size);
        fileInfo.style.display = 'flex';
    };

    const hideFileInfo = () => {
        fileInfo.style.display = 'none';
        fileName.textContent = '';
        fileSize.textContent = '';
    };

    const setDropzoneState = (state) => {
        dropzone.classList.remove('dragover', 'processing');
        if (state === 'dragover') dropzone.classList.add('dragover');
        if (state === 'processing') dropzone.classList.add('processing');
    };

    const extractTextFromFile = async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();

        setDropzoneState('processing');
        showFileInfo(file.name, file.size);

        try {
            let text = '';

            if (ext === 'pdf') {
                text = await extractPDF(file);
            } else if (ext === 'docx' || ext === 'doc') {
                text = await extractDOCX(file);
            } else if (['txt', 'rtf', 'md', 'csv'].includes(ext)) {
                text = await extractTXT(file);
            } else {
                showToast('\u274C', `Unsupported file type: .${ext}`);
                setDropzoneState('');
                hideFileInfo();
                return;
            }

            if (text && text.trim().length > 0) {
                docInput.value = text.trim();
                const len = text.trim().length;
                charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
                showToast('\u2705', `Extracted ${len.toLocaleString()} characters from ${file.name}`);
            } else {
                showToast('\u26A0\uFE0F', 'No text could be extracted from this file');
                hideFileInfo();
            }
        } catch (err) {
            console.error('File extraction error:', err);
            showToast('\u274C', `Failed to read ${file.name}`);
            hideFileInfo();
        }

        setDropzoneState('');
    };

    /* --- PDF Extraction --- */
    const extractPDF = async (file) => {
        if (!window.pdfjsLib) {
            showToast('\u26A0\uFE0F', 'PDF library not loaded. Please try again.');
            return '';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const textParts = [];

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(' ');
            if (pageText.trim()) textParts.push(pageText);
        }

        return textParts.join('\n\n');
    };

    /* --- DOCX Extraction --- */
    const extractDOCX = async (file) => {
        if (!window.mammoth) {
            showToast('\u26A0\uFE0F', 'DOCX library not loaded. Please try again.');
            return '';
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value || '';
    };

    /* --- Plain text extraction --- */
    const extractTXT = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    };

    /* --- Dropzone events --- */
    dropzone?.addEventListener('click', () => {
        dropzoneInput.click();
    });

    dropzoneInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) extractTextFromFile(file);
        dropzoneInput.value = '';
    });

    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropzoneState('dragover');
    });

    dropzone?.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropzoneState('');
    });

    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropzoneState('');
        const file = e.dataTransfer.files[0];
        if (file) extractTextFromFile(file);
    });

    // Also support drag & drop on the entire editor area
    const editorWrapper = document.querySelector('.editor-wrapper');
    editorWrapper?.addEventListener('dragover', (e) => {
        e.preventDefault();
        setDropzoneState('dragover');
    });

    editorWrapper?.addEventListener('dragleave', (e) => {
        if (!editorWrapper.contains(e.relatedTarget)) {
            setDropzoneState('');
        }
    });

    editorWrapper?.addEventListener('drop', (e) => {
        e.preventDefault();
        setDropzoneState('');
        const file = e.dataTransfer.files[0];
        if (file) extractTextFromFile(file);
    });

    /* --- Remove file --- */
    fileRemove?.addEventListener('click', () => {
        docInput.value = '';
        charCount.textContent = '0 characters';
        hideFileInfo();
        showToast('\uD83D\uDCC1', 'File removed');
    });

    /* ========== LOGIN CHECK & USER INFO ========== */
    const userInfo = document.getElementById('userInfo');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const logoutBtn = document.getElementById('logoutBtn');

    const loadUser = () => {
        try {
            const user = JSON.parse(localStorage.getItem('docuflow-user'));
            if (user && user.email) {
                // Show user info in sidebar
                if (userInfo) userInfo.style.display = 'flex';
                if (userName) userName.textContent = user.name || user.email.split('@')[0];
                if (userEmail) userEmail.textContent = user.email;
                if (userAvatar) {
                    const initials = (user.name || user.email)
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase();
                    userAvatar.textContent = initials;
                }
                return true;
            }
        } catch (e) { /* */ }
        return false;
    };

    const isLoggedIn = loadUser();

    // Redirect to login if not authenticated
    if (!isLoggedIn) {
        // Allow access without login (soft protection)
        // Uncomment the line below to enforce login:
        // window.location.href = 'login.html';
    }

    // Logout
    logoutBtn?.addEventListener('click', () => {
        try {
            localStorage.removeItem('docuflow-user');
        } catch (e) { /* */ }
        showToast('\uD83D\uDC4B', 'Signed out');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 800);
    });

})();
