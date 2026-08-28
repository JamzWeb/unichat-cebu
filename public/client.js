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
let storedAdminPass = ''; // Temporary cache for dynamic admin updates

// Online Counter
if (onlineCountNum) {
    socket.on('online-count-update', (count) => {
        onlineCountNum.textContent = count;
    });
}

// Check session on load
window.addEventListener('DOMContentLoaded', () => {
    const savedRoom = sessionStorage.getItem('unichat_room');
    const savedPartner = sessionStorage.getItem('unichat_partner');
    const savedHistory = sessionStorage.getItem('unichat_history');

    if (savedRoom && savedPartner) {
        currentRoom = savedRoom;
        const partnerInfo = JSON.parse(savedPartner);
        
        setupScreen.classList.add('hidden');
        chatFooter.classList.remove('hidden');
        
        chatMessages.innerHTML = `<div class="text-center text-emerald-400 text-xs my-3 bg-slate-900 py-2 rounded-lg border border-emerald-500/20">Reconnected with <strong>${partnerInfo.nickname}</strong> from <strong>${partnerInfo.school}</strong> (Restored Session) 🔄</div>`;
        
        if (savedHistory) {
            chatMessages.innerHTML += savedHistory;
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// Typing Indicator Emission
if (messageInput) {
    messageInput.addEventListener('input', () => {
        if (currentRoom) {
            socket.emit('typing', { room: currentRoom, isTyping: true });
        }
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            if (currentRoom) {
                socket.emit('typing', { room: currentRoom, isTyping: false });
            }
        }, 1000);
    });
}

socket.on('typing', (data) => {
    if (typingIndicator) {
        if (data.isTyping) {
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    }
});

// Matchmaking triggers
if (findBtn) {
    findBtn.addEventListener('click', () => {
        const nickname = document.getElementById('nicknameInput').value.trim() || 'Student';
        const school = document.getElementById('schoolSelect').value;

        localStorage.setItem('unichat_nickname', nickname);
        localStorage.setItem('unichat_school', school);

        socket.emit('find-stranger', { nickname, school });
        
        setupScreen.classList.add('hidden');
        chatMessages.innerHTML = `<div class="text-center text-slate-400 text-sm my-auto animate-pulse">Searching for a student match across Cebu campuses (${school})...</div>`;
    });
}

window.addEventListener('load', () => {
    const savedNick = localStorage.getItem('unichat_nickname');
    const savedSchool = localStorage.getItem('unichat_school');
    if (savedNick && document.getElementById('nicknameInput')) {
        document.getElementById('nicknameInput').value = savedNick;
    }
    if (savedSchool && document.getElementById('schoolSelect')) {
        document.getElementById('schoolSelect').value = savedSchool;
    }
});

socket.on('matched', (data) => {
    currentRoom = data.room;
    const partnerInfo = (data.partner1.id === socket.id) ? data.partner2 : data.partner1;

    sessionStorage.setItem('unichat_room', currentRoom);
    sessionStorage.setItem('unichat_partner', JSON.stringify(partnerInfo));
    sessionStorage.setItem('unichat_history', '');

    chatMessages.innerHTML = `<div class="text-center text-emerald-400 text-xs my-3 bg-slate-900 py-2 rounded-lg border border-emerald-500/20">Connected with <strong>${partnerInfo.nickname}</strong> from <strong>${partnerInfo.school}</strong>! Say hello 👋</div>`;
    chatFooter.classList.remove('hidden');
});

socket.on('waiting', () => {
    chatMessages.innerHTML = `<div class="text-center text-slate-400 text-sm my-auto animate-pulse">Looking for an available student in the queue...</div>`;
});

// Message Sending & Replying
if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoom) return;

    const msgId = 'msg_' + (++messageCounter);
    const messageData = {
        id: msgId,
        room: currentRoom,
        message: text,
        replyTo: replyingToMessage
    };

    socket.emit('chat-message', messageData);
    appendMessage(messageData.id, text, 'sent', replyingToMessage);

    cancelReply();
    messageInput.value = '';
}

socket.on('chat-message', (data) => {
    appendMessage(data.id, data.message, 'received', data.replyTo);
});

// Handle incoming official chat reactions from partner
socket.on('message-reaction', (data) => {
    const bubble = document.getElementById(data.msgId);
    if (bubble) {
        updateReactionDisplay(bubble, data.reaction);
    }
});

function appendMessage(msgId, text, type, replyContext = null) {
    const messageDiv = document.createElement('div');
    messageDiv.id = msgId || ('msg_' + (++messageCounter));
    messageDiv.className = `message-bubble max-w-[75%] p-3 rounded-lg text-sm relative group flex flex-col my-2 cursor-pointer touch-pan-y ${
        type === 'sent' ? 'ml-auto bg-emerald-600 text-white' : 'mr-auto bg-slate-800 text-slate-200'
    }`;

    let replyHtml = '';
    if (replyContext) {
        replyHtml = `<div class="bg-black/30 border-l-2 border-white/60 px-2 py-1 mb-1 text-xs rounded text-slate-300 italic">Replying to: "${replyContext}"</div>`;
    }

    messageDiv.innerHTML = `
        ${replyHtml}
        <span class="message-text">${text}</span>
        
        <!-- Official Reaction Picker Menu on Hover -->
        <div class="reaction-menu ${type === 'sent' ? 'right-0' : 'left-0'}">
            <button onclick="sendReaction('${messageDiv.id}', '❤️')">❤️</button>
            <button onclick="sendReaction('${messageDiv.id}', '😲')">😲</button>
            <button onclick="sendReaction('${messageDiv.id}', '☹')">☹</button>
            <button onclick="sendReaction('${messageDiv.id}', '👌')">👌</button>
        </div>

        <div class="reactions-container flex space-x-1 mt-1 text-xs"></div>
    `;

    // --- SWIPE TO REPLY LOGIC (Mobile Friendly) ---
    let touchStartX = 0;
    messageDiv.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });
    messageDiv.addEventListener('touchend', (e) => {
        let touchEndX = e.changedTouches[0].clientX;
        if (touchEndX - touchStartX > 60) { // Swiped right
            setReply(text);
        }
    });

    messageDiv.addEventListener('click', () => {
        setReply(text);
    });

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const currentHistory = sessionStorage.getItem('unichat_history') || '';
    sessionStorage.setItem('unichat_history', currentHistory + messageDiv.outerHTML);
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
    if (container) {
        container.innerHTML = `<span class="bg-slate-900/80 px-1.5 py-0.5 rounded-full border border-slate-700">${emoji}</span>`;
    }
}

window.setReply = function(text) {
    replyingToMessage = text;
    if (replyPreviewText && replyPreviewContainer) {
        replyPreviewText.textContent = text;
        replyPreviewContainer.classList.remove('hidden');
    }
    if (messageInput) messageInput.focus();
};

if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', cancelReply);
}

function cancelReply() {
    replyingToMessage = null;
    if (replyPreviewContainer) {
        replyPreviewContainer.classList.add('hidden');
    }
}

// Disconnect / Skip
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

// Feedback Modals
function openFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('hidden');
}

function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('hidden');
}

function submitFeedbackForm() {
    const type = document.getElementById('feedbackType').value;
    const message = document.getElementById('feedbackMsg').value.trim();
    const school = document.getElementById('schoolSelect')?.value || 'Unknown School';

    if (!message) {
        alert('Please write something before submitting.');
        return;
    }

    socket.emit('submit-feedback', { type, message, school });
    alert('Thank you! Your report/feedback has been sent securely.');
    document.getElementById('feedbackMsg').value = '';
    closeFeedbackModal();
}

// Crown / Staff Login Modals
function openAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
}

async function loginAsStaff() {
    const pass = document.getElementById('staffPassInput').value;
    storedAdminPass = pass; // Cache password for management actions
    try {
        const res = await fetch(`/api/admin/data?pass=${encodeURIComponent(pass)}`);
        if (!res.ok) {
            alert('Incorrect staff password!');
            return;
        }
        const data = await res.json();
        renderDashboardView(data);
        closeAuthModal();
    } catch (err) {
        alert('Server connection error.');
    }
}

function renderDashboardView(data) {
    let roleHeader = '';
    let adminExtraSection = '';

    if (data.role === 'admin') {
        roleHeader = '<span class="text-amber-400 font-bold">[MASTER ADMIN]</span>';
        
        let modRows = data.moderators.map(m => `
            <div class="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800 text-xs">
                <div>
                    <strong class="text-white">Slot ${m.id}:</strong> 
                    <span class="text-slate-300">${m.username}</span> 
                    <span class="text-[10px] px-2 py-0.5 rounded ${m.status === 'Active' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}">${m.status}</span>
                </div>
            </div>
        `).join('');

        adminExtraSection = `
            <div class="space-y-3 bg-slate-950 p-4 rounded-lg border border-amber-500/30">
                <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider">👑 Dynamic Account Credential Manager</h3>
                <p class="text-[11px] text-slate-400">Update Master Admin or any of the 5 Moderator slots instantly.</p>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select id="targetAccountSelect" class="bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs">
                        <option value="admin">Master Admin Account</option>
                        <option value="1">Moderator Slot 1</option>
                        <option value="2">Moderator Slot 2</option>
                        <option value="3">Moderator Slot 3</option>
                        <option value="4">Moderator Slot 4</option>
                        <option value="5">Moderator Slot 5</option>
                    </select>
                    <input type="text" id="newStaffUser" placeholder="New Username" class="bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs">
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="password" id="newStaffPass" placeholder="New Password" class="bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs">
                    <button onclick="submitStaffUpdate()" class="bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 rounded text-xs transition">Save Credential Changes</button>
                </div>

                <div class="mt-3 pt-3 border-t border-slate-800">
                    <p class="text-[11px] text-slate-400 mb-2">Current Active Moderator Slots:</p>
                    <div class="space-y-1.5">${modRows}</div>
                </div>
            </div>
        `;
    } else {
        roleHeader = `<span class="text-blue-400 font-bold">[MODERATOR: ${data.modName}]</span>`;
    }
    
    chatMessages.innerHTML = `
        <div class="max-w-2xl mx-auto w-full bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-6 shadow-xl my-4">
            <div class="flex justify-between items-center border-b border-slate-800 pb-3">
                <h2 class="text-base font-bold text-emerald-400">🛡️ Staff Dashboard ${roleHeader}</h2>
                <button onclick="location.reload()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded">Logout / Exit</button>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p class="text-xs text-slate-400">Online Users</p>
                    <p class="text-xl font-bold text-emerald-400">${data.onlineUsers}</p>
                </div>
                <div class="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p class="text-xs text-slate-400">Active Rooms</p>
                    <p class="text-xl font-bold text-blue-400">${data.activeRoomsCount}</p>
                </div>
            </div>

            ${adminExtraSection}

            <div class="space-y-2">
                <h3 class="text-xs font-bold text-red-400 uppercase tracking-wider">⚠️ User Reports & Chat Issues</h3>
                <div class="space-y-2 max-h-40 overflow-y-auto text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                    ${data.reports.length > 0 ? data.reports.map(r => `
                        <div class="border-b border-slate-800 pb-2 mb-2">
                            <div class="flex justify-between text-slate-400 text-[10px]"><span>From: ${r.senderSchool}</span><span>${r.timestamp}</span></div>
                            <p class="text-slate-200">${r.message}</p>
                        </div>
                    `).join('') : '<p class="text-slate-500 italic">No reports found.</p>'}
                </div>
            </div>

            <div class="space-y-2">
                <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-wider">💡 Suggestions & Bug Reports</h3>
                <div class="space-y-2 max-h-40 overflow-y-auto text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                    ${data.feedback.length > 0 ? data.feedback.map(f => `
                        <div class="border-b border-slate-800 pb-2 mb-2">
                            <div class="flex justify-between text-slate-400 text-[10px]">
                                <span class="text-emerald-400 font-bold uppercase">[${f.type}] from ${f.senderSchool}</span>
                                <span>${f.timestamp}</span>
                            </div>
                            <p class="text-slate-200">${f.message}</p>
                        </div>
                    `).join('') : '<p class="text-slate-500 italic">No suggestions or bug logs yet.</p>'}
                </div>
            </div>
        </div>
    `;
    
    if (chatFooter) chatFooter.classList.add('hidden');
}

function submitStaffUpdate() {
    const targetVal = document.getElementById('targetAccountSelect').value;
    const targetType = targetVal === 'admin' ? 'admin' : 'mod';
    const targetId = targetType === 'mod' ? targetVal : null;
    
    const newUsername = document.getElementById('newStaffUser').value.trim();
    const newPassword = document.getElementById('newStaffPass').value.trim();

    if (!newUsername && !newPassword) {
        alert('Please enter a new username or password to update.');
        return;
    }

    socket.emit('admin:updateStaff', {
        adminPass: storedAdminPass,
        targetType,
        targetId,
        newUsername,
        newPassword
    });
}

socket.on('admin:actionSuccess', async (msg) => {
    alert(msg);
    document.getElementById('newStaffUser').value = '';
    document.getElementById('newStaffPass').value = '';
    // Refresh dashboard view
    const res = await fetch(`/api/admin/data?pass=${encodeURIComponent(storedAdminPass)}`);
    if (res.ok) {
        renderDashboardView(await res.json());
    }
});

socket.on('admin:actionError', (err) => {
    alert('Error: ' + err);
});
