console.log("Multi-Channel Chat Loaded! V23 - Ably Chat SDK FIXED");

// ==================== CONFIG ====================
const ABLY_API_KEY = "75TknQ.C5wjCA:__3VQaPjaBwnTHpXhXT67kXBHkESR_2ixoRZJhYXQFg"; 

const channelPasswords = {
    "private-1": "smart456",
    "private-2": "yeah200"
};

// ==================== VARIABLES ====================
let username = localStorage.getItem("username") || "Guest" + Math.floor(Math.random() * 1000);
localStorage.setItem("username", username);

let currentChannelName = "public-chat";
let chatClient = null;
let currentRoom = null;
let systemRoom = null;

// DOM
const chatEl = document.getElementById("chat");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const nameInput = document.getElementById("nameInput");
const nameBtn = document.getElementById("nameBtn");
const imageBtn = document.getElementById("imageBtn");
const imageUpload = document.getElementById("imageUpload");

// Lock state
let globalLocked = false;
let lockMessage = "Under maintenance";

// ==================== INIT ====================
async function init() {
    try {
        const realtime = new Ably.Realtime({
            key: ABLY_API_KEY,
            clientId: username
        });

        // ✅ FIX: use AblyChat
        chatClient = new AblyChat.ChatClient(realtime);

        // Wait for connection
        realtime.connection.once("connected", () => {
            console.log("✅ Connected to Ably");
        });

        // Join rooms
        await joinChatRoom(currentChannelName);

        systemRoom = await chatClient.rooms.get("system-control");
        await systemRoom.attach();

        // Listen for lock updates
        systemRoom.subscribe("lockUpdate", (msg) => {
            globalLocked = msg.data.globalLocked;
            lockMessage = msg.data.lockMessage;
            updateLockUI();
        });

        document.getElementById("loadingScreen").style.display = "none";

        console.log("✅ Ably Chat fully initialized");
    } catch (err) {
        console.error("❌ Init error:", err);
    }
}

// ==================== JOIN ROOM ====================
async function joinChatRoom(roomName) {
    try {
        if (currentRoom) {
            await currentRoom.detach();
        }

        currentRoom = await chatClient.rooms.get(roomName);
        await currentRoom.attach();

        chatEl.innerHTML = "";

        // ✅ Messages
        currentRoom.messages.subscribe((msg) => {
            addMessage(msg);
        });

        // Typing
        currentRoom.typing.subscribe((typing) => {
            console.log("Typing:", typing);
        });

        // Reactions
        currentRoom.reactions.subscribe((reaction) => {
            console.log("Reaction:", reaction);
        });

        console.log("✅ Joined room:", roomName);
    } catch (err) {
        console.error("❌ Room join error:", err);
    }
}

// ==================== ADD MESSAGE ====================
function addMessage(msg) {
    const div = document.createElement("div");
    div.classList.add("message");

    const text = msg.text || msg.data?.text || "";
    const attachment = msg.attachment || msg.data?.attachment;

    div.innerHTML = `<strong>${msg.clientId}:</strong> ${text}`;

    if (attachment?.url) {
        div.innerHTML += `<br><img src="${attachment.url}" style="max-width:100%;border-radius:8px;">`;
    }

    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}

// ==================== SEND MESSAGE ====================
sendBtn.addEventListener("click", sendTextMessage);
messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendTextMessage();
});

async function sendTextMessage() {
    if (!currentRoom || globalLocked) return;

    const text = messageInput.value.trim();
    if (!text) return;

    try {
        await currentRoom.messages.send({ text });
        messageInput.value = "";
    } catch (err) {
        console.error("❌ Send error:", err);
    }
}

// ==================== IMAGE ====================
imageBtn.addEventListener("click", () => imageUpload.click());

imageUpload.addEventListener("change", async () => {
    const file = imageUpload.files[0];
    if (!file || !currentRoom || globalLocked) return;

    const reader = new FileReader();
    reader.onload = async () => {
        try {
            await currentRoom.messages.send({
                attachment: {
                    url: reader.result,
                    name: file.name,
                    type: file.type
                }
            });
        } catch (err) {
            console.error("❌ Image send error:", err);
        }
    };
    reader.readAsDataURL(file);
});

// ==================== NAME ====================
nameBtn.addEventListener("click", changeName);
nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") changeName();
});

function changeName() {
    const newName = nameInput.value.trim();
    if (!newName) return;

    username = newName;
    localStorage.setItem("username", username);

    alert("Name changed! Refresh to apply.");
    nameInput.value = "";
}

// ==================== CHANNEL SWITCH ====================
function switchChannel(newChannel) {
    if (globalLocked) return;
    if (newChannel === currentChannelName) return;

    if (channelPasswords[newChannel]) {
        const pass = prompt("Enter password:");
        if (pass !== channelPasswords[newChannel]) {
            alert("Wrong password.");
            return;
        }
    }

    currentChannelName = newChannel;
    joinChatRoom(newChannel);
}

// ==================== LOCK SYSTEM ====================
function handleCommand(cmd) {
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
    if (!systemRoom) return;

    systemRoom.publish("lockUpdate", {
        globalLocked,
        lockMessage
    });
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

// ==================== START ====================
init();
