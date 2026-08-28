const socket = io();

const onlineCountNum = document.getElementById('onlineCountNum');
const chatMessages = document.getElementById('chatMessages');
const setupScreen = document.getElementById('setupScreen');
const chatFooter = document.getElementById('chatFooter');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const findBtn = document.getElementById('findBtn');
const skipBtn = document.getElementById('skipBtn');
const typingIndicator = document.getElementById('typingIndicator');
const replyPreviewContainer = document.getElementById('replyPreviewContainer');
const replyPreviewText = document.getElementById('replyPreviewText');
const cancelReplyBtn = document.getElementById('cancelReplyBtn');

let currentRoom = null;
let replyingToMessage = null;
let typingTimeout = null;
let messageCounter = 0;
let storedAdminPass = '';

socket.on('online-count-update', (count) => {
    if (onlineCountNum) onlineCountNum.textContent = count;
});

function toggleStaffChatFields() {
    const isChecked = document.getElementById('isStaffChatCheck').checked;
    const container = document.getElementById('staffPassContainer');
    if (isChecked) container.classList.remove('hidden');
    else container.classList.add('hidden');
}

if (findBtn) {
    findBtn.addEventListener('click', () => {
        const nickname = document.getElementById('nicknameInput').value.trim() || 'Student';
        const school = document.getElementById('schoolSelect').value;
        const isStaff = document.getElementById('isStaffChatCheck')?.checked || false;
        const staffPass = document.getElementById('staffChatPass')?.value || '';

        localStorage.setItem('unichat_nickname', nickname);
        localStorage.setItem('unichat_school', school);

        socket.emit('find-stranger', { nickname, school, isStaff, staffPass });
        
        setupScreen.classList.add('hidden');
        chatMessages.innerHTML = `<div class="text-center text-slate-400 text-sm my-auto animate-pulse">Finding a student match...</div>`;
    });
}

socket.on('staff:chatError', (err) => {
    alert(err);
    location.reload();
});

socket.on('matched', (data) => {
    currentRoom = data.room;
    const partnerInfo = (data.partner1.id === socket.id) ? data.partner2 : data.partner1;

    let partnerDisplay = partnerInfo.roleTag ? `<span class="font-bold ${partnerInfo.roleTag.includes('ADMIN') ? 'text-amber-400' : 'text-blue-400'}">${partnerInfo.roleTag}</span> ${partnerInfo.nickname}` : partnerInfo.nickname;

    sessionStorage.setItem('unichat_room', currentRoom);
    sessionStorage.setItem('unichat_partner', JSON.stringify(partnerInfo));
    sessionStorage.setItem('unichat_history', '');

    chatMessages.innerHTML = `<div class="text-center text-emerald-400 text-xs my-3 bg-slate-900 py-2 rounded-lg border border-emerald-500/20">Connected with <strong>${partnerDisplay}</strong> from <strong>${partnerInfo.school}</strong>! Say hello 👋</div>`;
    chatFooter.classList.remove('hidden');
});

socket.on('waiting', () => {
    chatMessages.innerHTML = `<div class="text-center text-slate-400 text-sm my-auto animate-pulse">Looking for an available student in the queue...</div>`;
});

if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoom) return;

    const msgId = 'msg_' + (++messageCounter);
    const messageData = { id: msgId, room: currentRoom, message: text, replyTo: replyingToMessage };

    socket.emit('chat-message', messageData);
    appendMessage(messageData.id, text, 'sent', replyingToMessage);

    cancelReply();
    messageInput.value = '';
}

socket.on('chat-message', (data) => {
    appendMessage(data.id, data.message, 'received', data.replyTo);
});

socket.on('message-reaction', (data) => {
    const bubble = document.getElementById(data.msgId);
    if (bubble) updateReactionDisplay(bubble, data.reaction);
});

function appendMessage(msgId, text, type, replyContext = null) {
    const messageDiv = document.createElement('div');
    messageDiv.id = msgId || ('msg_' + (++messageCounter));
    messageDiv.className = `message-bubble max-w-[75%] p-3 rounded-lg text-sm relative group flex flex-col my-2 cursor-pointer ${
        type === 'sent' ? 'ml-auto bg-emerald-600 text-white' : 'mr-auto bg-slate-800 text-slate-200'
    }`;

    let replyHtml = replyContext ? `<div class="bg-black/30 border-l-2 border-white/60 px-2 py-1 mb-1 text-xs rounded text-slate-300 italic">Replying to: "${replyContext}"</div>` : '';

    messageDiv.innerHTML = `
        ${replyHtml}
        <span class="message-text">${text}</span>
        <div class="reaction-menu ${type === 'sent' ? 'right-0' : 'left-0'}">
            <button onclick="sendReaction('${messageDiv.id}', '❤️')">❤️</button>
            <button onclick="sendReaction('${messageDiv.id}', '😲')">😲</button>
            <button onclick="sendReaction('${messageDiv.id}', '☹')">☹</button>
            <button onclick="sendReaction('${messageDiv.id}', '👌')">👌</button>
        </div>
        <div class="reactions-container flex space-x-1 mt-1 text-xs"></div>
    `;

    messageDiv.addEventListener('click', () => setReply(text));
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendReaction = function(msgId, reactionEmoji) {
    event.stopPropagation();
    const bubble = document.getElementById(msgId);
    if (!bubble) return;
    updateReactionDisplay(bubble, reactionEmoji);
    if (currentRoom) socket.emit('message-reaction', { room: currentRoom, msgId: msgId, reaction: reactionEmoji });
};

function updateReactionDisplay(bubbleElement, emoji) {
    const container = bubbleElement.querySelector('.reactions-container');
    if (container) container.innerHTML = `<span class="bg-slate-900/80 px-1.5 py-0.5 rounded-full border border-slate-700">${emoji}</span>`;
}

window.setReply = function(text) {
    replyingToMessage = text;
    if (replyPreviewText && replyPreviewContainer) {
        replyPreviewText.textContent = text;
        replyPreviewContainer.classList.remove('hidden');
    }
    if (messageInput) messageInput.focus();
};

if (cancelReplyBtn) cancelReplyBtn.addEventListener('click', cancelReply);
function cancelReply() {
    replyingToMessage = null;
    if (replyPreviewContainer) replyPreviewContainer.classList.add('hidden');
}

// Skip button action
if (skipBtn) {
    skipBtn.addEventListener('click', () => {
        clearSessionStorage();
        socket.emit('skip');
        location.reload();
    });
}

socket.on('partner-disconnected', () => {
    alert('Your partner has disconnected.');
    clearSessionStorage();
    location.reload();
});

function clearSessionStorage() {
    sessionStorage.removeItem('unichat_room');
    sessionStorage.removeItem('unichat_partner');
    sessionStorage.removeItem('unichat_history');
}

// Feedback & Staff Dashboard handling
function openFeedbackModal() { document.getElementById('feedbackModal').classList.remove('hidden'); }
function closeFeedbackModal() { document.getElementById('feedbackModal').classList.add('hidden'); }

function submitFeedbackForm() {
    const type = document.getElementById('feedbackType').value;
    const message = document.getElementById('feedbackMsg').value.trim();
    const school = document.getElementById('schoolSelect')?.value || 'Unknown';
    if (!message) return alert('Please write a message.');
    socket.emit('submit-feedback', { type, message, school });
    alert('Sent successfully!');
    closeFeedbackModal();
}

function openAuthModal() { document.getElementById('authModal').classList.remove('hidden'); }
function closeAuthModal() { document.getElementById('authModal').classList.add('hidden'); }

async function loginAsStaff() {
    const pass = document.getElementById('staffPassInput').value;
    storedAdminPass = pass;
    try {
        const res = await fetch(`/api/admin/data?pass=${encodeURIComponent(pass)}`);
        if (!res.ok) return alert('Incorrect password!');
        renderDashboardView(await res.json());
        closeAuthModal();
    } catch (err) {
        alert('Error connecting.');
    }
}

function renderDashboardView(data) {
    let roleHeader = data.role === 'admin' ? '<span class="text-amber-400 font-bold">[MASTER ADMIN]</span>' : `<span class="text-blue-400 font-bold">[MODERATOR]</span>`;
    let adminExtra = data.role === 'admin' ? `
        <div class="space-y-2 bg-slate-950 p-4 rounded-lg border border-amber-500/30 text-xs">
            <h3 class="font-bold text-amber-400">👑 Credential Manager</h3>
            <select id="targetAccountSelect" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                <option value="admin">Master Admin Account</option>
                <option value="1">Moderator Slot 1</option>
                <option value="2">Moderator Slot 2</option>
                <option value="3">Moderator Slot 3</option>
                <option value="4">Moderator Slot 4</option>
                <option value="5">Moderator Slot 5</option>
            </select>
            <input type="text" id="newStaffUser" placeholder="New Username" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
            <input type="password" id="newStaffPass" placeholder="New Password" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
            <button onclick="submitStaffUpdate()" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 rounded">Save Changes</button>
        </div>
    ` : '';

    chatMessages.innerHTML = `
        <div class="max-w-xl mx-auto w-full bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 my-4 text-xs">
            <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 class="text-sm font-bold text-emerald-400">🛡️ Dashboard ${roleHeader}</h2>
                <button onclick="location.reload()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded">Exit</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div class="bg-slate-950 p-3 rounded border border-slate-800">Online: <strong class="text-emerald-400">${data.onlineUsers}</strong></div>
                <div class="bg-slate-950 p-3 rounded border border-slate-800">Active Rooms: <strong class="text-blue-400">${data.activeRoomsCount}</strong></div>
            </div>
            ${adminExtra}
            <div class="space-y-1">
                <h3 class="font-bold text-red-400">Reports</h3>
                <div class="bg-slate-950 p-3 rounded max-h-32 overflow-y-auto space-y-2">
                    ${data.reports.length ? data.reports.map(r => `<div><strong>${r.senderSchool}:</strong> ${r.message}</div>`).join('') : '<span class="text-slate-500">None</span>'}
                </div>
            </div>
        </div>
    `;
    if (chatFooter) chatFooter.classList.add('hidden');
}

function submitStaffUpdate() {
    socket.emit('admin:updateStaff', {
        adminPass: storedAdminPass,
        targetType: document.getElementById('targetAccountSelect').value === 'admin' ? 'admin' : 'mod',
        targetId: document.getElementById('targetAccountSelect').value,
        newUsername: document.getElementById('newStaffUser').value.trim(),
        newPassword: document.getElementById('newStaffPass').value.trim()
    });
}

socket.on('admin:actionSuccess', async (msg) => {
    alert(msg);
    const res = await fetch(`/api/admin/data?pass=${encodeURIComponent(storedAdminPass)}`);
    if (res.ok) renderDashboardView(await res.json());
});

socket.on('admin:actionError', (err) => alert('Error: ' + err));
