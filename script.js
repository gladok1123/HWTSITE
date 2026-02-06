// === Проверка Supabase ===
if (typeof createClient === 'undefined') {
  console.error('❌ Supabase не загружен');
  document.getElementById('postsContainer').innerHTML = '<p>Ошибка: Supabase не загрузился</p>';
  throw new Error('Supabase not loaded');
}

// === Настройки ===
const supabaseUrl = 'https://goziubuhrsamwzcvwogw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// === DOM ===
const postForm = document.getElementById('postForm');
const authorNameInput = document.getElementById('authorName');
const contentInput = document.getElementById('content');
const postsContainer = document.getElementById('postsContainer');

// === Генерация аватарки по имени ===
function getAvatar(name) {
  const firstLetter = name.trim().charAt(0).toUpperCase() || '?';
  return `<div class="avatar">${firstLetter}</div>`;
}

// === Загрузка постов ===
async function loadPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    postsContainer.innerHTML = `<p>Ошибка: ${error.message}</p>`;
    return;
  }

  if (data.length === 0) {
    postsContainer.innerHTML = `<p class="loading">Пока нет постов. Будь первым!</p>`;
    return;
  }

  postsContainer.innerHTML = '';
  data.forEach(post => {
    const el = document.createElement('div');
    el.className = 'post';
    el.dataset.id = post.id;

    const likes = post.likes || 0;
    const liked = post.liked || false;

    el.innerHTML = `
      <div class="post-header">
        ${getAvatar(post.author_name)}
        <span class="author">${post.author_name}</span>
      </div>
      <div class="content">${post.content}</div>
      <div class="footer">
        <span>${new Date(post.created_at).toLocaleString('ru-RU')}</span>
        <div class="like" data-id="${post.id}" data-liked="${liked}">
          ❤️ <span>${likes}</span>
        </div>
      </div>
    `;

    // Лайк
    const likeBtn = el.querySelector('.like');
    likeBtn.addEventListener('click', async () => {
      const id = likeBtn.dataset.id;
      const isLiked = likeBtn.dataset.liked === 'true';
      const newLikes = isLiked ? likes - 1 : likes + 1;

      const { error } = await supabase
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', id);

      if (error) {
        alert('Ошибка');
        return;
      }

      likeBtn.dataset.liked = !isLiked;
      likeBtn.innerHTML = `❤️ <span>${newLikes}</span>`;
    });

    postsContainer.appendChild(el);
  });
}

// === Отправка поста ===
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const author = authorNameInput.value.trim() || 'Аноним';
  const content = contentInput.value.trim();
  if (!content) return;

  await supabase.from('posts').insert([
    {
      author_name: author,
      content,
      likes: 0,
      avatar_url: 'none'
    }
  ]);

  contentInput.value = '';
  loadPosts();
});

// === Realtime ===
supabase
  .channel('itd-posts')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => loadPosts())
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => loadPosts())
  .subscribe();

// === Запуск ===
loadPosts();
