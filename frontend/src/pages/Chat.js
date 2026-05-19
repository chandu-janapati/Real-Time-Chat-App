import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { jwtDecode } from "jwt-decode";
// let socket = null; // ✅ prevent multiple sockets

function Chat() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [search, setSearch] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socket = useSocket();
  const navigate = useNavigate();
  const selectedUserRef = useRef("");
  const typingTimeoutRef = useRef(null);
  const currentUser = localStorage.getItem("username") || "";
  const token = localStorage.getItem("access");
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [filter, setFilter] = useState("all");
  const [chatList, setChatList] = useState([]);
  const selectedChat = chatList.find(u => u.username === selectedUser);
  const [editingMsg, setEditingMsg] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
const [selectedMsgs, setSelectedMsgs] = useState([]);
const [editText, setEditText] = useState("");
  const isExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

  const safeSend = (data) => {
  if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
    console.warn("❌ send failed:", data);
    return;
  }
  socket.current.send(JSON.stringify(data));
};
useEffect(() => {
  selectedUserRef.current = selectedUser;
}, [selectedUser]);
  // ===== AUTO SCROLL =====
  const bottomRef = useRef();

useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
  // ===== NORMALIZE =====
  const normalize = (msg) => ({
    ...msg,
    timestamp: msg.created_at || msg.timestamp,
  });

  // ===== DATE =====
  const getDateLabel = (ts) => {
    const d = new Date(ts);
    if (isNaN(d)) return "";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    return d.toLocaleDateString("en-GB");
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const groupMessages = (msgs) => {
    return msgs.reduce((acc, msg) => {
      const date = getDateLabel(msg.timestamp);
      if (!acc[date]) acc[date] = [];
      acc[date].push(msg);
      return acc;
    }, {});
  };
//==============socket extra ==============
useEffect(() => {

  if (!token || isExpired(token)) {
    localStorage.clear();
    navigate("/login");
    return;
  }

  socket.current = new WebSocket(`ws://127.0.0.1:8000/ws/chat/?token=${token}`);

  socket.current.onopen = () => {
  console.log("✅ WS connected");

  const queue = JSON.parse(localStorage.getItem("queue") || "[]");

  queue.forEach(msg => {
    socket.current.send(JSON.stringify({
      action: "send",
      receiver: msg.receiver,
      message: msg.content,
      temp_id: msg.temp_id
    }));
  });

  localStorage.removeItem("queue");
};

  socket.current.onclose = () => {
  console.log("❌ WS closed");

  //localStorage.clear();   // 🔥 kill bad token
  //navigate("/login");
};

  socket.current.onmessage = (e) => {
    const data = JSON.parse(e.data);
    console.log("WS DATA:", data); 
    if (data.type === "chat_message") {

  // ✅ ALWAYS compute first
  const otherUser =
    data.sender === currentUser ? data.receiver : data.sender;

  const isActiveChat = selectedUserRef.current === otherUser;

  // ✅ 1. ALWAYS update sidebar FIRST
  setChatList(prev => {
    let updated = [...prev];

    const index = updated.findIndex(u => u.username === otherUser);

    if (index !== -1) {
      const old = updated[index];

      const chat = {
        ...old,
        last_message: data.content,
        timestamp: data.timestamp,
        unread:
          data.sender !== currentUser && !isActiveChat
            ? (old.unread || 0) + 1
            : old.unread
      };

      updated.splice(index, 1);
      updated.unshift(chat);
    }

    return updated;
  });

  // ✅ 2. THEN update messages
  if (isActiveChat) {
    setMessages(prev => {
  // 🔥 1. if temp_id matches → replace temp message
  const index = prev.findIndex(m => m.temp_id === data.temp_id);

  if (index !== -1) {
    const updated = [...prev];

    updated[index] = {
      ...data,
      timestamp: data.timestamp,
      status: "sent"
    };

    updated.sort((a, b) =>
  new Date(a.timestamp) - new Date(b.timestamp)
);

return updated;
  }

  // 🔥 2. fallback → prevent duplicates
  const exists = prev.some(m => m.id === data.id);
  if (exists) return prev;

  const updated = [...prev, {
  ...data,
  timestamp: data.timestamp
}];

updated.sort((a, b) =>
  new Date(a.timestamp) - new Date(b.timestamp)
);

return updated;
});

    // ✅ SAFE: use data.sender instead of otherUser
    safeSend({
      action: "seen",
      sender: data.sender   // 🔥 FIXED (no dependency on otherUser)
    });
  }
}

if (data.type === "typing") {
  setTypingUser(data.sender);

  setTimeout(() => {
    setTypingUser("");
  }, 1000);
    }
    if (data.type === "online_users") {
  setOnlineUsers(data.users);
}

    if (data.type === "seen_update") {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.message_id
            ? { ...msg, is_seen: true }
            : msg
        )
      );
    }
    if (data.event === "message_edited") {
  setMessages(prev =>
    prev.map(m =>
      m.id === data.message_id
        ? { ...m, content: data.content, edited: true }
        : m
    )
  );
}
if (data.event === "message_deleted") {
  setMessages(prev =>
    prev.filter(m => m.id !== data.message_id)
  );
}

if (data.event === "messages_deleted") {
  setMessages(prev =>
    prev.filter(m => !data.message_ids.includes(m.id))
  );
}
  };

}, []);
const retryMessage = (msg) => {
  socket.current.send(JSON.stringify({
    action: "send",
    receiver: msg.receiver,
    message: msg.content,
    temp_id: msg.temp_id
  }));

  setMessages(prev =>
    prev.map(m =>
      m.temp_id === msg.temp_id
        ? { ...m, status: "sending" }
        : m
    )
  );
};

useEffect(() => {
  if (!selectedUser) return;

  if (socket.current?.readyState === WebSocket.OPEN) {
    socket.current.send(JSON.stringify({
      action: "seen",
      sender: selectedUser
    }));
  }
}, [selectedUser]);

useEffect(() => {
  const pingInterval = setInterval(() => {
    if (socket.current?.readyState === 1) {
      socket.current.send(JSON.stringify({ action: "ping" }));
    }
  }, 25000);



  return () => {
    clearInterval(pingInterval);
  };
}, []);
  // ===== USERS + LAST MESSAGES=====

  // ===== LOAD MESSAGES =====
  useEffect(() => {
  if (!selectedUser) return;

  /* ✅ reset unread map
  setUnread((prev) => ({
    ...prev,
    [selectedUser]: 0,
  }));
  */

  // ✅ ALSO reset inside chatList (THIS IS WHAT YOU ADD)
  setChatList(prev =>
    prev.map(u =>
      u.username === selectedUser
        ? { ...u, unread: 0 }
        : u
    )
  );

  setMessages([]);

  const token = localStorage.getItem("access");

  fetch(
    `http://127.0.0.1:8000/api/messages/?receiver=${selectedUser}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => {
      if (!Array.isArray(data)) {
  console.error("❌ Expected array but got:", data);
  return;
}

const normalized = data.map(normalize);

      setMessages(normalized);
/*
      if (normalized.length > 0) {
        setLastMessages((prev) => ({
          ...prev,
          [selectedUser]: normalized[normalized.length - 1],
        }));
      }
        */
    });

  setTimeout(() => {
    if (socket.current?.readyState === 1) {
      safeSend({
        action: "seen",
        sender: selectedUser,
      });
    }
  }, 300);

}, [selectedUser]);
//=========================================
useEffect(() => {
  const token = localStorage.getItem("access");

  fetch("http://127.0.0.1:8000/api/users/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(res => res.json())
    .then(data => {
      //console.log("CHAT LIST:", data);
      setChatList(data);   // 🔥 DIRECT
    });
}, []);
//==========================================
  const grouped = groupMessages(messages);

  // ===== SEND =====
  const sendMessage = () => {
  if (!message.trim()) return;

  const tempId = "temp-" + Date.now();

  const tempMsg = {
    id: tempId,
    temp_id: tempId,
    status: "sending",
    sender: currentUser,
    receiver: selectedUser,
    content: message,
    timestamp: new Date().toISOString(),
    is_seen: false,
    is_delivered: false
  };

  // ✅ show instantly
  setMessages(prev => {
  const updated = [...prev, tempMsg];

  updated.sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  return updated;
});

  // ✅ update sidebar
  setChatList(prev => {
    let updated = [...prev];
    const index = updated.findIndex(u => u.username === selectedUser);

    if (index !== -1) {
      const old = updated[index];

      const chat = {
        ...old,
        last_message: message,
        timestamp: tempMsg.timestamp
      };

      updated.splice(index, 1);
      updated.unshift(chat);
    }

    return updated;
  });

  // ❌ socket not ready → mark failed
  if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
    setMessages(prev =>
      prev.map(m =>
        m.temp_id === tempId
          ? { ...m, status: "failed" }
          : m
      )
    );
    return;
  }

  // ✅ send
  socket.current.send(JSON.stringify({
    action: "send",
    receiver: selectedUser,
    message: message,
    temp_id: tempId
  }));

  setMessage("");
};

  // ===== LOGOUT =====
  const logout = () => {
    localStorage.clear();
    if (socket.current) {
  socket.current.close();
  socket.current = null;
}
    navigate("/login");
  };

  useEffect(() => {
  const closeMenu = () => setShowMenu(false);
  window.addEventListener("click", closeMenu);

  return () => window.removeEventListener("click", closeMenu);
}, []);
const editMessage = (msg) => {
  setEditingMsg(msg);
  setEditText(msg.content);
};

const deleteMessage = (msg) => {
  socket.current.send(JSON.stringify({
    action: "delete",
    message_id: msg.id
  }));
};
useEffect(() => {
  const close = () => setContextMenu(null);
  window.addEventListener("click", close);
  return () => window.removeEventListener("click", close);
}, []);

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
  <span style={{ fontWeight: "bold" }}>Chats</span>
  <input
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Search or start a new chat"
  style={{
    width: "90%",
    margin: "10px",
    padding: "10px 14px",
    borderRadius: "20px",
    border: "none",
    outline: "none",
    background: "#202c33",
    color: "#d1d7db",
    fontSize: "14px"
  }}
/>


  <div style={{ position: "relative" }}>
    {/* THREE DOT */}
    <span
      style={styles.menuBtn}
      onClick={(e) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
      }}
    >
      ⋮
    </span>

    {/* DROPDOWN */}
    {showMenu && (
      <div style={styles.dropdown}>
        <div
  style={styles.dropdownItem}
  onClick={() => navigate("/profile")}
>
  Profile
</div>
        <div
          style={styles.dropdownItem}
          onClick={() => {
            localStorage.clear();
            if (socket.current) {
  socket.current.close();
  socket.current = null;
}
            navigate("/login");
          }}
        >
          Logout
        </div>
      </div>
    )}
  </div>
</div>

<div style={{ display: "flex", gap: "8px", padding: "10px" }}>
  <button
  style={filter === "all" ? styles.filterActive : styles.filter}
  onClick={() => setFilter("all")}
>
  All
</button>

<button
  style={filter === "unread" ? styles.filterActive : styles.filter}
  onClick={() => setFilter("unread")}
>
  Unread
</button>
</div>
        {chatList
  .filter(u => {
    if (filter === "unread") return u.unread > 0;
    return true;
  })
  .filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )
  .map(u => (
      <div
  key={u.id}
  onClick={() => setSelectedUser(u.username)}
  onMouseEnter={(e) => {
    if (selectedUser !== u.username)
      e.currentTarget.style.background = "#202c33";
  }}

  onMouseLeave={(e) => {
    if (selectedUser !== u.username)
      e.currentTarget.style.background = "transparent";
  }}

  style={{
    display: "flex",
    alignItems: "center",
    padding: "12px 15px",
    gap: "12px",
    cursor: "pointer",
    background: selectedUser === u.username ? "#2a3942" : "transparent",
    borderBottom: "1px solid #1f2c34"
  }}
>
  {/* AVATAR */}
  <img
    src={
      u.profile_pic
        ? `http://127.0.0.1:8000${u.profile_pic}`
        : "http://127.0.0.1:8000/media/default.png"
    }
    style={{
      width: "45px",
      height: "45px",
      borderRadius: "50%",
      objectFit: "cover"
    }}
  />

  {/* RIGHT SIDE */}
  <div style={{ flex: 1, minWidth: 0 }}>
    
    {/* TOP ROW */}
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <span style={{
        fontWeight: 500,
        fontSize: "15px"
      }}>
        {u.username}
      </span>

      <span style={{
        fontSize: "12px",
        color: u.unread > 0 ? "#00a884" : "#8696a0"
      }}>
        {u.timestamp
          ? new Date(u.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            })
          : ""}
      </span>
    </div>

    {/* BOTTOM ROW */}
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "4px"
    }}>
      <span style={{
        fontSize: "13px",
        color: "#8696a0",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "80%"
      }}>
        {u.last_message || "No messages yet"}
      </span>

      {/* UNREAD */}
      {u.unread > 0 && (
        <span style={{
          background: "#00a884",
          color: "#111",
          fontSize: "12px",
          borderRadius: "20px",
          padding: "4px 8px",
          fontWeight: "bold"
        }}>
          {u.unread}
        </span>
      )}
    </div>
  </div>
</div>
            )
        )}
      </div>

      {/* CHAT */}
      <div style={styles.chat}>
        {selectedUser ? (
          <>
            <div style={{
  padding: "12px",
  background: "#202c33",
  display: "flex",
  alignItems: "center",
  gap: "10px"
}}>

  <img
  src={
    selectedChat?.profile_pic
      ? `http://127.0.0.1:8000${selectedChat.profile_pic}`
      : "http://127.0.0.1:8000/media/default.png"
  }
    style={{ width: "35px", height: "35px", borderRadius: "50%" }}
  />
  <div>{selectedUser}</div>
</div>

  {/* 🔥 SELECT MODE BAR */}

{selectMode && (
  <div style={{
    
    
    height: "60px",
    background: "#202c33",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 15px",
    zIndex: 1000
  }}>
    
    {/* LEFT SIDE */}
    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
      
      {/* CLOSE */}
      <span
        style={{ cursor: "pointer", fontSize: "18px" }}
        onClick={() => {
          setSelectMode(false);
          setSelectedMsgs([]);
        }}
      >
        ✖
      </span>

      {/* COUNT */}
      <span style={{ fontSize: "16px" }}>
        {selectedMsgs.length} selected
      </span>
    </div>

    {/* DELETE */}
    <span
      style={{
        color: "#ff4d4f",
        cursor: "pointer",
        fontWeight: "500"
      }}
      onClick={() => {
  // 🔥 remove instantly (UI feels fast)
  setMessages(prev =>
    prev.filter(m => !selectedMsgs.includes(m.id))
  );

  socket.current.send(JSON.stringify({
    action: "bulk_delete",
    message_ids: selectedMsgs
  }));

  setSelectedMsgs([]);
  setSelectMode(false);
}}
    >
      Delete
    </span>
  </div>
)}


            <div style={styles.messages}>
  {Object.keys(grouped).map((date) => (
    <div key={date}>
      <div style={styles.date}>
  <span style={styles.dateText}>{date}</span>
</div>

      {grouped[date].map((msg) => {
        const isMine = msg.sender === currentUser;
        return (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: isMine ? "flex-end" : "flex-start",
              padding: "4px 10px",
            }}
          >
            <div
  style={{
    ...styles.bubble,
    background: selectedMsgs.includes(msg.id)
  ? "#2a3942"   // selected color
  : isMine
  ? "#005c4b"
  : "#202c33",
  }}

  onClick={() => {
    if (!selectMode) return;

    setSelectedMsgs(prev =>
      prev.includes(msg.id)
        ? prev.filter(id => id !== msg.id)
        : [...prev, msg.id]
    );
  }}

  onContextMenu={(e) => {
    e.preventDefault();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message: msg
    });
  }}
>
              <div style={{ display: "flex", alignItems: "center" }}>
  
  {selectMode && (
    <input
      type="checkbox"
      checked={selectedMsgs.includes(msg.id)}
      readOnly
      style={{ marginRight: "6px" }}
    />
  )}

  <div>
    {msg.content}

    {msg.edited && (
      <span style={{
        fontSize: "10px",
        marginLeft: "6px",
        opacity: 0.6
      }}>
        edited
      </span>
    )}
  </div>

</div>
              {msg.status === "failed" && (
  <div style={{ color: "red", fontSize: "12px", cursor: "pointer" }}
       onClick={() => retryMessage(msg)}>
    Retry
  </div>
)}

              <div style={styles.time}>
  {formatTime(msg.timestamp)}{" "}
  {isMine && (
  <span style={{ marginLeft: "5px", fontSize: "12px" }}>
    {msg.is_seen ? (
      <span style={{ color: "#00A8FF" }}>✓✓</span>   // seen
    ) : msg.is_delivered ? (
      <span>✓✓</span>                               // delivered
    ) : (
      <span>✓</span>                                // sent
    )}
  </span>
)}
</div>
            </div>
          </div>
        );
      })}
    </div>
  ))}
  <div ref={bottomRef}></div>
</div>

            {/* TYPING */}
            {typingUser === selectedUser && (
  <div style={{ padding: "5px", fontSize: "12px", color: "#8696a0" }}>
    typing<span className="dots"></span>
  </div>
)}

{editingMsg && (
  <div style={{
    background: "#202c33",
    padding: "10px",
    borderTop: "1px solid #2a3942"
  }}>
    <div style={{ fontSize: "12px", color: "#00a884" }}>
      Editing message
    </div>

    <div style={{
      background: "#111b21",
      padding: "8px",
      borderRadius: "6px",
      marginTop: "5px",
      fontSize: "13px"
    }}>
      {editingMsg.content}
    </div>

    <div style={{
      display: "flex",
      marginTop: "8px",
      gap: "8px"
    }}>
      <input
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        style={{
          flex: 1,
          padding: "8px",
          borderRadius: "20px",
          border: "none",
          outline: "none",
          background: "#2a3942",
          color: "white"
        }}
      />

      <button
        onClick={() => {
          socket.current.send(JSON.stringify({
            action: "edit",
            message_id: editingMsg.id,
            content: editText
          }));

          setEditingMsg(null);
          setEditText("");
        }}
        style={{
          background: "#00a884",
          border: "none",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          color: "white",
          cursor: "pointer"
        }}
      >
        ✔
      </button>

      <button
        onClick={() => {
          setEditingMsg(null);
          setEditText("");
        }}
        style={{
          background: "#202c33",
          border: "1px solid #8696a0",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          color: "#8696a0",
          cursor: "pointer"
        }}
      >
        ✖
      </button>
    </div>
  </div>
)}

            <div style={styles.inputBox}>
  <input
  style={styles.input}
  value={message}
  onChange={(e) => {
    setMessage(e.target.value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      safeSend({
        action: "typing",
        receiver: selectedUser
      });
    }, 300);
  }}
  placeholder="Type a message"
/>

  <button style={styles.send} onClick={sendMessage}>
    ➤
  </button>
</div>
          </>
        ) : (
          <div style={styles.empty}>
  <div style={styles.emptyBox}>
    <h2 style={{ color: "#8696a0" }}>Welcome</h2>
<p style={{ color: "#8696a0" }}>
  Select a chat to start messaging
</p>
  </div>
</div>
        )}
      </div>
      {contextMenu && (
  <div
    style={{
      position: "fixed",
      top: contextMenu.y,
      left: contextMenu.x,
      background: "#202c33",
      borderRadius: "6px",
      padding: "5px 0",
      zIndex: 1000,
      width: "150px"
    }}
  >
    
    <div
  style={styles.menuItem}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "#2a3942";
    e.currentTarget.style.color = "#00a884";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "#d1d7db";
  }}
  onClick={() => {
    editMessage(contextMenu.message);
    setContextMenu(null);
  }}
>
  ✏️   Edit
</div>

<div
  style={styles.menuItem}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "#2a3942";
    e.currentTarget.style.color = "#00a884";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "#d1d7db";
  }}
  onClick={() => {
    setSelectMode(true);
    setSelectedMsgs([contextMenu.message.id]);
    setContextMenu(null);
  }}
>
  ☑️ Select
</div>

    <div
  style={styles.menuItem}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "#2a3942";
    e.currentTarget.style.color = "#ff4d4f";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "#d1d7db";
  }}
  onClick={() => {
    socket.current.send(JSON.stringify({
      action: "delete",
      message_id: contextMenu.message.id
    }));
    setContextMenu(null);
  }}
>
  🗑   Delete
</div>
    
  </div>
)}
    </div>
    
  );
}

export default Chat;

// ===== STYLES (UNCHANGED) =====
const styles = {
  container: {
    display: "flex",
    height: "100vh",
    background: "#111b21",
    color: "white",
    fontFamily: "Arial",
  },

  sidebar: {
    width: "300px",
    background: "#111b21",
    borderRight: "1px solid #222",
  },

  sidebarHeader: {
    padding: "15px",
    background: "#202c33",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  chat: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  header: {
    padding: "15px",
    background: "#202c33",
    fontWeight: "bold",
  },

  messages: {
  flex: 1,
  overflowY: "auto",
  padding: "20px",
  background: "#0b141a",
  display: "flex",
  flexDirection: "column",
  gap: "8px"
},

  bubble: {
  padding: "10px 12px",
  borderRadius: "10px",
  maxWidth: "60%",
  color: "white",
  wordBreak: "break-word",      // 🔥 IMPORTANT
  whiteSpace: "pre-wrap",       // 🔥 IMPORTANT
},

  time: {
    fontSize: "10px",
    opacity: 0.6,
    textAlign: "right",
  },

  inputBox: {
    display: "flex",
    padding: "10px",
    background: "#202c33",
  },

  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "20px",
    border: "none",
    outline: "none",
  },

  send: {
    marginLeft: "10px",
    padding: "10px",
    borderRadius: "50%",
    background: "#00a884",
    border: "none",
    color: "white",
    cursor: "pointer",
  },

  date: {
  display: "flex",
  justifyContent: "center",
  margin: "15px 0",
},
dateText: {
  background: "#182229",
  padding: "5px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#aebac1",
},

  menuBtn: {
    cursor: "pointer",
    fontSize: "20px",
  },

  dropdown: {
  position: "absolute",
  right: 0,
  top: "40px",
  background: "#202c33",
  borderRadius: "5px",
  zIndex: 1000,        // 🔥 add this
},

  dropdownItem: {
    padding: "10px 20px",
    cursor: "pointer",
  },

currentUser: {
  fontSize: "14px",
},
empty: {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#0b141a",
},

emptyBox: {
  textAlign: "center",
  opacity: 0.6,
},

user: {
  padding: "12px 15px",
  cursor: "pointer",
  borderBottom: "1px solid #1f2c34",
  transition: "0.2s",
},

userHover: {
  background: "#202c33",
},
badge: {
  background: "#00a884",
  color: "white",
  borderRadius: "50%",
  padding: "4px 7px",
  fontSize: "12px",
  marginLeft: "5px"
},
filter: {
  background: "#202c33",
  color: "#8696a0",
  border: "none",
  padding: "6px 12px",
  borderRadius: "20px",
  cursor: "pointer"
},

filterActive: {
  background: "#00a884",
  color: "#111",
  border: "none",
  padding: "6px 12px",
  borderRadius: "20px",
  cursor: "pointer"
},
menuItem: {
  padding: "10px 15px",
  cursor: "pointer",
  transition: "0.15s ease",
  color: "#d1d7db"
}
};
const iconBtn = {
  background: "transparent",
  border: "none",
  color: "#ccc",
  fontSize: "18px",
  cursor: "pointer",
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};