import React, { useState, useEffect } from "react";
import { useAdminContext } from "../../context/AdminContext";
import { toast } from "react-toastify";
import "./ManageTestimonials.css";

const ManageTestimonials = () => {
  const { fetchTestimonials, approveTestimonial, deleteTestimonial } = useAdminContext();
  const [testimonials, setTestimonials] = useState([]);
  const [selected, setSelected] = useState(null);

  const loadTestimonials = async () => {
    try {
      const data = await fetchTestimonials();
      setTestimonials(data);
    } catch {
      toast.error("Failed to fetch testimonials.");
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveTestimonial(id);
      toast.success("Testimonial approved!");
      setSelected(null);
      loadTestimonials();
    } catch {
      toast.error("Error approving testimonial.");
    }
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this testimonial?");
    if (!confirm) return;
    try {
      await deleteTestimonial(id);
      toast.success("Testimonial deleted.");
      setSelected(null);
      loadTestimonials();
    } catch {
      toast.error("Error deleting testimonial.");
    }
  };

  useEffect(() => {
    loadTestimonials();
  }, []);

  return (
    <div className="manage-testimonials">
      <h2>Manage Testimonials</h2>
      {testimonials.length === 0 ? (
        <p>No testimonials found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Message</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {testimonials.map((t) => (
              <tr key={t.id}>
                <td>
                  <img
                    src={t.image || "/default-avatar.png"}
                    alt={t.name}
                    className="testimonial-table-avatar"
                  />
                </td>
                <td>{t.name}</td>
                <td>{t.message.slice(0, 40)}...</td>
                <td>{t.rating} ⭐</td>
                <td>{t.status}</td>
                <td>
                  {t.createdAt?.seconds
                    ? new Date(t.createdAt.seconds * 1000).toLocaleString()
                    : "N/A"}
                </td>
                <td>
                  <button
                    className="view-btn"
                    onClick={() => setSelected(t)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* modal */}
      {selected && (
        <div className="testimonial-modal-overlay" onClick={() => setSelected(null)}>
          <div className="testimonial-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>
              &times;
            </button>
            <img
              src={selected.image || "/default-avatar.png"}
              alt={selected.name}
              className="testimonial-modal-avatar"
            />
            <h3>{selected.name}</h3>
            <div className="testimonial-modal-rating">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < selected.rating ? "filled-star" : ""}>⭐</span>
              ))}
            </div>
            <p className="testimonial-modal-message">"{selected.message}"</p>
            <p className="testimonial-modal-status">
              <strong>Status:</strong> {selected.status}
            </p>
            <div className="testimonial-modal-actions">
              {selected.status === "pending" && (
                <button className="approve-btn" onClick={() => handleApprove(selected.id)}>
                  Approve
                </button>
              )}
              <button className="delete-btn" onClick={() => handleDelete(selected.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTestimonials;
