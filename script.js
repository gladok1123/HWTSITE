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

const messageSound = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-quick-telegram-notification-930.mp3");
messageSound.volume = 0.5;

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
  if (error) showError(error.message);
  else if (data.user) {
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

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    document.querySelector('.menu-icons').textContent = '☀️';
  }
});

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

async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
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

  if (date.toDateString() === now.toDateString()) return 'сегодня в ' + formatTime(date);
  if (date.toDateString() === yesterday.toDateString()) return 'вчера в ' + formatTime(date);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' в ' + formatTime(date);
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessageToDOM(msg) {
  const isSent = msg.user_id === currentUser.id;
  const sender = isSent ? 'Вы' : 'Собеседник';

  const timeHeader = document.createElement('div');
  timeHeader.className = 'message-time-header';
  timeHeader.textContent = formatDate(msg.inserted_at);
  messagesContainer.appendChild(timeHeader);

  const messageEl = document.createElement('div');
  messageEl.className = `message-bubble ${isSent ? 'sent' : 'received'}`;

  let content = '';
  if (msg.message) content += `<div class="message-text">${escapeHtml(msg.message)}</div>`;
  if (msg.image_url) content += `<img src="${msg.image_url}" alt="Фото">`;

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  const threshold = 100;
  isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < threshold;
  if (isScrolledToBottom) {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
  }
}

messagesContainer.addEventListener('scroll', scrollToBottom);

function playNotification() {
  if (!isScrolledToBottom && document.hidden) {
    messageSound.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate(100);
  }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());

async function sendMessage() {
  const text = messageInput.value.trim();
  const file = fileInput.files[0];
  let image_url = null;

  if (file) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('chat-files').upload(fileName, file);
    if (error) return alert('Ошибка загрузки: ' + error.message);
    image_url = `${supabase.storageUrl}/object/public/chat-files/${fileName}`;
  }

  if (!text && !image_url) return;

  const { error } = await supabase.from('messages').insert([{ user_id: currentUser.id, message: text || null, image_url }]);
  if (error) console.error(error);
  else {
    messageInput.value = '';
    fileInput.value = '';
  }
}

document.querySelector('.menu-icons').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  document.querySelector('.menu-icons').textContent = isDark ? '☀️' : '⋯';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

function setupStatusIndicator() {
  const status = document.querySelector('.status');
  if (status) status.textContent = 'онлайн';
}
