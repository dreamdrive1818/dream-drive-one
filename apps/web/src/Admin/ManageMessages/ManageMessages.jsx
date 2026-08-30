import React, { useEffect, useState } from "react";
import { useAdminContext } from "../../context/AdminContext";
import "./ManageMessages.css";
import { toast } from "react-toastify";

const ManageMessages = () => {
  const { fetchMessages } = useAdminContext();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await fetchMessages();
        setMessages(data);
      } catch (err) {
        toast.error("Failed to load messages.");
      }
    };

    loadMessages();
  }, []);

  return (
    <div className="manage-messages">
      <h2>Customer Messages</h2>
      {messages.length === 0 ? (
        <p>No messages found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Message</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => (
              <tr key={msg.id}>
                <td>{msg.first} {msg.last}</td>
                <td>{msg.email}</td>
                <td>{msg.phone || "-"}</td>
                <td>{msg.message}</td>
                <td>{new Date(msg.createdAt?.seconds * 1000).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManageMessages;
