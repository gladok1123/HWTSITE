// === НАСТРОЙКА SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

// === ЭЛЕМЕНТЫ ===
const main = document.getElementById('main');
const nav = document.getElementById('nav');
let currentUser = null;

// === ЗАГРУЗКА ===
window.addEventListener('load', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;

  setupNav();
  if (currentUser) {
    renderFeed();
  } else {
    renderWelcome();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    setupNav();
    if (event === 'SIGNED_IN') {
      renderFeed();
    } else if (event === 'SIGNED_OUT') {
      renderWelcome();
    }
  });
});

// === НАВИГАЦИЯ ===
function setupNav() {
  if (currentUser) {
    const firstLetter = (currentUser.email?.split('@')[0]?.[0] || 'U').toUpperCase();
    nav.innerHTML = `
      <div class="user-avatar" onclick="openProfile()">
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
  const firstLetter = (currentUser.email?.split('@')[0]?.[0] || 'U').toUpperCase();
  const username = currentUser.email.split('@')[0];

  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-content">
      <div class="profile-header">Профиль</div>
      <div class="profile-body">
        <div class="profile-avatar">${firstLetter}</div>
        <div class="profile-info">
          <p><strong>Имя:</strong> ${username}</p>
          <p><strong>Email:</strong> ${currentUser.email}</p>
          <p><strong>ID:</strong> ${currentUser.id.slice(0, 8)}...</p>
        </div>
        <div class="profile-actions">
          <button onclick="this.closest('.profile-modal').remove()" style="background:#555;">
            Закрыть
          </button>
          <button onclick="logout()" class="btn-logout">
            Выйти
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function logout() {
  await supabaseClient.auth.signOut();
  document.querySelector('.profile-modal')?.remove();
}

// === ОСНОВНЫЕ СТРАНИЦЫ ===
function renderWelcome() {
  main.innerHTML = `
    <div class="welcome">
      <h2 style="color:white; margin-bottom:8px;">Добро пожаловать в HWT</h2>
      <p style="color:#aaa; margin-bottom:24px;">Поделитесь моментом. Соединитесь с миром.</p>
      <button onclick="showLogin()">Войти</button>
      <button onclick="showRegister()" style="margin-left:8px; background:#333;">Регистрация</button>
    </div>
  `;
}

function showLogin() {
  main.innerHTML = `
    <div class="form">
      <h2>Вход</h2>
      <input id="loginEmail" type="email" placeholder="Email">
      <input id="loginPassword" type="password" placeholder="Пароль">
      <button onclick="login()">Войти</button>
      <p style="margin-top:12px; color:#888;">
        Нет аккаунта? <a href="#" onclick="showRegister(); return false;" style="color:#8a5cf6;">Зарегистрироваться</a>
      </p>
    </div>
  `;
}

function showRegister() {
  main.innerHTML = `
    <div class="form">
      <h2>Регистрация</h2>
      <input id="regEmail" type="email" placeholder="Email">
      <input id="regPassword" type="password" placeholder="Пароль">
      <button onclick="register()">Зарегистрироваться</button>
    </div>
  `;
}

async function register() {
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  if (!email || !password) {
    alert('Заполните все поля');
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    alert('Проверьте почту и подтвердите регистрацию');
  }
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  }
}

async function renderFeed() {
  main.innerHTML = `
    <div class="form">
      <h2>Привет, ${currentUser.email.split('@')[0]}!</h2>
      <textarea id="postText" placeholder="Что у вас нового?" rows="3"></textarea>
      <input type="file" id="postFile" accept="image/*,video/*">
      <button onclick="createPost()">Опубликовать</button>
    </div>
    <div class="post-list" id="postList"></div>
  `;

  loadPosts();
}

async function createPost() {
  const text = document.getElementById('postText').value;
  const fileInput = document.getElementById('postFile');
  const file = fileInput.files[0];

  if (!text.trim() && !file) {
    alert('Введите текст или выберите файл');
    return;
  }

  let mediaUrl = null;

  if (file) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('posts')
      .upload(fileName, file);

    if (uploadError) {
      alert('Ошибка загрузки: ' + uploadError.message);
      return;
    }

    mediaUrl = `https://goziubuhrsamwzcvwogw.supabase.co/storage/v1/object/public/posts/${fileName}`;
  }

  const { error } = await supabaseClient
    .from('posts')
    .insert({ text, media_url: mediaUrl, user_id: currentUser.id });

  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    document.getElementById('postText').value = '';
    fileInput.value = '';
    loadPosts();
  }
}

async function loadPosts() {
  console.log('Загрузка постов...');

  const { data, error } = await supabaseClient
    .from('posts')
    .select('*') // ❌ Убрали проблемный JOIN
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки постов:', error);
    alert('Ошибка: ' + error.message);
    return;
  }

  console.log('Загруженные посты:', data);

  const postList = document.getElementById('postList');
  postList.innerHTML = '';

  if (data.length === 0) {
    postList.innerHTML = '<p style="color:#777; text-align:center; padding:16px;">Пока нет постов</p>';
    return;
  }

  data.forEach(post => {
    const name = post.user_id ? post.user_id.slice(0, 8) : 'Аноним';
    const firstLetter = name[0].toUpperCase();

    const postEl = document.createElement('div');
    postEl.className = 'post';
    postEl.innerHTML = `
      <div class="post-header">
        <div class="post-avatar">${firstLetter}</div>
        <div>
          <span class="post-user">${name}</span>
          <span class="post-time">${new Date(post.created_at).toLocaleString('ru')}</span>
        </div>
      </div>
      <div class="post-text">${post.text || ''}</div>
      ${post.media_url ? `<img src="${post.media_url}" class="post-media">` : ''}
      <div class="post-actions">
        <span style="cursor:pointer">❤️ Нравится</span>
        <span style="cursor:pointer">💬 Комментировать</span>
      </div>
    `;
    postList.appendChild(postEl);
  });
}
