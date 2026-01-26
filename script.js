// === НАСТРОЙКА SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

const messageList = document.getElementById('messageList');

// === ПОЛУ-АНОНИМНОСТЬ: НИК ===
function getNickname() {
  return localStorage.getItem('chatNickname') || '';
}

function setNickname(nick) {
  localStorage.setItem('chatNickname', nick);
}

// === ПОКАЗ ФОРМЫ ДЛЯ НИКА ===
function promptForNickname() {
  const saved = getNickname();
  let nick = saved;

  if (!saved) {
    nick = prompt('Введите ваш ник:');
    if (!nick || nick.trim().length === 0) {
      alert('Ник обязателен!');
      return promptForNickname();
    }
    setNickname(nick.trim());
  }

  return nick.trim();
}

// === ОТПРАВКА СООБЩЕНИЯ ===
async function sendMessage() {
  const textarea = document.getElementById('messageText');
  const text = textarea.value.trim();

  if (!text) {
    alert('Введите сообщение');
    return;
  }

  const nickname = promptForNickname();

  const { error } = await supabaseClient.from('messages').insert({
    text,
    nickname,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Ошибка отправки:', error);
    alert('Ошибка: ' + error.message);
  } else {
    textarea.value = '';
    // Сообщение появится при обновлении
  }
}

// === ЗАГРУЗКА СООБЩЕНИЙ ===
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Ошибка загрузки:', error);
    messageList.innerHTML = '<p style="color:red">Ошибка загрузки чата</p>';
    return;
  }

  messageList.innerHTML = '';

  if (data.length === 0) {
    messageList.innerHTML = '<p style="color:#777; text-align:center">Пока нет сообщений</p>';
    return;
  }

  data.reverse().forEach(msg => {
    const el = document.createElement('div');
    el.className = 'post';
    el.innerHTML = `
      <div class="post-header">
        <div class="post-avatar">${msg.nickname[0].toUpperCase()}</div>
        <div>
          <span class="post-user">${msg.nickname}</span>
          <span class="post-time">${new Date(msg.created_at).toLocaleTimeString('ru')}</span>
        </div>
      </div>
      <div class="post-text">${msg.text}</div>
    `;
    messageList.appendChild(el);
  });
}

// === РЕАЛЬНОЕ ВРЕМЯ ===
function startRealtime() {
  supabaseClient
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
      loadMessages();
    })
    .subscribe();
}

// === ЗАПУСК ===
window.addEventListener('load', () => {
  loadMessages();
  startRealtime();

  // Проверим, есть ли ник
  if (!getNickname()) {
    promptForNickname();
  }
});
