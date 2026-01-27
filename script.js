const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

const messageList = document.getElementById('messageList');
const nav = document.getElementById('nav');
let currentUser = null;
let currentAvatarColor = '#7a5ce8';

window.addEventListener('load', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    await loadUserSettings();
    setupNav();
    loadMessages();
    startRealtime();
  } else {
    renderAuthScreen();
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    if (event === 'SIGNED_IN') {
      await loadUserSettings();
      setupNav();
      loadMessages();
      startRealtime();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentAvatarColor = '#7a5ce8';
      renderAuthScreen();
    }
  });
});

async function loadUserSettings() {
  const { data, error } = await supabaseClient
    .from('users')
    .select('avatar_color')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    await ensureUserRecord('#7a5ce8');
    currentAvatarColor = '#7a5ce8';
  } else {
    currentAvatarColor = data.avatar_color || '#7a5ce8';
  }
}

async function ensureUserRecord(color) {
  const { error } = await supabaseClient.from('users').upsert({
    id: currentUser.id,
    email: currentUser.email,
    avatar_color: color,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('Ошибка:', error);
}

async function changeAvatarColor(color) {
  currentAvatarColor = color;
  const avatar = document.querySelector('.user-avatar');
  if (avatar) avatar.style.background = color;

  const profileAvatar = document.querySelector('.profile-avatar');
  if (profileAvatar) profileAvatar.style.background = color;

  await ensureUserRecord(color);

  document.querySelectorAll('.avatar-option').forEach(el => {
    el.classList.toggle('selected', el.style.background === color);
  });
}

function setupNav() {
  const name = currentUser.email.split('@')[0];
  const firstLetter = name[0].toUpperCase();
  nav.innerHTML = `
    <div class="user-avatar" style="background:${currentAvatarColor}" onclick="openProfile()">
      ${firstLetter}
    </div>
  `;
}

function renderAuthScreen() {
  const oldMain = document.getElementById('main');
  if (oldMain) oldMain.remove();

  const main = document.createElement('div');
  main.id = 'main';
  main.style.padding = '16px';
  main.style.display = 'flex';
  main.style.flexDirection = 'column';
  main.style.justifyContent = 'center';
  main.style.alignItems = 'center';
  main.style.flex = '1';
  main.style.textAlign = 'center';

  main.innerHTML = `
    <h2>💬 Чат</h2>
    <p style="color:#aaa; margin:16px 0;">Войдите, чтобы начать общение</p>
    <button onclick="showLogin()" style="margin:8px; min-width:120px;">Войти</button>
    <button onclick="showRegister()" style="margin:8px; min-width:120px; background:#3a3a3c;">Регистрация</button>
  `;

  const app = document.getElementById('app');
  const inputArea = app.querySelector('.input-area');
  if (inputArea) app.insertBefore(main, inputArea);

  document.querySelector('.chat-container').style.display = 'none';
  document.querySelector('.input-area').style.display = 'none';
}

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

function closeModal(button) {
  const modal = button?.closest('.profile-modal') || 
                document.querySelector('.profile-modal') ||
                document.querySelector('.modal-overlay');
  modal?.remove();
}

async function openProfile() {
  await loadUserSettings();
  const name = currentUser.email.split('@')[0];
  const colors = ['#7a5ce8', '#e74c3c', '#f39c12', '#2ecc71', '#3498db'];

  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-content">
      <div class="profile-header">Профиль</div>
      <div class="profile-body">
        <div class="profile-avatar" style="background:${currentAvatarColor}">
          ${name[0].toUpperCase()}
        </div>
        <div class="avatar-options">
          ${colors.map(color => `
            <div class="avatar-option ${color === currentAvatarColor ? 'selected' : ''}"
                 style="background:${color};"
                 onclick="changeAvatarColor('${color}')"></div>
          `).join('')}
        </div>
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
  currentAvatarColor = '#7a5ce8';
  renderAuthScreen();
}

async function sendMessage() {
  const textarea = document.getElementById('messageText');
  const text = textarea.value.trim();
  if (!text) return;

  const sender = currentUser.email.split('@')[0];

  const { error } = await supabaseClient.from('messages').insert({
    text,
    sender_name: sender,
    user_id: currentUser.id,
    avatar_color: currentAvatarColor,
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

document.getElementById('messageText')?.addEventListener('input', function () {
  adjustTextareaHeight(this);
});

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

  data.forEach(addMessageToDOM);
  scrollToBottom();
}

function addMessageToDOM(msg) {
  const isOwn = msg.user_id === currentUser?.id;
  const name = msg.sender_name;
  const color = msg.avatar_color || '#7a5ce8';

  const messageEl = document.createElement('div');
  messageEl.className = `message ${isOwn ? 'own' : ''}`;
  messageEl.style.setProperty('--bg-color', color);

  messageEl.innerHTML = `
    <div class="message-header">
      <span>${name}</span>
      <span>${new Date(msg.created_at).toLocaleTimeString('ru')}</span>
    </div>
    <div>${msg.text}</div>
  `;

  // Добавляем аватарку слева для чужих сообщений
  if (!isOwn) {
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.style.background = color;
    avatar.textContent = name[0].toUpperCase();
    messageEl.insertBefore(avatar, messageEl.firstChild);
  }

  messageList.appendChild(messageEl);
  scrollToBottom();
}

// === Прокрутка вниз ===
function scrollToBottom() {
  messageList.scrollTop = messageList.scrollHeight;
}

// === Реальное время: новые сообщения ===
function startRealtime() {
  supabaseClient
    .channel('chat')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        console.log('Новое сообщение:', payload.new);
        addMessageToDOM(payload.new);
      }
    )
    .subscribe((status, err) => {
      if (err) {
        console.error('Ошибка Realtime:', err);
      } else {
        console.log('Realtime подключён:', status);
      }
    });
}
