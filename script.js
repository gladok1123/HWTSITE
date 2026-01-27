// === SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

// === ЭЛЕМЕНТЫ ===
const messageList = document.getElementById('messageList');
const nav = document.getElementById('nav');
let currentUser = null;
let currentNickname = localStorage.getItem('chatNickname') || '';

// === ЗАГРУЗКА ===
window.addEventListener('load', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;

  setupNav();
  loadMessages();
  startRealtime();

  if (!currentNickname && !currentUser) {
    promptForNickname();
  }
});

// === ВВОД НИКА ===
function promptForNickname() {
  const nick = prompt('Введите ваш ник:');
  if (!nick || !nick.trim()) {
    alert('Ник обязателен!');
    return promptForNickname();
  }
  currentNickname = nick.trim();
  localStorage.setItem('chatNickname', currentNickname);
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
        </div>
        <div class="profile-actions">
          <button onclick="closeModal(this)">Закрыть</button>
          <button onclick="logout()" class="btn-logout">Выйти</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function logout() {
  await supabaseClient.auth.signOut();
  closeModal();
  currentUser = null;
  setupNav();
  loadMessages();
}

// === ЗАКРЫТИЕ МОДАЛОК ===
function closeModal(button) {
  const modal = button?.closest('.profile-modal') || 
                document.querySelector('.profile-modal') ||
                document.querySelector('.modal-overlay');
  modal?.remove();
}

// === ОКНО ВХОДА/РЕГИСТРАЦИИ ===
function showLogin() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="form">
      <h2>Вход</h2>
      <input id="loginEmail" type="email" placeholder="Email">
      <input id="loginPassword" type="password" placeholder="Пароль">
      <button onclick="login()">Войти</button>
      <p style="margin-top:12px; color:#888;">
        Нет аккаунта? 
        <a href="#" onclick="showRegister(); return false;">Регистрация</a>
      </p>
      <p style="color:#888; text-align:center; margin-top:12px;">
        <a href="#" onclick="closeModal(this); return false;">Отмена</a>
      </p>
    </div>
  `;
  document.body.appendChild(modal);
}

function showRegister() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="form">
      <h2>Регистрация</h2>
      <input id="regEmail" type="email" placeholder="Email">
      <input id="regPassword" type="password" placeholder="Пароль">
      <button onclick="register()">Зарегистрироваться</button>
      <p style="color:#888; text-align:center; margin-top:12px;">
        <a href="#" onclick="closeModal(this); return false;">Отмена</a>
      </p>
    </div>
  `;
  document.body.appendChild(modal);
}

// === РЕГИСТРАЦИЯ И ВХОД ===
async function register() {
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  if (!email || !password) return alert('Заполните поля');

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    alert('Проверьте почту для подтверждения');
    closeModal();
  }
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return alert('Заполните поля');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    closeModal();
  }
}

// === ОТПРАВКА СООБЩЕНИЯ ===
async function sendMessage() {
  const textarea = document.getElementById('messageText');
  const text = textarea.value.trim();
  if (!text) return;

  const sender = currentUser ? currentUser.email.split('@')[0] : currentNickname;

  const { error } = await supabaseClient.from('messages').insert({
    text,
    sender_name: sender,
    user_id: currentUser?.id || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Ошибка:', error);
    alert('Не удалось отправить');
  } else {
    textarea.value = '';
    adjustTextareaHeight(textarea);
  }
}

function adjustTextareaHeight(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

document.getElementById('messageText').addEventListener('input', function () {
  adjustTextareaHeight(this);
});

// === ЗАГРУЗКА СООБЩЕНИЙ ===
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('Ошибка загрузки:', error);
    return;
  }

  messageList.innerHTML = '';

  data.forEach(msg => {
    const isOwn = msg.user_id === currentUser?.id;
    const name = msg.sender_name;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${isOwn ? 'own' : ''}`;
    messageEl.innerHTML = `
      <div class="message-header">
        <span>${name}</span>
        <span>${new Date(msg.created_at).toLocaleTimeString('ru')}</span>
      </div>
      <div>${msg.text}</div>
    `;
    messageList.appendChild(messageEl);
  });

  messageList.scrollTop = messageList.scrollHeight;
}

// === РЕАЛЬНОЕ ВРЕМЯ ===
function startRealtime() {
  supabaseClient
    .channel('chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
      loadMessages();
    })
    .subscribe();
}
