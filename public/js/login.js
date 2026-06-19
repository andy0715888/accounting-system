document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const regUsernameInput = document.getElementById('regUsername');
    const regPasswordInput = document.getElementById('regPassword');
    const registerBtn = document.getElementById('registerBtn');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const registerForm = document.getElementById('registerForm');
    const bgLayer = document.getElementById('bgLayer');
    const errorMsg = document.getElementById('errorMsg');

    function cssUrl(url) {
        return String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function setRandomBackground() {
        const hue = Math.floor(Math.random() * 360);
        const saturation = 60 + Math.floor(Math.random() * 30);
        const lightness = 40 + Math.floor(Math.random() * 30);
        bgLayer.style.backgroundImage = '';
        bgLayer.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        bgLayer.style.backgroundSize = '';
        bgLayer.style.backgroundPosition = '';
    }

    function applyBackground(url) {
        if (!url) return;
        bgLayer.style.backgroundColor = 'transparent';
        bgLayer.style.backgroundImage = `url("${cssUrl(url)}")`;
        bgLayer.style.backgroundSize = 'cover';
        bgLayer.style.backgroundPosition = 'center';
        bgLayer.style.backgroundRepeat = 'no-repeat';
    }

    setRandomBackground();

    fetch('/api/auth/check', { credentials: 'include' })
        .then(res => res.json())
        .then(data => { if (data.loggedIn) window.location.href = '/main'; })
        .catch(() => {});

    function loadBackground() {
        fetch('/api/settings/public/background')
            .then(res => res.json())
            .then(data => {
                if (!data.value) return;
                const bg = data.value;
                if (bg.type === 'url') applyBackground(bg.url);
                else if (bg.type === 'local') applyBackground(bg.path);
            })
            .catch(() => {});
    }
    loadBackground();

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.add('show');
        setTimeout(() => errorMsg.classList.remove('show'), 3000);
    }

    function handleLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        if (!username || !password) { showError('请输入用户名和密码'); return; }

        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/main';
            } else {
                showError(data.error || '登录失败');
                loginBtn.disabled = false;
                loginBtn.textContent = '登 录';
            }
        })
        .catch(() => {
            showError('网络错误，请稍后重试');
            loginBtn.disabled = false;
            loginBtn.textContent = '登 录';
        });
    }

    function handleRegister() {
        const username = regUsernameInput.value.trim();
        const password = regPasswordInput.value.trim();
        if (!username || !password) { showError('请输入用户名和密码'); return; }
        if (password.length < 6) { showError('密码长度至少6位'); return; }

        registerBtn.disabled = true;
        registerBtn.textContent = '注册中...';
        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showError('✅ 注册成功，请登录');
                registerForm.style.display = 'none';
                document.querySelector('.login-footer:not(.register-form)').style.display = 'block';
                usernameInput.value = username;
                passwordInput.value = '';
                registerBtn.disabled = false;
                registerBtn.textContent = '注 册';
            } else {
                showError(data.error || '注册失败');
                registerBtn.disabled = false;
                registerBtn.textContent = '注 册';
            }
        })
        .catch(() => {
            showError('网络错误，请稍后重试');
            registerBtn.disabled = false;
            registerBtn.textContent = '注 册';
        });
    }

    loginBtn.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passwordInput.focus(); });

    registerBtn.addEventListener('click', handleRegister);
    regPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'block';
        document.querySelector('.login-footer:not(.register-form)').style.display = 'none';
        errorMsg.classList.remove('show');
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        document.querySelector('.login-footer:not(.register-form)').style.display = 'block';
        errorMsg.classList.remove('show');
    });
});
