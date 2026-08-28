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
        e.preventDefault(); // Stop browser refresh

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

        // If logged in as staff, store password immediately and show the button right away!
        if (isStaff && staffPass) {
            storedAdminPass = staffPass;
            if (adminPanelBtn) {
                adminPanelBtn.style.display = 'inline-flex';
            }
        }

        // Request match via socket server
        socket.emit('find-stranger', { nickname, school, isStaff, staffPass });

        // Switch views from Auth to Chat Interface
        if (authView) authView.classList.add('hidden');
        if (chatView) {
            chatView.classList.remove('hidden');
            chatView.style.display = 'flex';
        }

        if (messageStream) {
            messageStream.innerHTML = `
                <div class="text-center my-2">
                    <span class="inline-block bg-zinc-900/80 border border-zinc-800 text-zinc-500 text-[11px] px-4 py-1.5 rounded-full font-mono animate-pulse">
                        Looking for an available student in the Cebu queue...
                    </span>
                </div>
            `;
        }
    });
}

// Handle staff chat credential validation error
socket.on('staff:chatError', (err) => {
    alert(err);
    location.reload();
});

// Matched with a partner
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

    // Ensure staff button stays visible if verified staff
    if (adminToggle && adminToggle.checked && adminPanelBtn) {
        adminPanelBtn.style.display = 'inline-flex';
        storedAdminPass = adminPasswordInput.value.trim();
    }
});

socket.on('waiting', () => {
    if (messageStream) {
        messageStream.innerHTML = `
            <div class="text-center my-2">
                <span class="inline-block bg-zinc-900/80 border border-zinc-800 text-zinc-500 text-[11px] px-4 py-1.5 rounded-full font-mono animate-pulse">
                    Waiting for another student to join the queue...
                </span>
            </div>
        `;
    }
});

// Send message triggers
if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function sendMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text || !currentRoom) return;

    const msgId = 'msg_' + (++messageCounter);
    const messageData = { id: msgId, room: currentRoom, message: text, replyTo: replyingToMessage };

    socket.emit('chat-message', messageData);
    appendMessage(msgId, text, 'sent', replyingToMessage);

    cancelReply();
    chatInput.value = '';
}

socket.on('chat-message', (data) => {
    appendMessage(data.id, data.message, 'received', data.replyTo);
});

socket.on('message-reaction', (data) => {
    const bubble = document.getElementById(data.msgId);
    if (bubble) updateReactionDisplay(bubble, data.reaction);
});

// Render message bubbles in the stream with reaction menus & reply context
function appendMessage(msgId, text, type, replyContext = null) {
    if (!messageStream) return;

    const messageDiv = document.createElement('div');
    messageDiv.id = msgId || ('msg_' + (++messageCounter));
    messageDiv.className = `message-bubble max-w-[75%] p-3 rounded-2xl text-sm relative group flex flex-col my-2 cursor-pointer ${
        type === 'sent' ? 'ml-auto bg-emerald-600 text-white rounded-br-sm' : 'mr-auto bg-zinc-900 text-slate-200 border border-zinc-800 rounded-bl-sm'
    }`;

    let replyHtml = replyContext ? `<div class="bg-black/30 border-l-2 border-white/60 px-2 py-1 mb-1 text-xs rounded text-zinc-300 italic">Replying to: "${escapeHtml(replyContext)}"</div>` : '';

    messageDiv.innerHTML = `
        ${replyHtml}
        <span class="break-words">${escapeHtml(text)}</span>
        <div class="reaction-menu ${type === 'sent' ? 'right-0' : 'left-0'}">
            <button onclick="sendReaction('${messageDiv.id}', '❤️')">❤️</button>
            <button onclick="sendReaction('${messageDiv.id}', '😲')">😲</button>
            <button onclick="sendReaction('${messageDiv.id}', '☹')">☹</button>
            <button onclick="sendReaction('${messageDiv.id}', '👌')">👌</button>
        </div>
        <div class="reactions-container flex space-x-1 mt-1 text-xs"></div>
    `;

    messageDiv.addEventListener('click', () => setReply(text));
    messageStream.appendChild(messageDiv);
    messageStream.scrollTop = messageStream.scrollHeight;
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
    if (container) container.innerHTML = `<span class="bg-zinc-950/80 px-1.5 py-0.5 rounded-full border border-zinc-800 text-[10px]">${emoji}</span>`;
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

// Skip / Leave chat functions
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
                <span class="inline-block bg-zinc-900/80 border border-zinc-800 text-zinc-500 text-[11px] px-4 py-1.5 rounded-full font-mono animate-pulse">
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

// Report current partner function
function reportCurrentPartner() {
    const reason = prompt('Please describe the reason for reporting this user:');
    if (!reason) return;
    
    const schoolName = currentPartner ? currentPartner.school : 'Unknown';
    socket.emit('submit-feedback', { type: 'report', message: reason, school: schoolName });
    alert('Report submitted successfully to moderators.');
}

// Admin / Moderator Dashboard Drawer & Data Fetching
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

// Utility HTML escape to prevent injection
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
