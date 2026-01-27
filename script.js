// === ИНИЦИАЛИЗАЦИЯ SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentUser = null;
let currentAvatarColor = '#075e54';
let activeDM = null;

const recentDMs = new Map();

// DOM-элементы
const messageList = document.getElementById('messageList');
const chatContainer = document.getElementById('chatContainer');
const authScreen = document.getElementById('authScreen');
const modal = document.getElementById('modal');
const chatTitle = document.getElementById('chatTitle');
const headerAvatar = document.getElementById('headerAvatar');

// === ЗАГРУЗКА ПРИ СТАРТЕ ===
window.addEventListener('load', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    await loadUserSettings();
    showMainApp();
    await loadMessages();
    initCallSystem();
  } else {
    showAuthScreen();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    if (event === 'SIGNED_IN') {
      loadUserSettings().then(() => {
        showMainApp();
        loadMessages();
        initCallSystem();
      });
    } else if (event === 'SIGNED_OUT') {
      showAuthScreen();
    }
  });

  // Разблокировка аудио
  document.body.addEventListener('click', () => {
    const audio = document.getElementById('remoteAudio');
    audio.play().catch(() => {});
  }, { once: true });
});

// === ЗАГРУЗКА ЦВЕТА ===
async function loadUserSettings() {
  if (!currentUser) return;
  const { data } = await supabaseClient.from('users').select('avatar_color').eq('id', currentUser.id).single();
  currentAvatarColor = data?.avatar_color || '#075e54';
}

// === ПОКАЗ ЭКРАНОВ ===
function showAuthScreen() {
  authScreen.style.display = 'flex';
  document.querySelector('.whatsapp-app').style.display = 'none';
}

function showMainApp() {
  authScreen.style.display = 'none';
  document.querySelector('.whatsapp-app').style.display = 'flex';
}

// === ОТПРАВКА СООБЩЕНИЯ ===
document.getElementById('sendBtn').addEventListener('click', async () => {
  const input = document.getElementById('messageText');
  const text = input.value.trim();
  if (!text || !currentUser) return;

  const { error } = await supabaseClient.from('messages').insert([{
    text,
    sender_name: currentUser.email.split('@')[0],
    user_id: currentUser.id,
    avatar_color: currentAvatarColor,
    dm_with: activeDM,
    created_at: new Date().toISOString(),
  }]);

  if (!error) input.value = '';
});

document.getElementById('messageText').addEventListener('keypress', e => {
  if (e.key === 'Enter') document.getElementById('sendBtn').click();
});

// === ЗАГРУЗКА СООБЩЕНИЙ ===
async function loadMessages() {
  if (!messageList) return;

  let query = supabaseClient.from('messages').select('*').order('created_at', { ascending: true }).limit(100);

  if (activeDM) {
    query = query.or(
      `and(user_id.eq.${currentUser.id},dm_with.eq.${activeDM}),and(user_id.eq.${activeDM},dm_with.eq.${currentUser.id})`
    );
  } else {
    query = query.is('dm_with', null);
  }

  const { data } = await query;
  messageList.innerHTML = '';

  data?.forEach(msg => {
    const el = document.createElement('div');
    el.className = 'message';
    el.innerHTML = `
      <div class="avatar" style="background:${msg.avatar_color}">
        ${msg.sender_name[0].toUpperCase()}
      </div>
      <div class="content">
        <div class="author">${msg.sender_name}</div>
        <div class="text">${msg.text}</div>
      </div>
    `;
    messageList.appendChild(el);
  });

  scrollToBottom();
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// === ПЕРЕКЛЮЧЕНИЕ ЧАТА ===
function openDM(userId) {
  activeDM = userId;
  chatTitle.textContent = getUserDisplayName(userId);
  headerAvatar.style.background = getRecentColor(userId);
  headerAvatar.textContent = getUserDisplayName(userId)[0].toUpperCase();
  document.querySelector('.back-btn').style.display = 'block';
  loadMessages();
}

function backToGeneral() {
  activeDM = null;
  chatTitle.textContent = '# общий';
  headerAvatar.style.background = '#075e54';
  headerAvatar.textContent = 'G';
  document.querySelector('.back-btn').style.display = 'none';
  loadMessages();
}

// === РЕАЛЬНОЕ ВРЕМЯ ===
supabaseClient.channel('chat')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
    const msg = payload.new;
    if (
      !msg.dm_with ||
      activeDM === null ||
      (activeDM && (msg.user_id === currentUser.id || msg.dm_with === currentUser.id))
    ) {
      addMessageToDOM(msg);
    }
  })
  .subscribe();

function addMessageToDOM(msg) {
  const el = document.createElement('div');
  el.className = 'message';
  el.innerHTML = `
    <div class="avatar" style="background:${msg.avatar_color}">
      ${msg.sender_name[0].toUpperCase()}
    </div>
    <div class="content">
      <div class="author">${msg.sender_name}</div>
      <div class="text">${msg.text}</div>
    </div>
  `;
  messageList.appendChild(el);
  scrollToBottom();
}

// === ВСПОМОГАТЕЛЬНЫЕ ===
function getUserDisplayName(userId) {
  const user = recentDMs.get(userId);
  return user ? user.email.split('@')[0] : 'Пользователь';
}

function getRecentColor(userId) {
  return recentDMs.get(userId)?.avatar_color || '#128c7e';
}

// === МОДАЛЬНЫЕ ОКНА ===
function showModal(title, body, onConfirm) {
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button onclick="closeModal()">Отмена</button>
        <button onclick="${onConfirm}()">Ок</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
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

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert('Ошибка: ' + error.message);
  else closeModal();
}

async function register() {
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) alert('Ошибка: ' + error.message);
  else alert('Проверьте почту!');
  closeModal();
}

// === 📞 ЗВОНКИ (как раньше, но без лишнего) ===
// ... (оставьте предыдущий исправленный код звонков)
