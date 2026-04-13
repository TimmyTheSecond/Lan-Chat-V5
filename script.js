console.log("Multi-Channel Chat Loaded! V26 - LiveObjects unique names + sidebar");

const ABLY_API_KEY = "75TknQ.C5wjCA:__3VQaPjaBwnTHpXhXT67kXBHkESR_2ixoRZJhYXQFg";

const channelPasswords = {
    "private-1": "smart456",
    "private-2": "yeah200"
};

// ==================== VARIABLES ====================
let uniqueClientId = localStorage.getItem("uniqueClientId") || `user-${Math.random().toString(36).substring(2)}${Date.now()}`;
localStorage.setItem("uniqueClientId", uniqueClientId);

let username = localStorage.getItem("username") || `Guest${Math.floor(Math.random() * 1000)}`;
localStorage.setItem("username", username);

let currentChannelName = "public-chat";
let realtime = null;
let chatClient = null;
let currentRoom = null;
let systemRoom = null;
let presenceChannel = null;
let usernamesMap = null; // LiveObjects LiveMap for unique names

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

// ==================== LIVE OBJECTS SETUP ====================
async function setupLiveObjects() {
    const channel = realtime.channels.get("global-usernames");
    await channel.attach();

    const { LiveMap } = window.AblyObjectsPlugin;
    let map = await channel.objects.get("usernames");

    if (!map) {
        await channel.objects.set("usernames", LiveMap.create({}));
        map = await channel.objects.get("usernames");
    }
    usernamesMap = map;

    // Claim initial username
    if (await isUsernameTaken(username)) {
        username = `Guest${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem("username", username);
    }
    await claimUsername(username);
    console.log("✅ LiveObjects usernames initialized");
}

async function isUsernameTaken(desired) {
    if (!usernamesMap) return false;
    const value = await usernamesMap.get(desired);
    return value && value !== uniqueClientId;
}

async function claimUsername(desired) {
    if (!usernamesMap) return false;
    await usernamesMap.set(desired, uniqueClientId);
    return true;
}

async function releaseUsername(oldName) {
    if (!usernamesMap || !oldName) return;
    await usernamesMap.delete(oldName);
}

// ==================== INITIALIZE ====================
async function init() {
    realtime = new Ably.Realtime({
        key: ABLY_API_KEY,
        clientId: uniqueClientId,
        plugins: { LiveObjects: window.AblyObjectsPlugin }
    });

    chatClient = new AblyChat.ChatClient(realtime);

    await setupLiveObjects();
    await joinChatRoom(currentChannelName);

    // System room for lock
    systemRoom = await chatClient.rooms.get("system-control");
    await systemRoom.attach();
    systemRoom.messages.subscribe((msg) => {
        if (msg.name === "lockUpdate") {
            globalLocked = msg.data.globalLocked;
            if (msg.data.lockMessage) lockMessage = msg.data.lockMessage;
            updateLockUI();
        }
    });

    console.log("✅ Ably Chat + LiveObjects initialized");
}

// ==================== JOIN ROOM + PRESENCE ====================
async function joinChatRoom(roomName) {
    if (currentRoom) await currentRoom.detach();

    currentRoom = await chatClient.rooms.get(roomName);
    await currentRoom.attach();

    currentRoom.messages.subscribe((msg) => {
        addMessage(msg);
    });

    // Presence for "Who's Online"
    if (presenceChannel) {
        presenceChannel.presence.leave();
        presenceChannel.presence.unsubscribe();
    }
    presenceChannel = realtime.channels.get(roomName);
    await presenceChannel.presence.enter({ username });

    presenceChannel.presence.subscribe((pm) => {
        if (["enter", "leave", "update"].includes(pm.action)) renderOnlineUsers();
    });

    renderOnlineUsers();
    document.getElementById("currentChannelDisplay").textContent = roomName.replace(/-/g, " ").toUpperCase();
}

function renderOnlineUsers() {
    if (!presenceChannel) return;
    presenceChannel.presence.get().then(members => {
        const list = document.getElementById("onlineList");
        list.innerHTML = "";
        members.forEach(m => {
            const li = document.createElement("li");
            li.textContent = m.data?.username || m.clientId;
            list.appendChild(li);
        });
    });
}

// ==================== ADD MESSAGE (now uses display username) ====================
function addMessage(msg) {
    const div = document.createElement("div");
    div.classList.add("message");

    const displayName = msg.username || msg.clientId || "Unknown";
    const text = msg.text || "";

    div.innerHTML = `<strong>${displayName}:</strong> ${text}`;

    if (msg.attachment) {
        div.innerHTML += `<br><img src="${msg.attachment.url}" style="max-width:100%; border-radius:8px; margin-top:8px;">`;
    }

    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}

// ==================== SEND MESSAGES (include username) ====================
async function sendTextMessage() {
    if (!currentRoom) return;
    const text = messageInput.value.trim();
    if (!text) return;

    await currentRoom.messages.send({ text, username });
    messageInput.value = "";
}

imageUpload.addEventListener("change", async () => {
    const file = imageUpload.files[0];
    if (!file || !currentRoom) return;

    const reader = new FileReader();
    reader.onload = async () => {
        await currentRoom.messages.send({
            attachment: { url: reader.result, name: file.name, type: file.type },
            username
        });
    };
    reader.readAsDataURL(file);
});

// ==================== NAME CHANGE (LiveObjects unique check) ====================
nameBtn.addEventListener("click", changeName);
nameInput.addEventListener("keydown", e => { if (e.key === "Enter") changeName(); });

async function changeName() {
    const newName = nameInput.value.trim();
    if (!newName || newName === username) return;

    if (await isUsernameTaken(newName)) {
        alert("❌ Username already taken!");
        return;
    }

    await releaseUsername(username);
    await claimUsername(newName);

    username = newName;
    localStorage.setItem("username", username);

    // Update presence in current channel
    if (presenceChannel) {
        await presenceChannel.presence.update({ username });
    }

    alert(`✅ Name changed to ${username}`);
    nameInput.value = "";
}

// ==================== CHANNEL SWITCH + ACTIVE CLASS ====================
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

    // Update active button
    document.querySelectorAll("#channels button").forEach(b => b.classList.remove("active"));
    const activeBtn = document.querySelector(`#channels button[data-channel="${newChannel}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    currentChannelName = newChannel;
    joinChatRoom(newChannel);
}

// ==================== LOCK / COMMANDS (unchanged) ====================
function handleCommand(cmd) { ... } // same as before
function broadcastLock() { ... }
function updateLockUI() { ... }

// ==================== START APP ====================
async function startApp() {
    const loadingScreen = document.getElementById("loadingScreen");
    loadingScreen.style.display = "flex";

    try {
        await init();

        // Set initial active channel
        document.querySelector(`#channels button[data-channel="${currentChannelName}"]`).classList.add("active");

        loadingScreen.style.display = "none";
        console.log("Multi-Channel Chat Loaded! V26 - LiveObjects + sidebar");
    } catch (error) {
        console.error("❌ Failed to initialize:", error);
        loadingScreen.innerHTML = `Error:<br>${error.message}<br><br>Refresh to try again.`;
    }
}

startApp();
