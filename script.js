// === ИНИЦИАЛИЗАЦИЯ SUPABASE ===
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://goziubuhrsamwzcvwogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdveml1YnVocnNhbXd6Y3Z3b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzEyMTgsImV4cCI6MjA4NTAwNzIxOH0.TVZaFlmWaepg8TrANM0E_LY6f9Ozqdg4SyNS7uGlQGs'
);

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentUser = null;
let currentAvatarColor = '#075e54';
let activeDM = null;

const recentChats = new Map(); // userId → { name, avatar, lastMsg, time, email }

// DOM-элементы
const messageList = document.getElementById('messageList');
const chatContainer = document.getElementById('chatContainer');
const authScreen = document.getElementById('authScreen');
const modal = document.getElementById('modal');
const chatTitle = document.getElementById('chatTitle');
const headerAvatar = document.getElementById('headerAvatar');

// === ЗАГРУЗКА ПРИ СТАРТЕ ===
window.addEventListener('load', async () => {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;

    if (currentUser) {
      await loadUserSettings();
      showMainApp();
      loadChatsList(); // ← Загружаем список чатов
      loadMessages();
      initCallSystem();
    } else {
      showAuthScreen();
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      if (event === 'SIGNED_IN') {
        loadUserSettings().then(() => {
          showMainApp();
          loadChatsList();
          loadMessages();
          initCallSystem();
        });
      } else if (event === 'SIGNED_OUT') {
        showAuthScreen();
      }
    });

    // Разблокировка аудио при первом клике
    document.body.addEventListener('click', () => {
      const audio = document.getElementById('remoteAudio');
      audio.play().catch(() => {});
    }, { once: true });

  } catch (err) {
    console.error('Ошибка инициализации:', err);
    showAuthScreen();
  }
});

// === ЗАГРУЗКА ЦВЕТА АВАТАРКИ ===
async function loadUserSettings() {
  if (!currentUser) return;
  try {
    const { data } = await supabaseClient
      .from('users')
      .select('avatar_color')
      .eq('id', currentUser.id)
      .single();

    currentAvatarColor = data?.avatar_color || '#075e54';
  } catch (err) {
    console.error('Ошибка загрузки настроек:', err);
    currentAvatarColor = '#075e54';
  }
}

// === ПОКАЗ ЭКРАНОВ ===
function showAuthScreen() {
  if (authScreen) authScreen.style.display = 'flex';
  const app = document.querySelector('.whatsapp-app');
  if (app) app.style.display = 'none';
}

function showMainApp() {
  if (authScreen) authScreen.style.display = 'none';
  const app = document.querySelector('.whatsapp-app');
  if (app) app.style.display = 'flex';

  // На мобильных — по умолчанию показываем список
  if (window.innerWidth <= 768) {
    document.querySelector('.chats-list').classList.remove('hide');
    document.querySelector('.chat-area').classList.add('hide');
  }
}

// === ОТПРАВКА СООБЩЕНИЯ ===
document.getElementById('sendBtn')?.addEventListener('click', async () => {
  const input = document.getElementById('messageText');
  const text = input.value.trim();
  if (!text || !currentUser) return;

  const { error } = await supabaseClient.from('messages').insert([{
    text,
    sender_name: currentUser.email.split('@')[0],
    user_id: currentUser.id,
    avatar_color: currentAvatarColor,
    dm_with: activeDM,
    created_at: new Date().toISOString(),
  }]);

  if (!error) {
    input.value = '';
    adjustInputHeight(input);
  }
});

function adjustInputHeight(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
}

document.getElementById('messageText')?.addEventListener('input', function () {
  adjustInputHeight(this);
});

document.getElementById('messageText')?.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('sendBtn').click();
  }
});

// === ЗАГРУЗКА СООБЩЕНИЙ ===
async function loadMessages() {
  if (!messageList || !currentUser) return;

  let query = supabaseClient
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);

  if (activeDM) {
    query = query.or(
      `and(user_id.eq.${currentUser.id},dm_with.eq.${activeDM}),and(user_id.eq.${activeDM},dm_with.eq.${currentUser.id})`
    );
  } else {
    query = query.is('dm_with', null);
  }

  try {
    const { data } = await query;
    messageList.innerHTML = '';

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Нет сообщений';
      empty.style.color = '#777';
      empty.style.textAlign = 'center';
      empty.style.padding = '20px';
      messageList.appendChild(empty);
    } else {
      data.forEach(addMessageToDOM);
    }

    scrollToBottom();
  } catch (err) {
    console.error('Ошибка загрузки сообщений:', err);
  }
}

function addMessageToDOM(msg) {
  const el = document.createElement('div');
  el.className = 'message';
  el.innerHTML = `
    <div class="avatar" style="background:${msg.avatar_color}">
      ${msg.sender_name[0].toUpperCase()}
    </div>
    <div class="content">
      <div class="author">${msg.sender_name}</div>
      <div class="text">${msg.text}</div>
    </div>
  `;
  messageList.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// === ПЕРЕКЛЮЧЕНИЕ ЧАТА ===
function openDM(userId) {
  activeDM = userId;
  const chat = recentChats.get(userId);
  chatTitle.textContent = chat?.name || 'Пользователь';
  headerAvatar.style.background = chat?.avatar || '#128c7e';
  headerAvatar.textContent = chat?.name[0]?.toUpperCase() || 'U';

  document.querySelector('.back-btn').style.display = 'block';
  loadMessages();

  // На телефоне: скрываем список, показываем чат
  if (window.innerWidth <= 768) {
    document.querySelector('.chats-list').classList.add('hide');
    document.querySelector('.chat-area').classList.remove('hide');
  }
}

function backToGeneral() {
  activeDM = null;
  chatTitle.textContent = 'Чаты';
  headerAvatar.style.background = '#075e54';
  headerAvatar.textContent = 'G';

  document.querySelector('.back-btn').style.display = 'none';

  // Показываем список чатов
  if (window.innerWidth <= 768) {
    document.querySelector('.chats-list').classList.remove('hide');
    document.querySelector('.chat-area').classList.add('hide');
  }
}

// === ЗАГРУЗКА СПИСКА ЛИЧНЫХ ЧАТОВ ===
async function loadChatsList() {
  const container = document.getElementById('chatsList');
  if (!container || !currentUser) return;

  try {
    // Получаем всех пользователей
    const { data: users } = await supabaseClient
      .from('users')
      .select('id, email, avatar_color')
      .neq('id', currentUser.id);

    if (!users) return;

    for (const user of users) {
      const { data: messages } = await supabaseClient
        .from('messages')
        .select('text, created_at')
        .or(`and(user_id.eq.${currentUser.id},dm_with.eq.${user.id}),and(user_id.eq.${user.id},dm_with.eq.${currentUser.id})`)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMsg = messages?.[0];

      recentChats.set(user.id, {
        name: user.email.split('@')[0],
        avatar: user.avatar_color,
        lastMsg: truncate(lastMsg?.text || 'Нет сообщений', 30),
        time: lastMsg
          ? new Date(lastMsg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
          : '',
        email: user.email
      });
    }

    renderChatsList();
  } catch (err) {
    console.error('Ошибка загрузки чатов:', err);
  }
}

function truncate(str, n) {
  return str?.length > n ? str.slice(0, n) + '...' : str || '';
}

function renderChatsList() {
  const container = document.getElementById('chatsList');
  const header = container.querySelector('.list-header');
  container.innerHTML = '';
  container.appendChild(header);

  for (const [userId, chat] of recentChats) {
    const el = document.createElement('div');
    el.className = 'chat-item';
    el.onclick = () => openDM(userId);
    el.innerHTML = `
      <div class="chat-avatar" style="background:${chat.avatar}">
        ${chat.name[0].toUpperCase()}
      </div>
      <div class="chat-info">
        <div class="chat-name">${chat.name}</div>
        <div class="chat-last-message">${chat.lastMsg}</div>
      </div>
      <div class="chat-time">${chat.time}</div>
    `;
    container.appendChild(el);
  }
}

// === РЕАЛЬНОЕ ВРЕМЯ (обновление чатов и сообщений) ===
supabaseClient.channel('chat')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, async (payload) => {
    const msg = payload.new;

    // Обновляем последнее сообщение в списке
    if (msg.dm_with) {
      const otherId = msg.user_id === currentUser.id ? msg.dm_with : msg.user_id;
      const { data: user } = await supabaseClient
        .from('users')
        .select('email, avatar_color')
        .eq('id', otherId)
        .single();

      if (user) {
        recentChats.set(otherId, {
          name: user.email.split('@')[0],
          avatar: user.avatar_color,
          lastMsg: truncate(msg.text, 30),
          time: new Date(msg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
          email: user.email
        });
        renderChatsList();
      }
    }

    // Отображаем сообщение, если нужно
    if (
      !msg.dm_with ||
      activeDM === null ||
      (activeDM && (msg.user_id === currentUser.id || msg.dm_with === currentUser.id))
    ) {
      addMessageToDOM(msg);
    }
  })
  .subscribe((status, err) => {
    if (err) console.error('Realtime ошибка:', err);
  });

// === МОДАЛЬНЫЕ ОКНА ===
function showModal(title, body, onConfirm) {
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button onclick="closeModal()">Отмена</button>
        <button id="confirmBtn">Ок</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
  document.getElementById('confirmBtn').onclick = onConfirm;
}

function closeModal() {
  modal.style.display = 'none';
}

function showLogin() {
  showModal('Вход', `
    <input id="loginEmail" type="email" placeholder="Email">
    <input id="loginPassword" type="password" placeholder="Пароль">
  `, login);
}

function showRegister() {
  showModal('Регистрация', `
    <input id="regEmail" type="email" placeholder="Email">
    <input id="regPassword" type="password" placeholder="Пароль">
  `, register);
}

async function login() {
  const email = document.getElementById('loginEmail')?.value;
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) {
    alert('Заполните все поля');
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Ошибка входа: ' + error.message);
  } else {
    closeModal();
  }
}

async function register() {
  const email = document.getElementById('regEmail')?.value;
  const password = document.getElementById('regPassword')?.value;
  if (!email || !password) {
    alert('Заполните все поля');
    return;
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert('Ошибка: ' + error.message);
  } else {
    alert('Регистрация успешна! Проверьте почту.');
    closeModal();
  }
}

// === 📞 ГОЛОСОВЫЕ ЗВОНКИ — КАК В WHATSAPP ===

const peerConnections = {};
const localStreams = new Map();
let currentCall = null;
let incomingCall = null;

function initCallSystem() {
  if (!currentUser) return;

  const channelName = `call_${currentUser.id}`;
  const existing = supabaseClient.getChannels().find(c => c.topic === channelName);
  if (existing) return;

  const channel = supabaseClient.channel(channelName, {
    config: { broadcast: { ack: true }, presence: false, private: false }
  });

  channel
    .on('broadcast', { event: 'call_offer' }, handleIncomingOffer)
    .on('broadcast', { event: 'call_answer' }, handleAnswer)
    .on('broadcast', { event: 'call_ice' }, handleIceCandidate)
    .on('broadcast', { event: 'call_hangup' }, handleHangup)
    .subscribe((status, err) => {
      if (err) console.error('Ошибка подписки:', err);
      else if (status === 'SUBSCRIBED') {
        console.log('✅ Канал звонков активен:', channelName);
      }
    });
}

async function startCall(userId) {
  if (currentCall || incomingCall) {
    alert('Вы уже на звонке');
    return;
  }

  const stream = await requestMicrophone();
  if (!stream) return;

  currentCall = userId;

  const pc = createPeerConnection(userId);
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const targetChannel = supabaseClient.channel(`call_${userId}`);
    targetChannel.httpSend({
      type: 'broadcast',
      event: 'call_offer',
      payload: {
        from: currentUser.id,
        to: userId,
        offer: { type: offer.type, sdp: offer.sdp },
        callerName: currentUser.email.split('@')[0]
      }
    });

    showCallingUI(userId);
  } catch (err) {
    console.error('Ошибка при создании предложения:', err);
    endCall();
  }
}

function handleIncomingOffer(payload) {
  console.log('Получен вызов:', payload);
  const { from, offer, callerName } = payload;

  if (!offer || !offer.type || !offer.sdp) {
    console.error('❌ Некорректный offer:', offer);
    return;
  }

  if (incomingCall || currentCall) {
    const busyChannel = supabaseClient.channel(`call_${from}`);
    busyChannel.httpSend({
      type: 'broadcast',
      event: 'call_hangup',
      payload: { from: currentUser.id, to: from, reason: 'занят' }
    });
    return;
  }

  incomingCall = { from, offer, callerName };
  showIncomingCallUI(callerName, acceptCall, rejectCall);
}

async function acceptCall() {
  if (!incomingCall) return;

  const { from, offer } = incomingCall;
  const stream = await requestMicrophone();
  if (!stream) {
    rejectCall();
    return;
  }

  const pc = createPeerConnection(from);
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  try {
    await pc.setRemoteDescription(new RTCSessionDescription({
      type: offer.type,
      sdp: offer.sdp
    }));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const targetChannel = supabaseClient.channel(`call_${from}`);
    targetChannel.httpSend({
      type: 'broadcast',
      event: 'call_answer',
      payload: {
        from: currentUser.id,
        to: from,
        answer: { type: answer.type, sdp: answer.sdp }
      }
    });

    currentCall = from;
    hideIncomingCallUI();
    showCallIndicator(from, 'На связи...');
  } catch (err) {
    console.error('Ошибка при ответе на звонок:', err);
    rejectCall();
  }
}

function rejectCall() {
  if (!incomingCall) return;

  const { from } = incomingCall;
  const channel = supabaseClient.channel(`call_${from}`);
  channel.httpSend({
    type: 'broadcast',
    event: 'call_hangup',
    payload: { from: currentUser.id, to: from, reason: 'отклонён' }
  });

  incomingCall = null;
  hideIncomingCallUI();
}

function handleAnswer(payload) {
  const { from, answer } = payload;
  const pc = peerConnections[from];
  if (!pc) return;

  if (!answer || !answer.type || !answer.sdp) {
    console.error('❌ Некорректный answer:', answer);
    return;
  }

  pc.setRemoteDescription(new RTCSessionDescription({
    type: answer.type,
    sdp: answer.sdp
  })).catch(err => console.error('setRemoteDescription:', err));

  hideCallingUI();
  showCallIndicator(from, 'На связи...');
}

function handleIceCandidate(payload) {
  const { from, candidate, sdpMid, sdpMLineIndex } = payload;
  const pc = peerConnections[from];
  if (!pc) return;

  const iceCandidate = new RTCIceCandidate({ candidate, sdpMid, sdpMLineIndex });
  pc.addIceCandidate(iceCandidate).catch(err => console.error('addIceCandidate:', err));
}

function createPeerConnection(userId) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  pc.ontrack = (e) => {
    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio) remoteAudio.srcObject = e.streams[0];
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      const targetChannel = supabaseClient.channel(`call_${userId}`);
      targetChannel.httpSend({
        type: 'broadcast',
        event: 'call_ice',
        payload: {
          from: currentUser.id,
          to: userId,
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex
        }
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected') endCall();
  };

  peerConnections[userId] = pc;
  return pc;
}

function endCall() {
  if (currentCall) {
    const channel = supabaseClient.channel(`call_${currentCall}`);
    channel.httpSend({
      type: 'broadcast',
      event: 'call_hangup',
      payload: { from: currentUser.id, to: currentCall }
    });
  }

  if (currentCall && peerConnections[currentCall]) {
    peerConnections[currentCall].close();
    delete peerConnections[currentCall];
  }

  if (currentCall) {
    const stream = localStreams.get(currentCall);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      localStreams.delete(currentCall);
    }
  }

  currentCall = null;
  hideCallingUI();
  hideCallIndicator();
}

function handleHangup(payload) {
  const { from } = payload;
  if (from === currentUser.id) return;

  if (currentCall === from) {
    alert('Собеседник завершил звонок');
    endCall();
  } else if (incomingCall && incomingCall.from === from) {
    alert('Звонок отклонён');
    incomingCall = null;
    hideIncomingCallUI();
  }
}

async function requestMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreams.set(currentCall || incomingCall?.from, stream);
    return stream;
  } catch (err) {
    alert('Не удалось получить доступ к микрофону');
    console.error(err);
    return null;
  }
}

function showIncomingCallUI(callerName, onAccept, onDecline) {
  const modal = document.getElementById('callModal');
  document.getElementById('callTitle').textContent = 'Входящий звонок';
  document.getElementById('callMessage').textContent = `${callerName} звонит...`;
  document.getElementById('callAccept').onclick = onAccept;
  document.getElementById('callDecline').onclick = onDecline;
  modal.style.display = 'flex';
}

function hideIncomingCallUI() {
  document.getElementById('callModal').style.display = 'none';
}

function showCallingUI(userId) {
  showCallIndicator(userId, 'Исходящий звонок...');
}

function hideCallingUI() {
  hideCallIndicator();
}

function showCallIndicator(userId, status) {
  const indicator = document.getElementById('callIndicator');
  const avatar = document.getElementById('callAvatar');
  const statusText = document.getElementById('callStatus');

  const chat = recentChats.get(userId) || { name: 'Пользователь', avatar: '#128c7e' };
  avatar.style.background = chat.avatar;
  avatar.textContent = chat.name[0].toUpperCase();
  statusText.textContent = status;
  indicator.style.display = 'flex';

  indicator.onclick = endCall;
}

function hideCallIndicator() {
  const indicator = document.getElementById('callIndicator');
  if (indicator) indicator.style.display = 'none';
}
