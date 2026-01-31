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
  if (error) {
    showError(error.message);
  } else {
    showError("Проверьте почту для подтверждения!", false);
  }
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
    subscribeToMessages();
  }
}

function showError(msg, isError = true) {
  authError.style.display = 'block';
  authError.style.color = isError ? 'red' : 'green';
  authError.textContent = msg;
}

// === ЗАГРУЗКА ДАННЫХ ===
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
      subscribeToMessages();
      return;
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
      <div class="last-message">Добро пожаловать в чат!</div>
    </div>
    <div class="chat-meta">
      <div class="time">сейчас</div>
    </div>
  `;
  chatsList.appendChild(chat);
}

// === СООБЩЕНИЯ ===
async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('inserted_at', { ascending: true });

  if (error) console.error('Ошибка:', error);
  else {
    messagesContainer.innerHTML = '';
    data.forEach(addMessageToDOM);
    markLastAsRead();
  }
}

function subscribeToMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      addMessageToDOM(payload.new);
      markLastAsRead();
    })
    .subscribe();
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'сегодня ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'вчера ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString();
}

function addMessageToDOM(msg) {
  const isSent = msg.user_id === currentUser.id;

  const messageEl = document.createElement('div');
  messageEl.className = `message ${isSent ? 'sent' : 'received'}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (msg.message) {
    bubble.textContent = msg.message;
  }
  if (msg.image_url) {
    const img = document.createElement('img');
    img.src = msg.image_url;
    img.style.maxWidth = '250px';
    img.style.borderRadius = '8px';
    img.style.marginTop = '4px';
    bubble.appendChild(img);
  }

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.innerHTML = `
    <span class="timestamp">${formatDate(msg.inserted_at)}</span>
    ${isSent ? '<span class="read-status">✓✓</span>' : ''}
  `;

  messageEl.append(bubble, meta);
  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
      alert('Ошибка загрузки файла');
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

// === ПРОЧИТАНО ===
function markLastAsRead() {
  const messages = document.querySelectorAll('.message.received');
  messages.forEach((msg, i) => {
    if (i === messages.length - 1) {
      const status = msg.querySelector('.read-status');
      if (status) status.textContent = 'прочитано';
    }
  });
}

messagesContainer.addEventListener('scroll', markLastAsRead);
