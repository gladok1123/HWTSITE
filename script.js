// === SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
const messageList = document.getElementById('messageList');
const nav = document.getElementById('nav');
let currentUser = null;
let currentNickname = localStorage.getItem('chatNickname') || '';
let currentAvatarColor = localStorage.getItem('avatarColor') || '#7a5ce8';
let activeDM = null; // null = общий чат

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
      <div class="user-avatar" onclick="openProfile()" style="background:${currentAvatarColor}">
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
  const name = currentUser ? currentUser.email.split('@')[0] : currentNickname;
  const modal = document.createElement('div');
  modal.className = 'profile-modal';

  const colors = ['#7a5ce8', '#e74c3c', '#f39c12', '#2ecc71', '#3498db'];

  modal.innerHTML = `
    <div class="profile-content">
      <div class="profile-header">Профиль</div>
      <div class="profile-body">
        <div class="profile-avatar" style="background:${currentAvatarColor}" onclick="selectAvatarColor(this)">
          ${name[0].toUpperCase()}
        </div>
        <div class="avatar-options">
          ${colors.map(color => `
            <div class="avatar-option ${color === currentAvatarColor ? 'selected' : ''}"
                 style="background:${color};"
                 onclick="setAvatarColor('${color}')"></div>
          `).join('')}
        </div>
        <div class="profile-info">
          <p><strong>Ник:</strong> ${name}</p>
          ${currentUser ? `<p><strong>Email:</strong> ${currentUser.email}</p>` : ''}
        </div>
        <div class="dm-list" id="dmList"></div>
        <div class="profile-actions">
          <button onclick="closeModal(this)">Закрыть</button>
          <button onclick="logout()" class="btn-logout">Выйти</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  loadDMList(); // Загружаем список ЛС
}

function selectAvatarColor(el) {
  const color = prompt('Введите цвет (#7a5ce8):') || currentAvatarColor;
  setAvatarColor(color);
}

function setAvatarColor(color) {
  currentAvatarColor = color;
  localStorage.setItem('avatarColor', color);

  const avatar = document.querySelector('.profile-avatar');
  if (avatar) avatar.style.background = color;

  const userAvatar = document.querySelector('.user-avatar');
  if (userAvatar) userAvatar.style.background = color;

  closeModal();
  setupNav();
}

// === ЗАКРЫТИЕ МОДАЛОК ===
function closeModal(button) {
  const modal = button?.closest('.profile-modal') || 
                document.querySelector('.profile-modal') ||
                document.querySelector('.modal-overlay');
  modal?.remove();
}

// === ОКНО ВХОДА/РЕГИСТРАЦИИ ===
function showLogin() { /* как раньше */ }
function showRegister() { /* как раньше */ }

// === РЕГИСТРАЦИЯ И ВХОД ===
async function register() { /* как раньше */ }
async function login() { /* как раньше */ }

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
    avatar_color: currentAvatarColor,
    dm_with: activeDM, // null = общий чат
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
  let query = supabaseClient.from('messages').select('*');

  if (activeDM) {
    query = query.or(
      `and(user_id.eq.${currentUser.id},dm_with.eq.${activeDM}),and(user_id.eq.${activeDM},dm_with.eq.${currentUser.id})`
    );
  } else {
    query = query.is('dm_with', null); // Общий чат
  }

  const { data, error } = await query.order('created_at', { ascending: true }).limit(200);

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

  messageEl.innerHTML = `
    <div class="message-header">
      <span>${name}</span>
      <span>${new Date(msg.created_at).toLocaleTimeString('ru')}</span>
    </div>
    <div>${msg.text}</div>
  `;

  // Аватарка слева (для не своих)
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

function scrollToBottom() {
  messageList.scrollTop = messageList.scrollHeight;
}

// === РЕАЛЬНОЕ ВРЕМЯ ===
function startRealtime() {
  supabaseClient
    .channel('chat')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      const msg = payload.new;
      const isDM = msg.dm_with !== null;
      const isRelevant =
        !isDM || // Общее сообщение
        msg.user_id === currentUser?.id ||
        msg.dm_with === currentUser?.id;

      if (isRelevant) {
        addMessageToDOM(msg);
      }
    })
    .subscribe();
}

// === ЛИЧНЫЕ СООБЩЕНИЯ ===
async function loadDMList() {
  const list = document.getElementById('dmList');
  if (!list) return;

  const { data, error } = await supabaseClient
    .from('messages')
    .select('user_id, sender_name, avatar_color')
    .not('user_id', 'eq', currentUser?.id)
    .is('dm_with', null)
    .limit(10);

  if (error) return;

  const users = [...new Map(data.map(item => [item.user_id, item])).values()];

  list.innerHTML = '<h4>Личные чаты</h4>';
  users.forEach(user => {
    const el = document.createElement('div');
    el.className = 'dm-item';
    el.onclick = () => openDM(user.user_id);
    el.innerHTML = `
      <div class="dm-avatar" style="background:${user.avatar_color}">${user.sender_name[0].toUpperCase()}</div>
      <div class="dm-name">${user.sender_name}</div>
    `;
    list.appendChild(el);
  });
}

function openDM(userId) {
  activeDM = userId;
  messageList.innerHTML = `<p style="color:#777; text-align:center">ЛС с пользователем ${userId.slice(0,8)}</p>`;
  loadMessages();
  closeModal();
}
