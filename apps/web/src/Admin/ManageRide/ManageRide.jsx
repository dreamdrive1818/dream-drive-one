import React, { useEffect, useState } from "react";
import { useAdminContext } from "../../context/AdminContext";
import "./ManageRide.css";
import { FaEdit, FaTrash, FaSave, FaTimes, FaEye, FaClock,
  FaCity,
  FaRoute } from "react-icons/fa";

const ManageRide = () => {
  const {
    fetchRides,
    updateRideStatus,
    updatePaymentStatus,
    deleteRide,
    updateBookingDateTime,
    updateRentalType,
  } = useAdminContext();

  const [rides, setRides] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [selectedRide, setSelectedRide] = useState(null);

  const loadRides = async () => {
    const data = await fetchRides();
    setRides(data);
  };

  useEffect(() => {
    loadRides();
  }, []);

  const handleStatusChange = async (rideId, newStatus) => {
    await updateRideStatus(rideId, newStatus);
    loadRides();
  };

  const handlePaymentChange = async (rideId, newStatus) => {
    await updatePaymentStatus(rideId, newStatus);
    loadRides();
  };

  const handleDelete = async (rideId) => {
    if (window.confirm("Are you sure you want to delete this ride?")) {
      await deleteRide(rideId);
      loadRides();
    }
  };

  const handleEditClick = (ride) => {
    setEditRow(ride.id);
    setEditedData({
      bookingDate: ride.bookingDate || "",
      bookingTime: ride.bookingTime || "",
      rentalType: ride.rentalType || "",
    });
  };

  const handleSaveEdit = async (rideId) => {
    try {
      await updateBookingDateTime(rideId, editedData.bookingDate, editedData.bookingTime);
      await updateRentalType(rideId, editedData.rentalType);
      setEditRow(null);
      loadRides();
    } catch (err) {
      console.error("Edit failed", err);
      alert("Update failed. Try again.");
    }
  };

  const handleCancelEdit = () => {
    setEditRow(null);
    setEditedData({});
  };

  return (
    <div className="manage-rides">
      <h2>Manage Rides</h2>
      {rides.length === 0 ? (
        <p>No rides available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ride ID</th>
              <th>Car</th>
              <th>User Info</th>
              <th>Advance</th>
              <th>Booking Date/Time</th>
              <th>Rental Type</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((ride) => (
              <tr key={ride.id}>
                <td>{ride.id}</td>
                <td>{ride.car?.name || "N/A"}</td>
                <td>
                  {ride.user?.fullName}<br />
                  <small>{ride.user?.email}</small><br />
                  <small>{ride.user?.phone}</small>
                </td>
                <td>₹{ride.advancePaid || 0}</td>
                <td>
                  {editRow === ride.id ? (
                    <>
                      <input
                        type="date"
                        value={editedData.bookingDate}
                        onChange={(e) =>
                          setEditedData({ ...editedData, bookingDate: e.target.value })
                        }
                      />
                      <input
                        type="time"
                        value={editedData.bookingTime}
                        onChange={(e) =>
                          setEditedData({ ...editedData, bookingTime: e.target.value })
                        }
                      />
                    </>
                  ) : (
                    ride.bookingDate
                      ? `${ride.bookingDate} at ${ride.bookingTime}`
                      : "N/A"
                  )}
                </td>
                <td>
                  {editRow === ride.id ? (
                    <select
                      value={editedData.rentalType}
                      onChange={(e) =>
                        setEditedData({ ...editedData, rentalType: e.target.value })
                      }
                    >
                      <option value="">Select</option>
                      <option value="self-drive">Self-Drive</option>
                      <option value="with-driver">With Driver</option>
                    </select>
                  ) : (
                    ride.rentalType || "N/A"
                  )}
                </td>
                <td>
                  <select
                    value={ride.status}
                    onChange={(e) => handleStatusChange(ride.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </select>
                </td>
                <td>
                  <select
                    value={ride.paymentStatus}
                    onChange={(e) => handlePaymentChange(ride.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </td>
                <td className="actions">
                  {editRow === ride.id ? (
                    <>
                      <button className="save" onClick={() => handleSaveEdit(ride.id)}>
                        <FaSave /> Save
                      </button>
                      <button className="cancel" onClick={handleCancelEdit}>
                        <FaTimes /> Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="view" onClick={() => setSelectedRide(ride)}>
                        <FaEye /> View
                      </button>
                      <button className="edit" onClick={() => handleEditClick(ride)}>
                        <FaEdit /> Edit
                      </button>
                      <button className="delete" onClick={() => handleDelete(ride.id)}>
                        <FaTrash /> Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedRide && (
        <div className="ride-modal-overlay" onClick={() => setSelectedRide(null)}>
          <div className="ride-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedRide(null)}>×</button>
            <h3>Ride Details</h3>
            <div className="ride-details">
              <div>
                <h4>Booking Info</h4>
                <ul>
                  <li><strong>Ride ID:</strong> {selectedRide.id}</li>
                  <li><strong>Car:</strong> {selectedRide.car?.name}</li>
                  <li><strong>Rental Type:</strong> {selectedRide.rentalType}</li>
                  <li><strong>Status:</strong> {selectedRide.status}</li>
                  <li><strong>Payment:</strong> {selectedRide.paymentStatus}</li>
                  <li><strong>Advance:</strong> ₹{selectedRide.advancePaid}</li>
                  <li><strong>Booking Date:</strong> {selectedRide.bookingDate}</li>
                  <li><strong>Booking Time:</strong> {selectedRide.bookingTime}</li>
                  {selectedRide.rentalType === "self-drive" && (
                                     <li><strong>Pickup Location:</strong> {selectedRide.pickupLocation || "-"}</li>
                                   )}
                                   {selectedRide.rentalType === "with-driver" && (
                                     <>
                                       <li><strong>Booking Category:</strong> {selectedRide.bookingCategory || "-"}</li>
                                       {selectedRide.bookingCategory === "local" && (
                                         <li><FaCity /> <strong>Starting City:</strong> {selectedRide.startingCity || "-"}</li>
                                       )}
                                       {selectedRide.bookingCategory === "intercity" && (
                                         <>
                                           <li><FaCity /> <strong>Starting City:</strong> {selectedRide.startingCity || "-"}</li>
                                           <li><FaRoute /> <strong>Ending City:</strong> {selectedRide.endingCity || "-"}</li>
                                           <li><FaClock /> <strong>Trip Type:</strong> {selectedRide.tripType || "-"}</li>
                                         </>
                                       )}
                                     </>
                                   )}
                  <li><strong>Created At:</strong> {new Date(selectedRide.createdAt).toLocaleString()}</li>
                </ul>
              </div>
              <div>
                <h4>User Info</h4>
                <ul>
                  <li><strong>Name:</strong> {selectedRide.user?.fullName}</li>
                  <li><strong>Email:</strong> {selectedRide.user?.email}</li>
                  <li><strong>Phone:</strong> {selectedRide.user?.phone}</li>
                </ul>
              </div>
            </div>
            {selectedRide.car?.images && (
              <div className="ride-images">
                <h4>Car Images</h4>
                <div className="images-grid">
                  {selectedRide.car.images.map((img, i) => (
                    <img src={img} key={i} alt={`car-${i}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageRide;
