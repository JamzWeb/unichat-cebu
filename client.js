let socket;
let currentUser = { nickname: "", school: "", isAdmin: false };
let partner = { nickname: "Searching...", school: "", isAdmin: false };

const emojiRegex = /[\p{Extended_Pictographic}\p{Emoji_Component}]/u;

function toggleAdminPasswordBox() {
  const isChecked = document.getElementById('adminToggle').checked;
  const container = document.getElementById('adminPasswordContainer');
  if (isChecked) {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
    document.getElementById('adminPasswordInput').value = '';
  }
}

document.getElementById('setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const rawNickname = document.getElementById('nicknameInput').value.trim();
  
  if (emojiRegex.test(rawNickname)) {
    alert("Nicknames cannot contain emojis! Please use alphanumeric characters only.");
    return;
  }

  currentUser.nickname = rawNickname;
  currentUser.school = document.getElementById('schoolSelect').value;
  currentUser.isAdmin = document.getElementById('adminToggle').checked;
  currentUser.adminPassword = document.getElementById('adminPasswordInput').value;

  if (!currentUser.nickname || !currentUser.school) return;

  // Connect to backend websocket server
  socket = io();

  socket.emit('register_user', currentUser);

  socket.on('login_success', (data) => {
    document.getElementById('authView').style.display = 'none';
    const chatView = document.getElementById('chatView');
    chatView.classList.remove('hidden');
    chatView.classList.add('flex');

    if (data.isAdmin) {
      document.getElementById('adminPanelBtn').style.display = 'inline-flex';
    }
  });

  socket.on('registration_error', (msg) => {
    alert(msg);
    location.reload();
  });

  socket.on('partner_matched', (data) => {
    partner = data;
    document.getElementById('partnerInfo').textContent = `${partner.nickname} (${partner.school})`;
    appendSystemMessage(`Connected with a student from ${partner.school}!`);
  });

  socket.on('receive_message', (msg) => {
    appendMessage(msg.sender, msg.school, msg.text, false, msg.isAdmin);
  });
});

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  appendMessage(currentUser.nickname, currentUser.school, text, true, currentUser.isAdmin);
  socket.emit('send_message', { text });
  input.value = '';
}

function handleKeyPress(e) {
  if (e.key === 'Enter') sendMessage();
}
document.getElementById('chatInput').addEventListener('keydown', handleKeyPress);

function appendMessage(sender, school, text, isSelf, isAdmin) {
  const stream = document.getElementById('messageStream');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msgHTML = `
    <div class="flex flex-col ${isSelf ? 'items-end' : 'items-start'} w-full">
      <div class="flex items-center gap-1.5 text-[11px] mb-1">
        ${isAdmin ? `
          <span class="px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] admin-glow">👑 ADMIN</span>
          <span class="font-bold text-emerald-400 neon-text-green me-1">${sender}</span>
        ` : `
          <span class="font-semibold text-zinc-300">${sender}</span>
          <span class="text-zinc-600">(${school})</span>
        `}
        <span class="text-zinc-600">${time}</span>
      </div>
      
      <div class="px-4 py-2.5 rounded-2xl max-w-[85%] text-sm break-words whitespace-pre-wrap ${
        isAdmin
          ? 'bg-gradient-to-r from-emerald-950/80 to-zinc-900 border border-emerald-500/50 text-emerald-300 font-medium shadow-[0_0_10px_rgba(34,197,94,0.15)]'
          : isSelf
            ? 'bg-zinc-800 text-slate-100 font-medium rounded-br-none border border-zinc-700'
            : 'bg-zinc-900 text-slate-200 border border-zinc-800 rounded-bl-none'
      }">${text}</div>
    </div>
  `;
  
  stream.insertAdjacentHTML('beforeend', msgHTML);
  stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
}

function appendSystemMessage(text) {
  const stream = document.getElementById('messageStream');
  stream.insertAdjacentHTML('beforeend', `<div class="text-center my-3"><span class="text-zinc-500 text-xs font-mono">--- ${text} ---</span></div>`);
  stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
}

function skipPartner() {
  appendSystemMessage("You skipped the chat. Finding next student...");
  socket.emit('skip_partner');
}

function reportCurrentPartner() {
  const reason = prompt("Reason for reporting this user:");
  if (reason) {
    socket.emit('report_user', { reason });
    alert("Report submitted successfully.");
  }
}

function toggleAdminDrawer() {
  const drawer = document.getElementById('adminDrawer');
  if (drawer.style.display === 'none' || drawer.style.display === '') {
    drawer.style.display = 'flex';
  } else {
    drawer.style.display = 'none';
  }
}

function leaveChat() {
  location.reload();
}
