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

    function setRandomBackground() {
        const hue = Math.floor(Math.random() * 360);
        const saturation = 60 + Math.floor(Math.random() * 30);
        const lightness = 40 + Math.floor(Math.random() * 30);
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        bgLayer.style.background = color;
    }
    setRandomBackground();

    fetch('/api/auth/check', { credentials: 'include' })
        .then(res => res.json())
        .then(data => { if (data.loggedIn) window.location.href = '/main'; })
        .catch(() => {});

    function loadBackground() {
        fetch('/api/settings/background', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.value) {
                    const bg = data.value;
                    let url = '';
                    if (bg.type === 'url') url = bg.url;
                    else if (bg.type === 'local' && bg.path) url = bg.path;
                    if (url) {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = function() {
                            bgLayer.style.backgroundImage = `url(${url})`;
                            bgLayer.style.backgroundSize = 'cover';
                            bgLayer.style.backgroundPosition = 'center';
                            bgLayer.style.background = 'none';
                            bgLayer.style.backgroundColor = 'transparent';
                        };
                        img.onerror = function() {
                            console.warn('背景图片加载失败，使用随机颜色');
                        };
                        img.src = url;
                    }
                }
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
                // 隐藏注册表单，显示登录表单
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
