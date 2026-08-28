const socket = io();

// DOM Elements
const authView = document.getElementById('authView');
const chatView = document.getElementById('chatView');
const setupForm = document.getElementById('setupForm');
const nicknameInput = document.getElementById('nicknameInput');
const schoolSelect = document.getElementById('schoolSelect');
const adminToggle = document.getElementById('adminToggle');
const adminPasswordContainer = document.getElementById('adminPasswordContainer');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const partnerInfo = document.getElementById('partnerInfo');
const messageStream = document.getElementById('messageStream');
const chatInput = document.getElementById('chatInput');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const adminDrawer = document.getElementById('adminDrawer');
const adminReportList = document.getElementById('adminReportList');
const replyPreviewContainer = document.getElementById('replyPreviewContainer');
const replyPreviewText = document.getElementById('replyPreviewText');

let currentRoom = null;
let currentPartner = null;
let messageCounter = 0;
let storedAdminPass = '';
let replyingToMessage = null;

// Online user count update from server
socket.on('online-count-update', (count) => {
    const onlineCountNum = document.getElementById('onlineCountNum');
    if (onlineCountNum) onlineCountNum.textContent = count;
});

// Toggle staff password field visibility
function toggleAdminPasswordBox() {
    if (adminToggle && adminPasswordContainer) {
        if (adminToggle.checked) {
            adminPasswordContainer.classList.remove('hidden');
        } else {
            adminPasswordContainer.classList.add('hidden');
        }
    }
}

// Handle Setup Form Submission & Immediate Staff Dashboard Reveal
if (setupForm) {
    setupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nickname = nicknameInput.value.trim();
        const school = schoolSelect.value;
        const isStaff = adminToggle ? adminToggle.checked : false;
        const staffPass = adminPasswordInput ? adminPasswordInput.value.trim() : '';

        if (!nickname || !school) {
            alert('Please fill in your nickname and select your university campus.');
            return;
        }

        localStorage.setItem('unichat_nickname', nickname);
        localStorage.setItem('unichat_school', school);

        if (isStaff && staffPass) {
            storedAdminPass = staffPass;
            if (adminPanelBtn) {
                adminPanelBtn.style.display = 'inline-flex';
            }
        }

        socket.emit('find-stranger', { nickname, school, isStaff, staffPass });

        if (authView) authView.classList.add('hidden');
        if (chatView) {
            chatView.classList.remove('hidden');
            chatView.style.display = 'flex';
        }

        if (messageStream) {
            messageStream.innerHTML = `
                <div class="text-center my-2">
                    <span class="inline-block bg-zinc-900/80 border border-zinc-800 text-zinc-400 text-[11px] px-4 py-1.5 rounded-full font-mono">
                        Queue active. You can type messages below to test UI features right away!
                    </span>
                </div>
            `;
        }
    });
}

socket.on('staff:chatError', (err) => {
    alert(err);
    location.reload();
});

socket.on('matched', (data) => {
    currentRoom = data.room;
    currentPartner = (data.partner1.id === socket.id) ? data.partner2 : data.partner1;

    let partnerDisplay = currentPartner.roleTag 
        ? `<span class="font-bold ${currentPartner.roleTag.includes('ADMIN') ? 'text-amber-400' : 'text-blue-400'}">${currentPartner.roleTag}</span> ${currentPartner.nickname}` 
        : currentPartner.nickname;

    if (partnerInfo) {
        partnerInfo.innerHTML = `${partnerDisplay} <span class="text-emerald-500 font-mono text-[10px]">(${currentPartner.school})</span>`;
    }

    if (messageStream) {
        messageStream.innerHTML = `
            <div class="text-center my-2">
                <span class="inline-block bg-zinc-900/80 border border-zinc-800 text-emerald-400 text-[11px] px-4 py-1.5 rounded-full font-mono">
                    Connected with ${partnerDisplay} from ${currentPartner.school}! Say hello 👋
                </span>
            </div>
        `;
    }

    if (adminToggle && adminToggle.checked && adminPanelBtn) {
        adminPanelBtn.style.display = 'inline-flex';
        storedAdminPass = adminPasswordInput.value.trim();
    }
});

socket.on('waiting', () => {
    if (messageStream && !messageStream.querySelector('.test-mode-notice')) {
        const notice = document.createElement('div');
        notice.className = 'text-center my-2 test-mode-notice';
        notice.innerHTML = `
            <span class="inline-block bg-zinc-900/80 border border-zinc-800 text-zinc-400 text-[11px] px-4 py-1.5 rounded-full font-mono">
                Waiting for a partner, but test-messaging is enabled! Try typing below.
            </span>
        `;
        messageStream.appendChild(notice);
    }
});

if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function sendMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    const msgId = 'msg_' + (++messageCounter);
    const activeTargetRoom = currentRoom || 'test_room';
    
    // Check if user has staff badge active to show tag
    let userRoleTag = null;
    if (adminToggle && adminToggle.checked) {
        userRoleTag = adminPasswordInput && adminPasswordInput.value.trim() === 'secureadminpassword' ? '👑 ADMIN' : '📢 MOD';
    }
    const nickname = localStorage.getItem('unichat_nickname') || 'You';

    const messageData = { 
        id: msgId, 
        room: activeTargetRoom, 
        message: text, 
        replyTo: replyingToMessage,
        senderName: nickname,
        roleTag: userRoleTag,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (currentRoom) {
        socket.emit('chat-message', messageData);
    }
    
    // Append locally with neon styling & role tag
    appendMessage(messageData, 'sent');

    cancelReply();
    chatInput.value = '';
}

socket.on('chat-message', (data) => {
    appendMessage(data, 'received');
});

socket.on('message-reaction', (data) => {
    const bubble = document.getElementById(data.msgId);
    if (bubble) updateReactionDisplay(bubble, data.reaction);
});

// Render message bubbles featuring neon glows and role badges
function appendMessage(data, type) {
    if (!messageStream) return;

    const messageDiv = document.createElement('div');
    messageDiv.id = data.id || ('msg_' + (++messageCounter));
    
    // Determine alignment and neon styling class match
    const isSent = type === 'sent';
    messageDiv.className = `max-w-[80%] flex flex-col my-3 cursor-pointer ${isSent ? 'ml-auto items-end' : 'mr-auto items-start'}`;

    // Role Tag HTML header (e.g. 👑 ADMIN or 📢 MOD)
    let badgeHtml = '';
    if (data.roleTag) {
        badgeHtml = `
            <div class="flex items-center space-x-1.5 mb-1 px-1">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-900 border border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                    ${escapeHtml(data.roleTag)}
                </span>
                <span class="text-xs font-medium text-emerald-400/90">${escapeHtml(data.senderName || (isSent ? 'You' : 'Stranger'))}</span>
                <span class="text-[10px] text-zinc-500">${escapeHtml(data.timestamp || '')}</span>
            </div>
        `;
    } else {
        badgeHtml = `
            <div class="flex items-center space-x-1.5 mb-1 px-1 text-[10px] text-zinc-500">
                <span>${escapeHtml(data.senderName || (isSent ? 'You' : 'Stranger'))}</span>
                <span>${escapeHtml(data.timestamp || '')}</span>
            </div>
        `;
    }

    let replyHtml = data.replyTo ? `<div class="bg-black/40 border-l-2 border-emerald-500 px-2 py-1 mb-1 text-xs rounded text-zinc-300 italic">Replying to: "${escapeHtml(data.replyTo)}"</div>` : '';

    messageDiv.innerHTML = `
        ${badgeHtml}
        <div class="message-bubble p-3 rounded-2xl text-sm relative group flex flex-col ${
            isSent 
                ? 'bg-zinc-900 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)] rounded-br-sm' 
                : 'bg-zinc-900 text-slate-200 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)] rounded-bl-sm'
        }">
            ${replyHtml}
            <span class="break-words">${escapeHtml(data.message)}</span>
            <div class="reaction-menu ${isSent ? 'right-0' : 'left-0'}">
                <button onclick="sendReaction('${messageDiv.id}', '❤️')">❤️</button>
                <button onclick="sendReaction('${messageDiv.id}', '😲')">😲</button>
                <button onclick="sendReaction('${messageDiv.id}', '☹')">☹</button>
                <button onclick="sendReaction('${messageDiv.id}', '👌')">👌</button>
            </div>
            <div class="reactions-container flex space-x-1 mt-1 text-xs"></div>
        </div>
    `;

    messageDiv.querySelector('.message-bubble').addEventListener('click', () => setReply(data.message));
    messageStream.appendChild(messageDiv);
    messageStream.scrollTop = messageStream.scrollHeight;
}

window.sendReaction = function(msgId, reactionEmoji) {
    event.stopPropagation();
    const bubble = document.getElementById(msgId);
    if (!bubble) return;
    updateReactionDisplay(bubble, reactionEmoji);
    if (currentRoom) {
        socket.emit('message-reaction', { room: currentRoom, msgId: msgId, reaction: reactionEmoji });
    }
};

function updateReactionDisplay(bubbleElement, emoji) {
    const container = bubbleElement.querySelector('.reactions-container');
    if (container) container.innerHTML = `<span class="bg-zinc-950/80 px-1.5 py-0.5 rounded-full border border-emerald-500/40 text-[10px]">${emoji}</span>`;
}

window.setReply = function(text) {
    replyingToMessage = text;
    if (replyPreviewText && replyPreviewContainer) {
        replyPreviewText.textContent = text;
        replyPreviewContainer.classList.remove('hidden');
    }
    if (chatInput) chatInput.focus();
};

function cancelReply() {
    replyingToMessage = null;
    if (replyPreviewContainer) replyPreviewContainer.classList.add('hidden');
}

function skipPartner() {
    socket.emit('skip');
    resetChatState();
}

function leaveChat() {
    socket.emit('skip');
    if (chatView) {
        chatView.classList.add('hidden');
        chatView.style.display = 'none';
    }
    if (authView) authView.classList.remove('hidden');
    location.reload();
}

socket.on('partner-disconnected', () => {
    alert('Your partner has disconnected from the chat session.');
    resetChatState();
});

function resetChatState() {
    currentRoom = null;
    currentPartner = null;
    if (partnerInfo) partnerInfo.textContent = 'Finding stranger...';
    if (messageStream) {
        messageStream.innerHTML = `
            <div class="text-center my-2">
                <span class="inline-block bg-zinc-900/80 border border-zinc-800 text-zinc-500 text-[11px] px-4 py-1.5 rounded-full font-mono">
                    Partner left. Finding a new student in queue...
                </span>
            </div>
        `;
    }
    const nickname = localStorage.getItem('unichat_nickname') || 'Student';
    const school = localStorage.getItem('unichat_school') || 'USC';
    const isStaff = adminToggle ? adminToggle.checked : false;
    const staffPass = adminPasswordInput ? adminPasswordInput.value.trim() : '';
    
    socket.emit('find-stranger', { nickname, school, isStaff, staffPass });
}

function reportCurrentPartner() {
    const reason = prompt('Please describe the reason for reporting this user:');
    if (!reason) return;
    
    const schoolName = currentPartner ? currentPartner.school : 'Unknown';
    socket.emit('submit-feedback', { type: 'report', message: reason, school: schoolName });
    alert('Report submitted successfully to moderators.');
}

function toggleAdminDrawer() {
    if (!adminDrawer) return;
    if (adminDrawer.style.display === 'none' || adminDrawer.style.display === '') {
        adminDrawer.style.display = 'flex';
        fetchAdminDashboardData();
    } else {
        adminDrawer.style.display = 'none';
    }
}

async function fetchAdminDashboardData() {
    if (!storedAdminPass) return;
    try {
        const res = await fetch(`/api/admin/data?pass=${encodeURIComponent(storedAdminPass)}`);
        if (!res.ok) return;
        const data = await res.json();
        
        const credentialSection = document.getElementById('adminCredentialSection');
        if (data.role === 'admin' && credentialSection) {
            credentialSection.classList.remove('hidden');
        }

        if (adminReportList && data.reports) {
            if (data.reports.length === 0) {
                adminReportList.innerHTML = `<div class="text-xs text-zinc-500 text-center py-4">No active reports.</div>`;
                return;
            }
            adminReportList.innerHTML = data.reports.map((r, idx) => `
                <div class="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 text-xs space-y-2">
                    <div class="flex justify-between text-zinc-400">
                        <span class="font-bold text-slate-200">Report #${idx + 1}</span>
                        <span class="text-emerald-500">${escapeHtml(r.senderSchool)}</span>
                    </div>
                    <p class="text-zinc-400 italic">"${escapeHtml(r.message)}"</p>
                    <div class="text-[10px] text-zinc-600">${r.timestamp}</div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to load dashboard logs', e);
    }
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
    fetchAdminDashboardData();
});

socket.on('admin:actionError', (err) => alert('Error: ' + err));

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
