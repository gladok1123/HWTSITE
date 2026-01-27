const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

let currentUser = null;
let currentAvatarColor = '#7a5ce8';
let activeDM = null;

// DOM
const messageList = document.getElementById('messageList');
const chatContainer = document.getElementById('chatContainer');
const userList = document.getElementById('userList');
const authScreen = document.getElementById('authScreen');
const modal = document.getElementById('modal');

window.addEventListener('load', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    await loadUserSettings();
    showMainApp();
    loadMessages();
    loadUserList();
    startRealtime();
  } else {
    showAuthScreen();
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    if (event === 'SIGNED_IN') {
      await loadUserSettings();
      showMainApp();
      loadMessages();
      loadUserList();
      startRealtime();
    } else if (event === 'SIGNED_OUT') {
      showAuthScreen();
    }
  });
});

async function loadUserSettings() {
  const { data, error } = await supabaseClient
    .from('users')
    .select('avatar_color')
    .eq('id', currentUser.id)
    .single();

  if (error || !data) {
    currentAvatarColor = '#7a5ce8';
    await ensureUserRecord(currentAvatarColor);
  } else {
    currentAvatarColor = data.avatar_color;
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

function showAuthScreen() {
  authScreen.style.display = 'flex';
  document.querySelector('.discord-app').style.display = 'none';
}

function showMainApp() {
  authScreen.style.display = 'none';
  document.querySelector('.discord-app').style.display = 'flex';
}

// === Отправка сообщения ===
document.getElementById('sendBtn').onclick = async () => {
  const textarea = document.getElementById('messageText');
  const text = textarea.value.trim();
  if (!text) return;

  const sender = currentUser.email.split('@')[0];

  const { error } = await supabaseClient.from('messages').insert({
    text,
    sender_name: sender,
    user_id: currentUser.id,
    avatar_color: currentAvatarColor,
    dm_with: activeDM,
    created_at: new Date().toISOString(),
  });

  if (error) {
    alert('Ошибка');
  } else {
    textarea.value = '';
    adjustTextareaHeight(textarea);
  }
};

function adjustTextareaHeight(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

document.getElementById('messageText').addEventListener('input', function () {
  adjustTextareaHeight(this);
});

// === Загрузка сообщений ===
async function loadMessages() {
  let query = supabaseClient.from('messages').select('*').order('created_at', { ascending: true }).limit(100);

  if (activeDM) {
    query = query.or(
      `and(user_id.eq.${currentUser.id},dm_with.eq.${activeDM}),and(user_id.eq.${activeDM},dm_with.eq.${currentUser.id})`
    );
  } else {
    query = query.is('dm_with', null);
  }

  const { data, error } = await query;

  if (error) return;

  messageList.innerHTML = '';
  data.forEach(addMessageToDOM);
  scrollToBottom();
}

function addMessageToDOM(msg) {
  const isOwn = msg.user_id === currentUser?.id;
  const name = msg.sender_name;
  const color = msg.avatar_color || '#7a5ce8';

  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  messageEl.innerHTML = `
    <div class="avatar" style="background:${color}">${name[0].toUpperCase()}</div>
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

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// === Пользователи справа ===
async function loadUserList() {
  const { data, error } = await supabaseClient
    .from('users')
    .select('id, email, avatar_color')
    .neq('id', currentUser.id)
    .limit(50);

  if (error || !data) return;

  const container = document.getElementById('userList');
  container.innerHTML = '<div class="user-header">Онлайн</div>';

  data.forEach(user => {
    const el = document.createElement('div');
    el.className = 'user-item';
    el.onclick = () => openDM(user.id);
    el.innerHTML = `
      <div class="user-avatar-small" style="background:${user.avatar_color}">
        ${user.email[0].toUpperCase()}
      </div>
      <div class="user-name">${user.email.split('@')[0]}</div>
    `;
    container.appendChild(el);
  });
}

function openDM(userId) {
  activeDM = userId;
  loadMessages();
}

// === Реальное время ===
function startRealtime() {
  supabaseClient
    .channel('chat')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      const msg = payload.new;
      const isRelevant =
        !msg.dm_with ||
        msg.user_id === currentUser.id ||
        msg.dm_with === currentUser.id;

      if (isRelevant) {
        addMessageToDOM(msg);
      }
    })
    .subscribe();
}

// === Модалки ===
function showModal(title, body, onConfirm) {
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button onclick="closeModal()">Отмена</button>
        <button onclick="confirmModal(${onConfirm})">Ок</button>
      </div>
    </div>
  `;
}

function closeModal() {
  modal.style.display = 'none';
}

function confirmModal(fn) {
  fn();
  closeModal();
}

// === Вход/Регистрация ===
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

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return alert('Заполните поля');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert('Ошибка: ' + error.message);
}

async function register() {
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  if (!email || !password) return alert('Заполните поля');

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    alert('Проверьте почту');
  }
}
