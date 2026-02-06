// === ГЛАВНАЯ ФУНКЦИЯ ПРИЛОЖЕНИЯ ===
function initApp() {
  console.log('🚀 Приложение запущено');

  // Проверяем, доступен ли createClient от Supabase
  if (typeof createClient === 'undefined') {
    console.error('❌ Supabase SDK не загрузился');
    document.getElementById('postsContainer').innerHTML = '<p>Ошибка: Supabase не загрузился</p>';
    return;
  }

  // Создаём клиент (supabaseUrl и supabaseAnonKey из supabase.js)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // === DOM ЭЛЕМЕНТЫ ===
  const postForm = document.getElementById('postForm');
  const authorNameInput = document.getElementById('authorName');
  const contentInput = document.getElementById('content');
  const postsContainer = document.getElementById('postsContainer');

  // === ГЕНЕРАЦИЯ АВАТАРКИ ПО ИМЕНИ ===
  function getAvatar(name) {
    const firstLetter = (name.trim().charAt(0).toUpperCase() || '?');
    return `<div class="avatar">${firstLetter}</div>`;
  }

  // === ЗАГРУЗКА ПОСТОВ ИЗ SUPABASE ===
  async function loadPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      postsContainer.innerHTML = `<p>Ошибка: ${error.message}</p>`;
      console.error(error);
      return;
    }

    if (data.length === 0) {
      postsContainer.innerHTML = `<p class="loading">Пока нет постов. Будь первым!</p>`;
      return;
    }

    // Очищаем и рендерим посты
    postsContainer.innerHTML = '';
    data.forEach(post => {
      const el = document.createElement('div');
      el.className = 'post';
      el.dataset.id = post.id;

      const likes = post.likes || 0;

      el.innerHTML = `
        <div class="post-header">
          ${getAvatar(post.author_name)}
          <span class="author">${post.author_name}</span>
        </div>
        <div class="content">${post.content}</div>
        <div class="footer">
          <span>${new Date(post.created_at).toLocaleString('ru-RU')}</span>
          <div class="like" data-id="${post.id}">
            ❤️ <span>${likes}</span>
          </div>
        </div>
      `;

      // Обработчик лайка
      const likeBtn = el.querySelector('.like');
      likeBtn.addEventListener('click', async () => {
        const id = likeBtn.dataset.id;
        const newLikes = likes + 1;

        const { error } = await supabase
          .from('posts')
          .update({ likes: newLikes })
          .eq('id', id);

        if (error) {
          alert('Ошибка при лайке');
          return;
        }

        // Обновляем UI
        likeBtn.innerHTML = `❤️ <span>${newLikes}</span>`;
      });

      postsContainer.appendChild(el);
    });
  }

  // === ОТПРАВКА НОВОГО ПОСТА ===
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = authorNameInput.value.trim() || 'Аноним';
    const content = contentInput.value.trim();
    if (!content) return;

    await supabase.from('posts').insert([
      {
        author_name: author,
        content,
        likes: 0
      }
    ]);

    contentInput.value = '';
    loadPosts(); // Обновить ленту
  });

  // === REALTIME: автообновление при новых постах и лайках ===
  supabase
    .channel('realtime-posts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => loadPosts())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => loadPosts())
    .subscribe();

  // === СТАРТ ===
  loadPosts();
}
