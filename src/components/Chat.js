import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Chat = ({ token, username, setToken }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const [chatPartner, setChatPartner] = useState(null);
  const [typingStatus, setTypingStatus] = useState('');
  const socket = useRef(null);
  const navigate = useNavigate();
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    socket.current = io('http://localhost:3001', {
      auth: {
        token: token
      }
    });

    socket.current.on('private message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    socket.current.on('user connected', (user) => {
      setUsers((prevUsers) => {
        const userExists = prevUsers.some((u) => u._id === user._id);
        if (!userExists) {
          return [...prevUsers, user];
        }
        return prevUsers.map((u) =>
          u._id === user._id ? { ...u, status: 'online' } : u
        );
      });
    });

    socket.current.on('user disconnected', (user) => {
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u._id === user._id ? { ...u, status: 'offline' } : u
        )
      );
    });

    socket.current.on('typing', (data) => {
      if (data.username === chatPartner?.username) {
        setTypingStatus(`${data.username} is typing...`);
      }
    });

    socket.current.on('stop typing', (data) => {
      if (data.username === chatPartner?.username) {
        setTypingStatus('');
      }
    });

    return () => {
      socket.current.disconnect();
    };
  }, [token, chatPartner]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/users');
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users', error);
      }
    };

    fetchUsers();
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (input && chatPartner) {
      socket.current.emit('private message', input, chatPartner._id);
      socket.current.emit('stop typing', chatPartner._id); // Stop typing event
      setInput(''); // Clear the input field
    }
  };

  const handleLogout = () => {
    setToken('');
    navigate('/login');
  };

  const selectChatPartner = (user) => {
    setChatPartner(user);
    setMessages([]);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.current.emit('typing', chatPartner._id);
    typingTimeoutRef.current = setTimeout(() => {
      socket.current.emit('stop typing', chatPartner._id);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-500 text-white p-4 flex justify-between items-center">
        <div>
          Logged in as: <strong>{username}</strong>
        </div>
        <button
          className="bg-red-500 px-4 py-2 rounded-lg"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>
      <div className="flex flex-1">
        <div className="w-1/4 bg-white border-r overflow-y-auto">
          <ul className="p-4 space-y-2">
            {users.map((user) => (
              <li
                key={user._id}
                className={`p-2 rounded-lg cursor-pointer ${user.status === 'online' ? 'bg-green-100' : 'bg-gray-100'}`}
                onClick={() => selectChatPartner(user)}
              >
                {user.username} - {user.status}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 flex flex-col">
          {chatPartner ? (
            <>
              <header className="bg-blue-500 text-white p-4 flex justify-between items-center">
                <div>
                  Chatting with: <strong>{chatPartner.username}</strong> - Status: <strong>{chatPartner.status}</strong>
                </div>
              </header>
              <div className="flex-1 overflow-auto p-4">
                <ul className="space-y-4">
                  {messages.map((msg, index) => (
                    <li key={index} className="bg-white p-4 rounded-lg shadow">
                      <div className="text-sm text-gray-500">
                        {msg.username} - {moment(msg.timestamp).format('HH:mm')}
                      </div>
                      <div>{msg.content}</div>
                    </li>
                  ))}
                </ul>
                {typingStatus && (
                  <div className="text-sm text-gray-500 p-4">
                    {typingStatus}
                  </div>
                )}
              </div>
              <form className="flex p-4 bg-white shadow" onSubmit={sendMessage}>
                <input
                  id="input"
                  className="flex-1 border border-gray-300 p-2 rounded-lg"
                  autoComplete="off"
                  value={input}
                  onChange={handleInputChange}
                />
                <button className="ml-2 bg-blue-500 text-white px-4 py-2 rounded-lg">Send</button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">Select a user to start a conversation</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
