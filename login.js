/* ===================================================================
   DocuFlow — Login / Signup JavaScript
   Features: Form validation, password strength, Google Sheets API
   =================================================================== */

(() => {
    'use strict';

    /* ==========================================================
       CONFIGURATION — Paste your Google Apps Script Web App URL here
       ========================================================== */
    const GOOGLE_SHEET_API = 'https://script.google.com/macros/s/AKfycbxTNI4vN6gtB3R5BTkzHfeVN6Fc4Kl9tT3VPmKk2Jlx_5Awbzkq9T8s3LYE2Sf_3n8/exec';

    /* ==========================================================
       THEME
       ========================================================== */
    const root = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');

    const setTheme = (theme) => {
        root.setAttribute('data-theme', theme);
        try { localStorage.setItem('docuflow-theme', theme); } catch (e) { /* */ }
    };

    (() => {
        let saved = null;
        try { saved = localStorage.getItem('docuflow-theme'); } catch (e) { /* */ }
        if (saved === 'light' || saved === 'dark') setTheme(saved);
        else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) setTheme('dark');
        else setTheme('light');
    })();

    themeToggle?.addEventListener('click', () => {
        setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    /* ==========================================================
       DOM REFS
       ========================================================== */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const loginPanel = $('#loginPanel');
    const signupPanel = $('#signupPanel');
    const showSignup = $('#showSignup');
    const showLogin = $('#showLogin');
    const loginForm = $('#loginForm');
    const signupForm = $('#signupForm');
    const toast = $('#toast');

    /* ==========================================================
       PANEL SWITCHING
       ========================================================== */
    showSignup?.addEventListener('click', (e) => {
        e.preventDefault();
        loginPanel.classList.remove('active');
        signupPanel.classList.add('active');
        clearErrors();
    });

    showLogin?.addEventListener('click', (e) => {
        e.preventDefault();
        signupPanel.classList.remove('active');
        loginPanel.classList.add('active');
        clearErrors();
    });

    const clearErrors = () => {
        $$('.error-msg').forEach((el) => { el.textContent = ''; });
        $$('.input-wrapper input').forEach((el) => { el.classList.remove('error'); });
    };

    /* ==========================================================
       PASSWORD TOGGLE
       ========================================================== */
    $$('.toggle-pass').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = $('#' + btn.dataset.target);
            if (!target) return;
            const isPassword = target.type === 'password';
            target.type = isPassword ? 'text' : 'password';
            btn.classList.toggle('active', isPassword);
        });
    });

    /* ==========================================================
       PASSWORD STRENGTH
       ========================================================== */
    const signupPassword = $('#signupPassword');
    const strengthFill = $('#strengthFill');
    const strengthText = $('#strengthText');
    const passwordStrength = $('#passwordStrength');

    const getStrength = (pass) => {
        let score = 0;
        if (pass.length >= 6) score++;
        if (pass.length >= 10) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;
        return score;
    };

    signupPassword?.addEventListener('input', () => {
        const val = signupPassword.value;
        if (val.length === 0) {
            passwordStrength.classList.remove('visible');
            return;
        }

        passwordStrength.classList.add('visible');
        const score = getStrength(val);
        const levels = [
            { width: '10%', color: '#DC2626', text: 'Very Weak' },
            { width: '25%', color: '#F97316', text: 'Weak' },
            { width: '50%', color: '#EAB308', text: 'Fair' },
            { width: '75%', color: '#22C55E', text: 'Strong' },
            { width: '100%', color: '#16A34A', text: 'Very Strong' },
        ];

        const level = levels[Math.min(score, 4)];
        strengthFill.style.width = level.width;
        strengthFill.style.background = level.color;
        strengthText.textContent = level.text;
        strengthText.style.color = level.color;
    });

    /* ==========================================================
       VALIDATION HELPERS
       ========================================================== */
    const showError = (inputId, msg) => {
        const errEl = $(`#${inputId}Err`);
        const input = $(`#${inputId}`);
        if (errEl) errEl.textContent = msg;
        if (input) input.classList.add('error');
    };

    const clearError = (inputId) => {
        const errEl = $(`#${inputId}Err`);
        const input = $(`#${inputId}`);
        if (errEl) errEl.textContent = '';
        if (input) input.classList.remove('error');
    };

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const isValidPhone = (phone) => /^[\+]?[\d\s\-\(\)]{7,15}$/.test(phone.replace(/\s/g, ''));

    /* ==========================================================
       SIGNUP FORM
       ========================================================== */
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const name = $('#signupName').value.trim();
        const email = $('#signupEmail').value.trim();
        const phone = $('#signupPhone').value.trim();
        const password = $('#signupPassword').value;

        let valid = true;

        if (!name || name.length < 2) {
            showError('signupName', 'Please enter your full name');
            valid = false;
        }

        if (!email || !isValidEmail(email)) {
            showError('signupEmail', 'Please enter a valid email address');
            valid = false;
        }

        if (!phone || !isValidPhone(phone)) {
            showError('signupPhone', 'Please enter a valid phone number');
            valid = false;
        }

        if (!password || password.length < 6) {
            showError('signupPassword', 'Password must be at least 6 characters');
            valid = false;
        }

        if (!valid) return;

        const btn = $('#signupBtn');
        btn.classList.add('loading');

        try {
            const result = await sendToSheet({
                action: 'signup',
                name,
                email,
                phone,
                password,
            });

            if (result.success) {
                // Store user session
                const user = { name, email, phone };
                try {
                    localStorage.setItem('docuflow-user', JSON.stringify(user));
                } catch (e) { /* */ }

                showToast('\u2705', 'Account created! Redirecting...');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1200);
            } else {
                showToast('\u274C', result.message || 'Signup failed. Try again.');
            }
        } catch (err) {
            console.error('Signup error:', err);

            // Fallback: save locally if API is not configured
            if (GOOGLE_SHEET_API === 'YOUR_GOOGLE_APPS_SCRIPT_URL') {
                const users = JSON.parse(localStorage.getItem('docuflow-users') || '[]');
                const exists = users.find((u) => u.email === email);
                if (exists) {
                    showToast('\u274C', 'An account with this email already exists');
                } else {
                    users.push({ name, email, phone, password });
                    localStorage.setItem('docuflow-users', JSON.stringify(users));
                    localStorage.setItem('docuflow-user', JSON.stringify({ name, email, phone }));
                    showToast('\u2705', 'Account created locally! Redirecting...');
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
                }
            } else {
                showToast('\u274C', 'Connection error. Please try again.');
            }
        }

        btn.classList.remove('loading');
    });

    /* ==========================================================
       LOGIN FORM
       ========================================================== */
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const email = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;

        let valid = true;

        if (!email || !isValidEmail(email)) {
            showError('loginEmail', 'Please enter a valid email address');
            valid = false;
        }

        if (!password) {
            showError('loginPass', 'Please enter your password');
            valid = false;
        }

        if (!valid) return;

        const btn = $('#loginBtn');
        btn.classList.add('loading');

        try {
            const result = await sendToSheet({
                action: 'login',
                email,
                password,
            });

            if (result.success) {
                const user = result.user || { name: email.split('@')[0], email };
                try {
                    localStorage.setItem('docuflow-user', JSON.stringify(user));
                } catch (e) { /* */ }

                showToast('\u2705', `Welcome back, ${user.name}!`);
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1200);
            } else {
                showToast('\u274C', result.message || 'Invalid email or password');
            }
        } catch (err) {
            console.error('Login error:', err);

            // Fallback: check local storage
            if (GOOGLE_SHEET_API === 'YOUR_GOOGLE_APPS_SCRIPT_URL') {
                const users = JSON.parse(localStorage.getItem('docuflow-users') || '[]');
                const found = users.find((u) => u.email === email && u.password === password);
                if (found) {
                    const user = { name: found.name, email: found.email, phone: found.phone };
                    localStorage.setItem('docuflow-user', JSON.stringify(user));
                    showToast('\u2705', `Welcome back, ${found.name}!`);
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
                } else {
                    showToast('\u274C', 'Invalid email or password');
                }
            } else {
                showToast('\u274C', 'Connection error. Please try again.');
            }
        }

        btn.classList.remove('loading');
    });

    /* ==========================================================
       GOOGLE SHEETS API
       ========================================================== */
    const sendToSheet = async (data) => {
        if (GOOGLE_SHEET_API === 'YOUR_GOOGLE_APPS_SCRIPT_URL') {
            throw new Error('API not configured');
        }

        const response = await fetch(GOOGLE_SHEET_API, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        // no-cors mode: response is opaque, assume success
        return { success: true };
    };

    /* ==========================================================
       CHECK IF ALREADY LOGGED IN
       ========================================================== */
    (() => {
        try {
            const user = JSON.parse(localStorage.getItem('docuflow-user'));
            if (user && user.email) {
                // Already logged in — redirect to dashboard
                window.location.href = 'dashboard.html';
            }
        } catch (e) { /* */ }
    })();

    /* ==========================================================
       TOAST
       ========================================================== */
    const showToast = (icon, message) => {
        toast.querySelector('.toast-icon').textContent = icon;
        toast.querySelector('.toast-text').textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    /* ==========================================================
       INPUT ANIMATION — clear error on focus
       ========================================================== */
    $$('.input-wrapper input').forEach((input) => {
        input.addEventListener('focus', () => {
            input.classList.remove('error');
            const errEl = $(`#${input.id}Err`);
            if (errEl) errEl.textContent = '';
        });
    });

})();
