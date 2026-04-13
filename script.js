<script>
// Multi-Channel Chat V26 - Fixed loading + image sending + clean start
console.log("Multi-Channel Chat Loaded! V26 - Loading + Image + Clean start");

const ABLY_API_KEY = "75TknQ.C5wjCA:__3VQaPjaBwnTHpXhXT67kXBHkESR_2ixoRZJhYXQFg";

const channelPasswords = {
    "private-1": "smart456",
    "private-2": "yeah200"
};

// ==================== VARIABLES ====================
let username = localStorage.getItem("username") || "Guest" + Math.floor(Math.random() * 1000);
localStorage.setItem("username", username);

let currentChannelName = "public-chat";
let realtime = null;
let chatClient = null;
let currentRoom = null;
let systemRoom = null;

// Lock state
let globalLocked = false;
let lockMessage = "Under maintenance";

// DOM
const chatEl = document.getElementById("chat");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const nameInput = document.getElementById("nameInput");
const nameBtn = document.getElementById("nameBtn");
const imageBtn = document.getElementById("imageBtn");
const imageUpload = document.getElementById("imageUpload");

// ==================== INITIALIZE ====================
async function init() {
    realtime = new Ably.Realtime({ 
        key: ABLY_API_KEY, 
        clientId: username 
    });

    chatClient = new AblyChat.ChatClient(realtime);

    await joinChatRoom(currentChannelName);
    console.log(`✅ Joined room: ${currentChannelName}`);

    // System room for lock commands
    systemRoom = await chatClient.rooms.get("system-control");
    await systemRoom.attach();

    // Listen for lock updates
    systemRoom.messages.subscribe((msg) => {
        if (msg.name === "lockUpdate") {
            const data = msg.data;
            globalLocked = data.globalLocked;
            if (data.lockMessage) lockMessage = data.lockMessage;
            updateLockUI();
        }
    });

    console.log("✅ Ably Chat + Live Sync initialized successfully");
}

async function joinChatRoom(roomName) {
    if (currentRoom) await currentRoom.detach();

    currentRoom = await chatClient.rooms.get(roomName);
    await currentRoom.attach();

    currentRoom.messages.subscribe((msg) => {
        addMessage(msg);
    });
}

function addMessage(msg) {
    const div = document.createElement("div");
    div.classList.add("message");

    let html = `<strong>${msg.clientId}:</strong> `;
    if (msg.text) html += msg.text + " ";
    if (msg.attachment) {
        html += `<br><img src="${msg.attachment.url}" style="max-width:100%; border-radius:8px; margin-top:8px;">`;
    }

    div.innerHTML = html;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}

// ==================== COMMANDS & LOCK ====================
function handleCommand(cmd) {
    if (cmd === '!cmds') {
        console.log("%c📋 Commands:\n" +
                    "cmd('!cmds')\n" +
                    "cmd('!lock')\n" +
                    "cmd('!lockmessage Your message')\n" +
                    "cmd('!unlock')",
                    "color:#3b82f6; font-family:monospace");
        return;
    }

    if (cmd === '!lock') {
        globalLocked = true;
        lockMessage = "Under maintenance";
        broadcastLock();
        updateLockUI();
    } 
    else if (cmd.startsWith('!lockmessage ')) {
        const msg = cmd.substring(13).trim();
        if (msg) {
            globalLocked = true;
            lockMessage = msg;
            broadcastLock();
            updateLockUI();
        }
    } 
    else if (cmd === '!unlock') {
        globalLocked = false;
        broadcastLock();
        updateLockUI();
    }
}

function broadcastLock() {
    if (systemRoom) {
        systemRoom.messages.send({
            name: "lockUpdate",
            data: {
                globalLocked: globalLocked,
                lockMessage: lockMessage
            }
        });
    }
}

function updateLockUI() {
    const lockScreen = document.getElementById("lockScreen");
    const chatContainer = document.getElementById("chatContainer");
    const msgEl = document.getElementById("lockMessage");

    if (globalLocked) {
        msgEl.textContent = lockMessage;
        lockScreen.classList.add("show");
        chatContainer.style.display = "none";
    } else {
        lockScreen.classList.remove("show");
        chatContainer.style.display = "flex";
    }
}

// ==================== SEND MESSAGE ====================
sendBtn.addEventListener("click", sendTextMessage);
messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendTextMessage();
});

async function sendTextMessage() {
    if (!currentRoom) return;
    const text = messageInput.value.trim();
    if (!text) return;

    await currentRoom.messages.send({ text: text });
    messageInput.value = "";
}

// Image sharing - FIXED: always include text so Ably doesn't throw 400 error
imageBtn.addEventListener("click", () => imageUpload.click());
imageUpload.addEventListener("change", async () => {
    const file = imageUpload.files[0];
    if (!file || !currentRoom) return;

    const reader = new FileReader();
    reader.onload = async () => {
        await currentRoom.messages.send({
            text: "📸",                                      // ← required by Ably Chat
            attachment: {
                url: reader.result,
                name: file.name,
                type: file.type
            }
        });
    };
    reader.readAsDataURL(file);
    imageUpload.value = "";   // reset so same file can be re-selected
});

// Name change
nameBtn.addEventListener("click", changeName);
nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") changeName();
});

function changeName() {
    const newName = nameInput.value.trim();
    if (newName) {
        username = newName;
        localStorage.setItem("username", username);
        alert("Name changed to " + username);
        nameInput.value = "";
    }
}

// Switch channel
function switchChannel(newChannel) {
    if (globalLocked) return;
    if (newChannel === currentChannelName) return;

    if (channelPasswords[newChannel]) {
        const entered = prompt("Enter password for this channel:");
        if (entered !== channelPasswords[newChannel]) {
            alert("Wrong password.");
            return;
        }
    }

    currentChannelName = newChannel;
    joinChatRoom(newChannel);
}

// ==================== START APP (clean + awaited) ====================
async function startApp() {
    const loadingScreen = document.getElementById("loadingScreen");
    
    loadingScreen.style.display = "flex";   // show immediately

    try {
        await init();   // ← everything now properly awaited
        console.log("✅ Multi-Channel Chat + Ably Live Sync ready (V26)");
        loadingScreen.style.display = "none";   // ← loading screen disappears here

    } catch (error) {
        console.error("❌ Failed to initialize chat:", error);
        loadingScreen.innerHTML = `
            <div style="color:#ef4444; text-align:center; padding:20px; font-size:18px;">
                Error starting chat:<br>
                ${error.message}<br><br>
                Refresh the page to try again.
            </div>`;
    }
}

// Kick it off (only once)
startApp();
</script>
