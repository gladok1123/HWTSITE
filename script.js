import { supabase } from './supabase.js';

const authScreen = document.getElementById('authScreen');
const app = document.getElementById('app');
const usernameInput = document.getElementById('usernameInput');
const loginBtn = document.getElementById('loginBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messages');

let currentUser = null;

// Вход
loginBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (name) {
    currentUser = name;
    localStorage.setItem('username', name);
    authScreen.style.display = 'none';
    app.style.display = 'flex';
    loadMessages();
    subscribeToNewMessages();
  }
});

// Проверка сохранённого имени
window.addEventListener('load', () => {
  const saved = localStorage.getItem('username');
  if (saved) {
    currentUser = saved;
    authScreen.style.display = 'none';
    app.style.display = 'flex';
    loadMessages();
    subscribeToNewMessages();
  }
});

// Загрузка сообщений
async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*, author: user_id')
    .order('inserted_at', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки:', error);
    return;
  }

  messagesContainer.innerHTML = '';
  data.forEach(addMessageToDOM);
}

// Подписка на новые сообщения
function subscribeToNewMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      addMessageToDOM(payload.new);
    })
    .subscribe();
}

// Добавление сообщения в DOM
function addMessageToDOM(msg) {
  const isSent = msg.user_id === currentUser;

  const messageEl = document.createElement('div');
  messageEl.className = `message ${isSent ? 'sent' : 'received'}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.message;

  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date(msg.inserted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  messageEl.append(bubble, timestamp);
  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Отправка сообщения
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentUser) return;

  const { error } = await supabase
    .from('messages')
    .insert([{ user_id: currentUser, message: text }]);

  if (error) {
    alert('Ошибка отправки');
    console.error(error);
  } else {
    messageInput.value = '';
  }
}
