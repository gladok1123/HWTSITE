import { supabase } from './supabase.js';

const authScreen = document.getElementById('authScreen');
const app = document.getElementById('app');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const authError = document.getElementById('authError');

const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const messagesContainer = document.getElementById('messages');
const chatsList = document.getElementById('chatsList');

let currentUser = null;
let isScrolledToBottom = true;

// === ЗВУКИ ===
const messageSound = new Audio("https://cdn.pixabay.com/audio/2022/01/20/audio_7694e4b92d.mp3");

// === АВТОРИЗАЦИЯ ===
async function signIn() {
  const email = emailInput.value;
  const password = passwordInput.value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  handleAuthResult(data, error);
}

async function signUp() {
  const email = emailInput.value;
  const password = passwordInput.value;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) showError(error.message);
  else showError("Проверьте почту!", false);
}

loginBtn.addEventListener('click', signIn);
signupBtn.addEventListener('click', signUp);

function handleAuthResult(data, error) {
  if (error) showError(error.message);
  else if (data.user) {
    currentUser = data.user;
    localStorage.setItem('user', JSON.stringify(currentUser));
    showApp();
    loadChats();
    loadMessages();
    subscribeToMessages();
    setupRealtimeStatus();
  }
}

function showError(msg, isError = true) {
  authError.style.display = 'block';
  authError.style.color = isError ? 'red' : 'green';
  authError.textContent = msg;
}

function showApp() {
  authScreen.style.display = 'none';
  app.style.display = 'flex';
}

window.addEventListener('load', async () => {
  const saved = localStorage.getItem('user');
  if (saved) {
    currentUser = JSON.parse(saved);
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      showApp();
      loadChats();
      loadMessages();
      subscribeToMessages();
      setupRealtimeStatus();
    }
  }
});

// === ЧАТЫ ===
function loadChats() {
  chatsList.innerHTML = '';
  const chat = document.createElement('div');
  chat.className = 'chat active';
  chat.innerHTML = `
    <div class="avatar"></div>
    <div class="chat-info">
      <div class="name">Общий чат</div>
      <div class="last-message">Добро пожаловать!</div>
    </div>
    <div class="chat-meta">
      <div class="time">только что</div>
    </div>
  `;
  chatsList.appendChild(chat);
}

// === СООБЩЕНИЯ ===
async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*, user_id')
    .order('inserted_at', { ascending: true });

  if (error) console.error('Ошибка:', error);
  else {
    messagesContainer.innerHTML = '';
    data.forEach(addMessageToDOM);
    scrollToBottom();
  }
}

function subscribeToMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      addMessageToDOM(payload.new);
      playNotification();
      scrollToBottom();
    })
    .subscribe();
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

  if (sameDay(now, date)) return 'сегодня в ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay(yesterday, date)) return 'вчера в ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' в ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessageToDOM(msg) {
  const isSent = msg.user_id === currentUser.id;
  const name = isSent ? 'Вы' : 'Собеседник';

  // Группировка по времени (опционально)
  const timeHeader = document.createElement('div');
  timeHeader.className = 'message-time-header';
  timeHeader.textContent = formatDate(msg.inserted_at);
  messagesContainer.appendChild(timeHeader);

  const messageEl = document.createElement('div');
  messageEl.className = `message-bubble ${isSent ? 'sent' : 'received'}`;

  let content = '';

  if (msg.message) {
    content += `<div class="message-text">${escapeHtml(msg.message)}</div>`;
  }

  if (msg.image_url) {
    content += `<img src="${msg.image_url}" alt="Фото" style="max-width: 250px; border-radius: 8px; margin-top: 4px;">`;
  }

  const status = isSent ? '<span class="read-indicator">✓✓</span>' : '';
  const author = isSent ? '' : `<div class="message-author">${name}</div>`;

  messageEl.innerHTML = `
    ${author}
    <div class="message-content">${content}</div>
    <div class="message-footer">
      <span class="message-timestamp">${new Date(msg.inserted_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      ${status}
    </div>
  `;

  messagesContainer.appendChild(messageEl);
  setTimeout(() => messageEl.classList.add('show'), 10);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  isScrolledToBottom = true;
}

messagesContainer.addEventListener('scroll', () => {
  const threshold = 100;
  isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < threshold;
});

function playNotification() {
  if (isScrolledToBottom) return;
  messageSound.play().catch(() => {});
}

// === ОТПРАВКА ===
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());

async function sendMessage() {
  const text = messageInput.value.trim();
  const file = fileInput.files[0];
  let image_url = null;

  if (file) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(fileName, file);

    if (uploadError) {
      alert('Ошибка загрузки');
      return;
    }

    image_url = `${supabase.storageUrl}/object/public/chat-files/${fileName}`;
  }

  if (!text && !image_url) return;

  const { error } = await supabase
    .from('messages')
    .insert([{ user_id: currentUser.id, message: text || null, image_url }]);

  if (error) console.error(error);
  else {
    messageInput.value = '';
    fileInput.value = '';
  }
}

// === РЕАЛЬНЫЙ СТАТУС ===
async function setupRealtimeStatus() {
  // Можно расширить: онлайн/оффлайн через пользователей
  // Пока просто показываем "онлайн"
  document.querySelector('.status').textContent = 'онлайн';
}

// === ТЁМНАЯ ТЕМА ===
document.querySelector('.menu-icons').addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  document.querySelector('.menu-icons').textContent = document.body.classList.contains('dark-theme') ? '☀️' : '⋯';
});

// === Переключение темы ===
const style = document.createElement('style');
style.textContent = `
  .dark-theme {
    --bg: #111b21;
    --bg-secondary: #1f2c34;
    --text: #e9edef;
    --bubble-received: #2a3942;
    --bubble-sent: #005c4b;
    --sidebar: #1f2c34;
    --header: #2a3942;
  }
  .dark-theme body,
  .dark-theme .whatsapp-container {
    background: var(--bg);
    color: var(--text);
  }
  .dark-theme .sidebar,
  .dark-theme .sidebar-header,
  .dark-theme .search-box input,
  .dark-theme .chat {
    background: var(--sidebar);
    border-color: #333;
  }
  .dark-theme .chat-header,
  .dark-theme .message-input {
    background: var(--header);
  }
  .dark-theme .chat-info .name,
  .dark-theme .chat-info .last-message,
  .dark-theme .status,
  .dark-theme .timestamp,
  .dark-theme .message-author {
    color: var(--text);
  }
  .dark-theme .message-bubble.received .message-content {
    background: var(--bubble-received);
  }
  .dark-theme .message-bubble.sent .message-content {
    background: var(--bubble-sent);
  }
  .dark-theme input, .dark-theme button {
    color: var(--text);
  }
`;
document.head.appendChild(style);

document.body.classList.add('dark-theme'); // Включить по умолчанию
document.querySelector('.menu-icons').textContent = '☀️';
