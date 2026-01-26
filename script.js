// === НАСТРОЙКА SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

// === ЭЛЕМЕНТЫ ===
const main = document.getElementById('main');
const nav = document.getElementById('nav');
let currentUser = null;

// === ЗАГРУЗКА ===
window.addEventListener('load', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;

  setupNav();
  if (currentUser) {
    renderChat();
  } else {
    renderWelcome();
  }

  // Отслеживаем изменения входа
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    setupNav();
    if (event === 'SIGNED_IN') {
      await ensureUserInTable(currentUser);
      renderChat();
    } else if (event === 'SIGNED_OUT') {
      renderWelcome();
    }
  });
});

// === ПРОВЕРКА/СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ В ТАБЛИЦЕ ===
async function ensureUserInTable(user) {
  const { error } = await supabaseClient.from('users').upsert({
    id: user.id,
    email: user.email,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('Ошибка сохранения пользователя:', error);
}

// === НАВИГАЦИЯ ===
function setupNav() {
  if (currentUser) {
    const firstLetter = (currentUser.email?.split('@')[0]?.[0] || 'U').toUpperCase();
    nav.innerHTML = `
      <div class="user-avatar" onclick="openProfile()">
        ${firstLetter}
      </div>
    `;
  } else {
    nav.innerHTML = `
      <button onclick="showLogin()">Войти</button>
      <button onclick="showRegister()">Регистрация</button>
    `;
  }
}

// === ПРОФИЛЬ ===
function openProfile() {
  const name = currentUser.email.split('@')[0];
  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-content">
      <div class="profile-header">Профиль</div>
      <div class="profile-body">
        <div class="profile-avatar">${name[0].toUpperCase()}</div>
        <div class="profile-info">
          <p><strong>Имя:</strong> ${name}</p>
          <p><strong>Email:</strong> ${currentUser.email}</p>
          <p><strong>ID:</strong> ${currentUser.id.slice(0, 8)}...</p>
        </div>
        <div class="profile-actions">
          <button onclick="this.closest('.profile-modal').remove()" style="background:#555;">Закрыть</button>
          <button onclick="logout()" class="btn-logout">Выйти</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function logout() {
  await supabaseClient.auth.signOut();
  document.querySelector('.profile-modal')?.remove();
}

// === СТРАНИЦЫ ===
function renderWelcome() {
  main.innerHTML = `
    <div class="welcome">
      <h2 style="color:white;">Добро пожаловать в чат</h2>
      <p style="color:#aaa; margin:8px 0;">Войдите, чтобы начать общение</p>
      <button onclick="showLogin()">Войти</button>
      <button onclick="showRegister()" style="margin-left:8px; background:#333;">Регистрация</button>
    </div>
  `;
}

function showLogin() {
  main.innerHTML = `
    <div class="form">
      <h2>Вход</h2>
      <input id="loginEmail" type="email" placeholder="Email">
      <input id="loginPassword" type="password" placeholder="Пароль">
      <button onclick="login()">Войти</button>
      <p style="margin-top:12px; color:#888;">
        Нет аккаунта? <a href="#" onclick="showRegister(); return false;" style="color:#8a5cf6;">Зарегистрироваться</a>
      </p>
    </div>
  `;
}

function showRegister() {
  main.innerHTML = `
    <div class="form">
      <h2>Регистрация</h2>
      <input id="regEmail" type="email" placeholder="Email">
      <input id="regPassword" type="password" placeholder="Пароль">
      <button onclick="register()">Зарегистрироваться</button>
    </div>
  `;
}

async function register() {
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  if (!email || !password) return alert('Заполните все поля');

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    alert('Проверьте почту для подтверждения');
  }
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  }
}

// === ЧАТ ===
function renderChat() {
  main.innerHTML = `
    <div class="form">
      <h2>Привет, ${currentUser.email.split('@')[0]}!</h2>
      <textarea id="messageText" placeholder="Введите сообщение..." rows="3"></textarea>
      <button onclick="sendMessage()">Отправить</button>
    </div>
    <div class="post-list" id="messageList"></div>
  `;

  loadMessages();
  startRealtime();
}

async function sendMessage() {
  const text = document.getElementById('messageText').value.trim();
  if (!text) return alert('Введите сообщение');

  const { error } = await supabaseClient.from('messages').insert({
    text,
    user_id: currentUser.id,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error('Ошибка:', error);
    alert('Ошибка отправки');
  } else {
    document.getElementById('messageText').value = '';
  }
}

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from('messages')
    .select(`*, author:users(email)`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Ошибка загрузки:', error);
    return;
  }

  const list = document.getElementById('messageList');
  list.innerHTML = '';

  if (data.length === 0) {
    list.innerHTML = '<p style="color:#777; text-align:center">Пока нет сообщений</p>';
    return;
  }

  data.reverse().forEach(msg => {
    const name = msg.author?.email?.split('@')[0] || 'Аноним';
    const firstLetter = name[0].toUpperCase();

    const el = document.createElement('div');
    el.className = 'post';
    el.innerHTML = `
      <div class="post-header">
        <div class="post-avatar">${firstLetter}</div>
        <div>
          <span class="post-user">${name}</span>
          <span class="post-time">${new Date(msg.created_at).toLocaleTimeString('ru')}</span>
        </div>
      </div>
      <div class="post-text">${msg.text}</div>
    `;
    list.appendChild(el);
  });
}

// === РЕАЛЬНОЕ ВРЕМЯ ===
function startRealtime() {
  supabaseClient
    .channel('chat')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, () => loadMessages())
    .subscribe();
}
