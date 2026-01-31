import { supabase } from './supabase.js';

// === ЭЛЕМЕНТЫ DOM ===
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

// === ЗВУК УВЕДОМЛЕНИЯ ===
const messageSound = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-quick-telegram-notification-930.mp3");
messageSound.volume = 0.5;

// === АВТОРИЗАЦИЯ ===
async function signIn() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showError("Введите email и пароль");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  handleAuthResult(data, error);
}

async function signUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showError("Введите email и пароль");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) showError(error.message);
  else showError("Проверьте почту для подтверждения!", false);
}

loginBtn.addEventListener('click', signIn);
signupBtn.addEventListener('click', signUp);

function handleAuthResult(data, error) {
  if (error) {
    showError(error.message);
  } else if (data.user) {
    currentUser = data.user;
    localStorage.setItem('user', JSON.stringify(currentUser));
    showApp();
    loadChats();
    loadMessages();
    subscribeToMessages();
    setupStatusIndicator();
  }
}

function showError(msg, isError = true) {
  authError.style.display = 'block';
  authError.style.color = isError ? 'red' : '#075e54';
  authError.textContent = msg;
}

function showApp() {
  authScreen.style.display = 'none';
  app.style.display = 'flex';
}

// === ВОССТАНОВЛЕНИЕ СЕССИИ ===
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
      setupStatusIndicator();
    }
  }
});

// === ЧАТЫ (в будущем можно расширить) ===
function loadChats() {
  chatsList.innerHTML = '';
  const chat = document.createElement('div');
  chat.className = 'chat active';
  chat.innerHTML = `
    <div class="avatar"></div>
    <div class="chat-info">
      <div class="name">Общий чат</div>
      <div class="last-message">Добро пожаловать в WhatsApp-клон!</div>
    </div>
    <div class="chat-meta">
      <div class="time">только что</div>
    </div>
  `;
  chatsList.appendChild(chat);
}

// === ФОРМАТИРОВАНИЕ ВРЕМЕНИ ===
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

  if (sameDay(now, date)) {
    return 'сегодня в ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (sameDay(yesterday, date)) {
    return 'вчера в ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) +
         ' в ' +
         date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// === ЗАГРУЗКА И ОТОБРАЖЕНИЕ СООБЩЕНИЙ ===
async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*, user_id')
    .order('inserted_at', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки:', error);
    return;
  }

  messagesContainer.innerHTML = '';
  data.forEach(addMessageToDOM);
  scrollToBottom();
}

function subscribeToMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      addMessageToDOM(payload.new);
      playNotificationSound();
      scrollToBottom();
    })
    .subscribe();
}

// === ДОБАВЛЕНИЕ СООБЩЕНИЯ В DOM ===
function addMessageToDOM(msg) {
  const isSent = msg.user_id === currentUser.id;
  const senderName = isSent ? 'Вы' : 'Собеседник';

  // --- Временная метка над группой ---
  const timeHeader = document.createElement('div');
  timeHeader.className = 'message-time-header';
  timeHeader.textContent = formatDate(msg.inserted_at);
  messagesContainer.appendChild(timeHeader);

  // --- Пузырь сообщения ---
  const messageEl = document.createElement('div');
  messageEl.className = `message-bubble ${isSent ? 'sent' : 'received'}`;

  let content = '';

  if (msg.message) {
    content += `<div class="message-text">${escapeHtml(msg.message)}</div>`;
  }

  if (msg.image_url) {
    content += `<img src="${msg.image_url}" alt="Фото" loading="lazy" style="max-width: 250px; border-radius: 8px; margin-top: 4px;">`;
  }

  const readStatus = isSent ? '<span class="read-indicator">✓✓</span>' : '';
  const author = isSent ? '' : `<div class="message-author">${senderName}</div>`;

  messageEl.innerHTML = `
    ${author}
    <div class="message-content">${content}</div>
    <div class="message-footer">
      <span class="message-timestamp">${new Date(msg.inserted_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      ${readStatus}
    </div>
  `;

  messagesContainer.appendChild(messageEl);

  // --- Анимация появления ---
  setTimeout(() => messageEl.classList.add('show'), 10);
}

// === ЭКРАНИРОВАНИЕ HTML ===
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// === ПЛАВНАЯ ПРОКРУТКА ===
function scrollToBottom() {
  const threshold = 100;
  const position = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
  isScrolledToBottom = position < threshold;
  if (isScrolledToBottom) {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
  }
}

messagesContainer.addEventListener('scroll', () => {
  const threshold = 100;
  isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < threshold;
});

// === ЗВУК УВЕДОМЛЕНИЯ ===
function playNotificationSound() {
  if (!isScrolledToBottom && document.hidden) {
    messageSound.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate(100);
  }
}

// === ОТПРАВКА СООБЩЕНИЯ ===
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

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
      alert('Ошибка загрузки файла: ' + uploadError.message);
      return;
    }

    image_url = `${supabase.storageUrl}/object/public/chat-files/${fileName}`;
  }

  if (!text && !image_url) return;

  const { error } = await supabase
    .from('messages')
    .insert([{ user_id: currentUser.id, message: text || null, image_url }]);

  if (error) {
    console.error('Ошибка отправки:', error);
    alert('Не удалось отправить сообщение');
  } else {
    messageInput.value = '';
    fileInput.value = '';
  }
}

// === СТАТУС "ОНЛАЙН" ===
async function setupStatusIndicator() {
  const statusElement = document.querySelector('.status');
  if (statusElement) {
    statusElement.textContent = 'онлайн';
    statusElement.style.color = '#4bcf82';
  }

  // Можно расширить: обновлять статус в БД
}

// === ПЕРЕКЛЮЧЕНИЕ ТЁМНОЙ ТЕМЫ ===
document.querySelector('.menu-icons').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  document.querySelector('.menu-icons').textContent = isDark ? '☀️' : '⋯';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// === ВОССТАНОВЛЕНИЕ ТЕМЫ ===
window.addEventListener('load', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    document.querySelector('.menu-icons').textContent = '☀️';
  }
});
