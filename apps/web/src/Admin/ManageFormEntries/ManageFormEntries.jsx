import React, { useEffect, useState } from "react";
import { useAdminContext } from "../../context/AdminContext";
import Modal from "react-modal";
import "./ManageFormEntries.css";
import { toast } from "react-toastify";

Modal.setAppElement("#root");

const ManageFormEntries = () => {
  const { fetchFormEntries, deleteFormEntry } = useAdminContext();
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("entry");

  useEffect(() => {
    const loadEntries = async () => {
      try {
        const data = await fetchFormEntries();
        setEntries(data);
      } catch (err) {
        console.error("Failed to load entries:", err);
      }
    };
    loadEntries();
  }, [fetchFormEntries]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      await deleteFormEntry(id);
      setEntries(entries.filter((e) => e.id !== id));
      toast.success("Entry deleted successfully");
    }
  };

  return (
    <div className="grid-container-form-entries">
      {entries.map((entry) => {
        const personal = entry.personal_info || {};
        return (
          <div key={entry.id} className="card">
            <h4>{personal.fname} {personal.lname}</h4>
            <p>{personal.email}</p>
            <p>Phone: {personal.phone}</p>
            <div className="card-actions">
              <button className="view-btn" onClick={() => setSelected(entry)}>
                View Details
              </button>
            </div>
          </div>
        );
      })}

      {selected && (
        <Modal
          isOpen={!!selected}
          onRequestClose={() => setSelected(null)}
          className="modal"
          overlayClassName="overlay"
        >
          <h2>{selected.personal_info?.fname} {selected.personal_info?.lname}</h2>

          <div className="tab-buttons">
            <button
              className={activeTab === "entry" ? "active-tab" : ""}
              onClick={() => setActiveTab("entry")}
            >
              Entry Info
            </button>
            <button
              className={activeTab === "booking" ? "active-tab" : ""}
              onClick={() => setActiveTab("booking")}
            >
              Bookings ({selected.bookings?.length || 0})
            </button>
          </div>

          {activeTab === "entry" && (
            <div className="modal-group">
              <h3>👤 Personal Information</h3>
              <div className="modal-grid">
                <div><strong>Email:</strong> {selected.personal_info?.email}</div>
                <div><strong>Phone:</strong> {selected.personal_info?.phone}</div>
                <div><strong>WhatsApp:</strong> {selected.personal_info?.wphone}</div>
                <div><strong>Father’s No:</strong> {selected.personal_info?.fathers_number}</div>
                <div><strong>Mother’s No:</strong> {selected.personal_info?.mothers_number}</div>
                <div><strong>Aadhar No:</strong> {selected.personal_info?.aadhar_number}</div>
                <div><strong>DL No:</strong> {selected.personal_info?.dl_number}</div>
              </div>

              <h3>📍 Address</h3>
              <div className="modal-grid">
                <div><strong>Street 1:</strong> {selected.address?.street_address_1}</div>
                <div><strong>Street 2:</strong> {selected.address?.street_address_2}</div>
                <div><strong>City:</strong> {selected.address?.address_city}</div>
                <div><strong>State:</strong> {selected.address?.address_state}</div>
                <div><strong>ZIP:</strong> {selected.address?.address_zip}</div>
                <div><strong>Country:</strong> {selected.address?.address_country}</div>
              </div>
            </div>
          )}

          {activeTab === "booking" && (
            <div className="modal-group">
              {selected.bookings?.length > 0 ? (
                selected.bookings.map((b, i) => (
                  <div key={i}>
                    <h4 style={{ marginTop: "1.5rem" }}>🚗 Booking #{i + 1}</h4>
                    <div className="modal-grid">
                      <div><strong>Pickup:</strong> {b.pickup_location}</div>
                      <div><strong>Destinations:</strong> {b.destination_routes}</div>
                      <div><strong>Car:</strong> {b.selected_car}</div>
                      <div><strong>Start:</strong> {b.start_date} {b.start_time}</div>
                      <div><strong>End:</strong> {b.end_date} {b.end_time}</div>
                      <div><strong>Token Paid:</strong> {b.token_amount_paid}</div>
                      <div><strong>Security:</strong> {b.security_money_paid}</div>
                      <div><strong>Heard From:</strong> {b.where_did_you_here}</div>
                      <div><strong>Referrer:</strong> {b.referrer_name || "—"}</div>
                      <div><strong>Terms:</strong> {b.terms_selected}</div>
                      <div><strong>IP Address:</strong> {b.id_address || "—"}</div>
                      <div><strong>Added Time:</strong> {b.added_time}</div>
                      <div><strong>Timestamp:</strong> {b.timestamp}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p>No bookings found.</p>
              )}
            </div>
          )}

          <button onClick={() => setSelected(null)}>Close</button>
        </Modal>
      )}
    </div>
  );
};

export default ManageFormEntries;
