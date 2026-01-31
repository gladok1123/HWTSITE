import { supabase } from './supabase.js';

// === DOM Elements ===
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

// === Уведомительный звук ===
const messageSound = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-quick-telegram-notification-930.mp3");
messageSound.volume = 0.5;

// === Вход ===
async function signIn() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showError("Введите email и пароль");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showError(error.message);
  } else if (data.user) {
    handleAuthResult(data.user);
  }
}

// === Регистрация (без обязательного подтверждения) ===
async function signUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showError("Введите email и пароль");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    showError(error.message);
  } else {
    // Даже если email не подтверждён — пользователь создан
    if (data.user) {
      handleAuthResult(data.user);
    } else {
      showError("Регистрация успешна! Войдите", false);
    }
  }
}

loginBtn.addEventListener('click', signIn);
signupBtn.addEventListener('click', signUp);

function handleAuthResult(user) {
  currentUser = user;
  localStorage.setItem('user', JSON.stringify(user));
  showApp();
  loadChats();
  loadMessages();
  subscribeToMessages();
  setupStatusIndicator();
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

// === Восстановление сессии и темы ===
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

  // Восстановить тему
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    document.querySelector('.menu-icons').textContent = '☀️';
  }
});

// === Загрузка списка чатов ===
function loadChats() {
  chatsList.innerHTML = '';
  const chat = document.createElement('div');
  chat.className = 'chat active';
  chat.innerHTML = `
    <div class="avatar"></div>
    <div class="chat-info">
      <div class="name">Общий чат</div>
      <div class="last-message">Добро пожаловать в чат!</div>
    </div>
    <div class="chat-meta">
      <div class="time">только что</div>
    </div>
  `;
  chatsList.appendChild(chat);
}

// === Форматирование времени ===
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return 'сегодня в ' + formatTime(date);
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'вчера в ' + formatTime(date);
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' в ' + formatTime(date);
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// === Загрузка сообщений ===
async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('inserted_at', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки сообщений:', error);
    return;
  }

  messagesContainer.innerHTML = '';
  data.forEach(addMessageToDOM);
  scrollToBottom();
}

// === Подписка на новые сообщения (Realtime) ===
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

// === Добавление сообщения в DOM ===
function addMessageToDOM(msg) {
  const isSent = msg.user_id === currentUser.id;
  const sender = isSent ? 'Вы' : 'Собеседник';

  // --- Временная метка ---
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
    content += `<img src="${msg.image_url}" alt="Фото" loading="lazy" style="max-width: 280px; border-radius: 12px; margin-top: 8px;">`;
  }

  const readStatus = isSent ? '<span class="read-indicator">✓✓</span>' : '';
  const author = isSent ? '' : `<div class="message-author">${sender}</div>`;

  messageEl.innerHTML = `
    ${author}
    <div class="message-content">${content}</div>
    <div class="message-footer">
      <span class="message-timestamp">${formatTime(new Date(msg.inserted_at))}</span>
      ${readStatus}
    </div>
  `;

  messagesContainer.appendChild(messageEl);
  setTimeout(() => messageEl.classList.add('show'), 10);
}

// === Экранирование HTML (безопасность) ===
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// === Плавная прокрутка вниз ===
function scrollToBottom() {
  const threshold = 100;
  isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < threshold;
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

// === Звук при новом сообщении ===
function playNotification() {
  if (!isScrolledToBottom && document.hidden) {
    messageSound.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate(100);
  }
}

// === Отправка сообщения ===
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

  // --- Загрузка фото ---
  if (file) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Ошибка загрузки файла:', uploadError);
      alert('Не удалось загрузить фото: ' + uploadError.message);
      return;
    }

    // ✅ Получаем публичный URL
    const { data } = supabase.storage.from('chat-files').getPublicUrl(fileName);
    image_url = data.publicUrl;
  }

  // --- Отправка в БД ---
  if (!text && !image_url) return;

  const { error } = await supabase
    .from('messages')
    .insert([{ user_id: currentUser.id, message: text || null, image_url }]);

  if (error) {
    console.error('Ошибка отправки:', error);
    alert('Ошибка при отправке сообщения');
  } else {
    messageInput.value = '';
    fileInput.value = '';
  }
}

// === Переключение тёмной темы ===
document.querySelector('.menu-icons').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  document.querySelector('.menu-icons').textContent = isDark ? '☀️' : '⋯';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// === Статус "онлайн" ===
function setupStatusIndicator() {
  const status = document.querySelector('.status');
  if (status) {
    status.textContent = 'онлайн';
    status.style.color = '#4bcf82';
  }
}
