import React, { useEffect, useState } from "react";
import { useAdminContext } from "../../context/AdminContext";
import { toast } from "react-toastify";
import "./ManageUser.css";

const ManageUser = () => {
  const { fetchUsers, deleteUser } = useAdminContext();
  const [users, setUsers] = useState([]);

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      toast.error("Failed to fetch users.");
    }
  };

  const handleDelete = async (userId, name) => {
    const confirm = window.confirm(`Are you sure you want to delete user "${name}"?`);
    if (!confirm) return;

    try {
      await deleteUser(userId);
      loadUsers(); // Refresh after deletion
    } catch {
      toast.error("Error deleting user.");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="manage-users">
      <h2>Manage Users</h2>
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Registered On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.fullName || "N/A"}</td>
                <td>{user.email}</td>
                <td>{user.phone || "-"}</td>
                <td>{user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleString() : "N/A"}</td>
                <td>
                  <button className="delete-btn" onClick={() => handleDelete(user.id, user.fullName)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManageUser;
