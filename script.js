// === ИНИЦИАЛИЗАЦИЯ SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentUser = null;
let currentAvatarColor = '#7a5ce8';
let activeDM = null;

// Храним недавние ЛС
const recentDMs = new Map(); // id → { email, avatar_color }

// DOM
const messageList = document.getElementById('messageList');
const chatContainer = document.querySelector('.chat-container');
const userList = document.getElementById('userList');
const authScreen = document.getElementById('authScreen');
const modal = document.getElementById('modal');

// === ЗАГРУЗКА ПРИ СТАРТЕ ===
window.addEventListener('load', async () => {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;

    if (currentUser) {
      await loadUserSettings();
      showMainApp();
      await loadMessages();
      await loadUserList();
      restoreRecentDMs(); // Восстановить из localStorage
      startRealtime();
    } else {
      showAuthScreen();
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      if (event === 'SIGNED_IN') {
        await loadUserSettings();
        showMainApp();
        await loadMessages();
        await loadUserList();
        restoreRecentDMs();
        startRealtime();
      } else if (event === 'SIGNED_OUT') {
        showAuthScreen();
      }
    });
  } catch (err) {
    console.error('Ошибка инициализации:', err);
  }
});

// === ЗАГРУЗКА ЦВЕТА АВАТАРКИ ===
async function loadUserSettings() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('avatar_color')
      .eq('id', currentUser.id)
      .single();

    if (error || !data) {
      currentAvatarColor = '#7a5ce8';
      await ensureUserRecord(currentAvatarColor);
    } else {
      currentAvatarColor = data.avatar_color || '#7a5ce8';
    }
  } catch (err) {
    console.error('Ошибка загрузки настроек:', err);
    currentAvatarColor = '#7a5ce8';
  }
}

// === СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ ===
async function ensureUserRecord(color) {
  const { error } = await supabaseClient.from('users').upsert({
    id: currentUser.id,
    email: currentUser.email,
    avatar_color: color,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('Ошибка сохранения:', error);
}

// === ПОКАЗ ЭКРАНОВ ===
function showAuthScreen() {
  authScreen.style.display = 'flex';
  const app = document.querySelector('.discord-app');
  if (app) app.style.display = 'none';

  const toggleBtn = document.querySelector('.toggle-users-btn');
  if (toggleBtn) toggleBtn.remove();
}

function showMainApp() {
  authScreen.style.display = 'none';
  const app = document.querySelector('.discord-app');
  if (app) app.style.display = 'flex';

  if (window.innerWidth <= 768) {
    setTimeout(createUsersToggle, 500);
  }
}

// === ОТПРАВКА СООБЩЕНИЯ ===
document.getElementById('sendBtn')?.addEventListener('click', async () => {
  const textarea = document.getElementById('messageText');
  const text = textarea.value.trim();
  if (!text) return;

  const sender = currentUser.email.split('@')[0];

  const { error } = await supabaseClient.from('messages').insert([
    {
      text,
      sender_name: sender,
      user_id: currentUser.id,
      avatar_color: currentAvatarColor,
      dm_with: activeDM,
      created_at: new Date().toISOString(),
    }
  ]);

  if (error) {
    console.error('Ошибка отправки:', error);
    alert('Не удалось отправить');
  } else {
    textarea.value = '';
    adjustTextareaHeight(textarea);
  }
});

// === РЕГУЛИРОВКА ВЫСОТЫ ТЕКСТА ===
function adjustTextareaHeight(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

document.getElementById('messageText')?.addEventListener('input', function () {
  adjustTextareaHeight(this);
});

// === ЗАГРУЗКА СООБЩЕНИЙ ===
async function loadMessages() {
  if (!messageList) return;

  let query = supabaseClient
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);

  if (activeDM) {
    query = query.or(
      `and(user_id.eq.${currentUser.id},dm_with.eq.${activeDM}),and(user_id.eq.${activeDM},dm_with.eq.${currentUser.id})`
    );
  } else {
    query = query.is('dm_with', null);
  }

  try {
    const { data, error } = await query;
    if (error) throw error;

    messageList.innerHTML = '';

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Нет сообщений';
      empty.style.color = '#72767d';
      empty.style.textAlign = 'center';
      empty.style.padding = '20px';
      messageList.appendChild(empty);
    } else {
      data.forEach(msg => {
        addMessageToDOM(msg);
        trackRecentDM(msg);
      });
    }

    scrollToBottom();
  } catch (err) {
    console.error('Ошибка:', err);
    messageList.innerHTML = '<div style="color:red">Ошибка загрузки</div>';
  }
}

// === ДОБАВЛЕНИЕ СООБЩЕНИЯ В DOM ===
function addMessageToDOM(msg) {
  if (!messageList) return;

  const name = msg.sender_name || 'Аноним';
  const color = msg.avatar_color || '#7a5ce8';

  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  messageEl.innerHTML = `
    <div class="avatar" style="background:${color}">
      ${name[0].toUpperCase()}
    </div>
    <div class="content">
      <div class="header">
        <span class="author">${name}</span>
        <span class="timestamp">${new Date(msg.created_at).toLocaleTimeString('ru')}</span>
      </div>
      <div class="text">${msg.text}</div>
    </div>
  `;

  messageList.appendChild(messageEl);
  scrollToBottom();
}

// === ПРОКРУТКА ВНИЗ ===
function scrollToBottom() {
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// === ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ===
async function loadUserList() {
  if (!userList) return;

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, email, avatar_color')
      .neq('id', currentUser.id)
      .limit(50);

    if (error || !data) return console.error('Ошибка:', error);

    const header = userList.querySelector('.user-header');
    userList.innerHTML = '';
    if (header) {
      const h = document.createElement('div');
      h.className = 'user-header';
      h.textContent = 'ОНЛАЙН';
      userList.appendChild(h);
    }

    data.forEach(user => {
      const el = document.createElement('div');
      el.className = 'user-item';
      el.setAttribute('data-user-id', user.id);
      el.onclick = () => openDM(user.id);
      el.innerHTML = `
        <div class="user-avatar-small" style="background:${user.avatar_color}">
          ${user.email[0].toUpperCase()}
        </div>
        <div class="user-name">${user.email.split('@')[0]}</div>
      `;
      userList.appendChild(el);
    });
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

// === ПЕРЕКЛЮЧЕНИЕ НА ЛС ===
function openDM(userId) {
  activeDM = userId;
  const name = getUserDisplayName(userId);
  document.querySelector('.channel-header span').textContent = `ЛС с ${name}`;
  loadMessages();
  addToRecentDMs(userId);
}

// === РАБОТА С НЕДАВНИМИ ЛС ===
function trackRecentDM(msg) {
  if (msg.dm_with) {
    const otherId = msg.user_id === currentUser.id ? msg.dm_with : msg.user_id;
    addToRecentDMs(otherId);
  }
}

function addToRecentDMs(userId) {
  if (userId === currentUser.id) return;

  if (!recentDMs.has(userId)) {
    recentDMs.set(userId, { email: 'Загрузка...', avatar_color: '#7a5ce8' });
    fetchUserDetails(userId);
    saveRecentDMs(); // Сохраняем в localStorage
    updateRecentDMs();
  }
}

async function fetchUserDetails(userId) {
  const { data } = await supabaseClient
    .from('users')
    .select('email, avatar_color')
    .eq('id', userId)
    .single();

  if (data) {
    recentDMs.set(userId, { email: data.email, avatar_color: data.avatar_color });
    saveRecentDMs();
    updateRecentDMs();
  }
}

function updateRecentDMs() {
  const container = document.getElementById('dmList');
  if (!container) return;

  container.innerHTML = '';

  recentDMs.forEach((info, userId) => {
    const el = document.createElement('div');
    el.className = 'dm-item';
    el.title = `ЛС с ${info.email.split('@')[0]}`;
    el.onclick = () => openDM(userId);
    el.style.background = info.avatar_color;
    el.textContent = info.email[0].toUpperCase();
    container.appendChild(el);
  });
}

// === СОХРАНЕНИЕ/ВОССТАНОВЛЕНИЕ ЛС ===
function saveRecentDMs() {
  const arr = Array.from(recentDMs.entries());
  localStorage.setItem('recentDMs', JSON.stringify(arr));
}

function restoreRecentDMs() {
  const saved = localStorage.getItem('recentDMs');
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      arr.forEach(([id, info]) => {
        recentDMs.set(id, info);
      });
      updateRecentDMs();
    } catch (e) {
      console.error('Ошибка восстановления ЛС:', e);
    }
  }
}

// === РЕАЛЬНОЕ ВРЕМЯ ===
function startRealtime() {
  supabaseClient
    .channel('chat')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
    }, (payload) => {
      const msg = payload.new;

      const isRelevant =
        !msg.dm_with ||
        msg.user_id === currentUser.id ||
        msg.dm_with === currentUser.id;

      if (isRelevant) {
        if (msg.dm_with && (msg.user_id === currentUser.id || msg.dm_with === currentUser.id)) {
          const otherId = msg.user_id === currentUser.id ? msg.dm_with : msg.user_id;
          addToRecentDMs(otherId);
        }

        if (
          !msg.dm_with ||
          (activeDM && (msg.user_id === currentUser.id || msg.dm_with === currentUser.id))
        ) {
          addMessageToDOM(msg);
        }
      }
    })
    .subscribe((status, err) => {
      if (err) console.error('Realtime ошибка:', err);
    });
}

// === ВСПОМОГАТЕЛЬНЫЕ ===
function getUserDisplayName(userId) {
  const user = recentDMs.get(userId);
  return user ? user.email.split('@')[0] : 'Пользователь';
}

// === КНОПКА "ПОКАЗАТЬ ПОЛЬЗОВАТЕЛЕЙ" (МОБИЛЬНЫЕ) ===
function createUsersToggle() {
  const existing = document.querySelector('.toggle-users-btn');
  if (existing) return;

  const btn = document.createElement('button');
  btn.innerHTML = '👥';
  btn.className = 'toggle-users-btn';
  btn.onclick = () => {
    const usersPanel = document.querySelector('.users');
    const isVisible = usersPanel.classList.contains('show');
    usersPanel.classList.toggle('show', !isVisible);
    btn.innerHTML = isVisible ? '👥' : '✕';
  };
  document.body.appendChild(btn);
}

window.addEventListener('resize', () => {
  const btn = document.querySelector('.toggle-users-btn');
  const panel = document.querySelector('.users');

  if (window.innerWidth > 768) {
    if (btn) btn.remove();
    if (panel) panel.classList.remove('show');
  } else {
    if (!btn && document.querySelector('.discord-app')?.style.display !== 'none') {
      createUsersToggle();
    }
  }
});

// === МОДАЛЬНЫЕ ОКНА ===
function showModal(title, body, onConfirm) {
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button onclick="closeModal()">Отмена</button>
        <button id="confirmBtn">Ок</button>
      </div>
    </div>
  `;
  document.getElementById('confirmBtn').onclick = onConfirm;
}

function closeModal() {
  modal.style.display = 'none';
}

function showLogin() {
  showModal('Вход', `
    <input id="loginEmail" type="email" placeholder="Email">
    <input id="loginPassword" type="password" placeholder="Пароль">
  `, login);
}

function showRegister() {
  showModal('Регистрация', `
    <input id="regEmail" type="email" placeholder="Email">
    <input id="regPassword" type="password" placeholder="Пароль">
  `, register);
}

// === ВХОД / РЕГИСТРАЦИЯ ===
async function login() {
  const email = document.getElementById('loginEmail')?.value;
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) return alert('Заполните поля');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert('Ошибка: ' + error.message);
}

async function register() {
  const email = document.getElementById('regEmail')?.value;
  const password = document.getElementById('regPassword')?.value;
  if (!email || !password) return alert('Заполните поля');

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    alert('Проверьте почту');
    closeModal();
  }
}
