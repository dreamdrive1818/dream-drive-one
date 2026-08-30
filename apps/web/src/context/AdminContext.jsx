import { createContext, useContext, useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { toast } from "react-toastify";
import api from "../api/http";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(localStorage.getItem("admin") || null);
  const [allComments, setAllComments] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const selectBlog = (blog) => setSelectedBlog(blog);

  useEffect(() => {
    const verifyAdminFromStorage = async () => {
      const storedUID = localStorage.getItem("admin_uid");
      if (!storedUID) return;
      try {
        const { data } = await api.get(`/api/identity/admin/${storedUID}`);
        if (data?.role === "all") {
          setAdmin(data.email);
        } else {
          localStorage.removeItem("admin_uid");
          setAdmin(null);
        }
      } catch (error) {
        console.error("Failed to verify admin:", error);
        localStorage.removeItem("admin_uid");
        setAdmin(null);
      }
    };
    verifyAdminFromStorage();
  }, []);

  const AdminLogin = async (email, password, navigate) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const { data } = await api.get(`/api/identity/admin/${uid}`);
      if (!data || data.role !== "all") {
        throw new Error("Access denied");
      }
      toast.success("Login successful");
      localStorage.setItem("admin_uid", uid);
      setAdmin(email);
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("Admin login error:", err.message);
      toast.error(err.message);
      throw err;
    }
  };

  const AdminLogout = () => {
    setAdmin(null);
    localStorage.removeItem("admin_uid");
    toast.success("Logged out successfully");
  };

  const fetchCars = async () => {
    const { data } = await api.get("/api/catalog/cars");
    return data;
  };

  const addCar = async (carData) => {
    await api.post("/api/catalog/cars", carData);
  };

  const updateCar = async (carId, carData) => {
    await api.patch(`/api/catalog/cars/${carId}`, carData);
  };

  const deleteCar = async (carId) => {
    await api.delete(`/api/catalog/cars/${carId}`);
  };

  const fetchRides = async () => {
    const { data } = await api.get("/api/booking/orders");
    return data;
  };

  const updateRideStatus = async (rideId, newStatus) => {
    try {
      await api.patch(`/api/booking/orders/${rideId}/status`, { status: newStatus });
      toast.success("Ride status updated");
    } catch (err) {
      console.error("Ride status update error:", err.message);
      toast.error("Failed to update ride status");
    }
  };

  async function updateBookingDateTime(rideId, bookingDate, bookingTime) {
    try {
      await api.patch(`/api/booking/orders/${rideId}`, { bookingDate, bookingTime });
      toast.success("Booking date & time updated");
    } catch (error) {
      console.error("Error updating booking date/time:", error.message);
      toast.error("Failed to update booking date & time");
    }
  }

  async function updateRentalType(rideId, rentalType) {
    try {
      await api.patch(`/api/booking/orders/${rideId}`, { rentalType });
      toast.success("Rental type updated");
    } catch (error) {
      console.error("Error updating rental type:", error.message);
      toast.error("Failed to update rental type");
    }
  }

  const updatePaymentStatus = async (rideId, paymentStatus) => {
    try {
      await api.patch(`/api/booking/orders/${rideId}/payment`, { paymentStatus });
      toast.success("Payment status updated");
    } catch (err) {
      console.error("Payment status update error:", err.message);
      toast.error("Failed to update payment status");
    }
  };

  const deleteRide = async (rideId) => {
    try {
      await api.delete(`/api/booking/orders/${rideId}`);
      toast.success("Ride deleted successfully from orders and user history.");
    } catch (err) {
      console.error("Delete Ride Error:", err.message);
      toast.error("Failed to delete ride.");
    }
  };

  const fetchUsers = async () => {
    const { data } = await api.get("/api/identity/users");
    return data;
  };

  const deleteUser = async (userId) => {
    await api.delete(`/api/identity/users/${userId}`);
    toast.success("User deleted successfully");
  };

  const fetchFormEntries = async () => {
    const { data } = await api.get("/api/crm/form-entries");
    return data;
  };

  const deleteFormEntry = async (entryId) => {
    await api.delete(`/api/crm/form-entries/${encodeURIComponent(entryId)}`);
    toast.success("Form entry deleted");
  };

  const updateFormEntry = async (entryId, updatedData) => {
    await api.patch(`/api/crm/form-entries/${encodeURIComponent(entryId)}`, updatedData);
    toast.success("Form entry updated");
  };

  const fetchMessages = async () => {
    const { data } = await api.get("/api/cms/contacts");
    return data;
  };

  const fetchBlogs = async () => {
    const { data } = await api.get("/api/cms/blogs");
    return data;
  };

  const addBlog = async (blogData) => {
    try {
      const { data } = await api.post("/api/cms/blogs", blogData);
      toast.success("Blog added successfully!");
      return data.id;
    } catch (error) {
      console.error("Error adding blog:", error.message);
      throw error;
    }
  };

  const deleteBlog = async (blogId) => {
    try {
      await api.delete(`/api/cms/blogs/${blogId}`);
      toast.success("Blog deleted");
    } catch (error) {
      console.error("Delete error:", error.message);
      throw error;
    }
  };

  const updateBlog = async (blogId, updatedData) => {
    try {
      await api.patch(`/api/cms/blogs/${blogId}`, updatedData);
      toast.success("Blog updated successfully");
    } catch (error) {
      console.error("Update error:", error.message);
      throw error;
    }
  };

  const fetchComments = async () => {
    try {
      const { data } = await api.get("/api/cms/comments");
      setAllComments(data);
      return data;
    } catch (error) {
      console.error("Error fetching comments:", error.message);
      return [];
    }
  };

  const addCategory = async (name) => {
    const formattedName = name.toLowerCase().replace(/\s+/g, "-");
    await api.put(`/api/cms/categories/${formattedName}`, {
      name,
      createdAt: new Date(),
    });
    return formattedName;
  };

  const fetchCategories = async () => {
    const { data } = await api.get("/api/cms/categories");
    return data;
  };

  const fetchCategoryById = async (docId) => {
    const { data } = await api.get(`/api/cms/categories/${docId}`);
    return data;
  };

  const deleteCategory = async (categoryId) => {
    await api.delete(`/api/cms/categories/${categoryId}`);
    toast.success("Category deleted");
  };

  const updateCategory = async (oldId, newData) => {
    if (typeof newData === "string") {
      const newId = newData.toLowerCase().replace(/\s+/g, "-");
      await api.post(`/api/cms/categories/${oldId}/rename`, { newId, name: newData });
      toast.success("Category updated");
    } else if (typeof newData === "object") {
      await api.patch(`/api/cms/categories/${oldId}`, newData);
      toast.success("SEO metadata updated");
    }
  };

  const updateCommentApproval = async (commentId, path, currentStatus) => {
    try {
      await api.patch("/api/cms/comments", { path, approved: !currentStatus });
      setAllComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId ? { ...comment, approved: !currentStatus } : comment
        )
      );
      toast.success(`Comment ${!currentStatus ? "approved" : "disapproved"}`);
    } catch (err) {
      console.error("Error updating comment approval:", err.message);
      toast.error("Failed to update comment status");
    }
  };

  const fetchTestimonials = async () => {
    const { data } = await api.get("/api/cms/testimonials");
    return data;
  };

  const approveTestimonial = async (id) => {
    await api.patch(`/api/cms/testimonials/${id}`, { status: "approved" });
  };

  const deleteTestimonial = async (id) => {
    await api.delete(`/api/cms/testimonials/${id}`);
  };

  return (
    <AdminContext.Provider
      value={{
        admin,
        setAdmin,
        AdminLogin,
        AdminLogout,
        fetchCars,
        addCar,
        updateCar,
        deleteCar,
        fetchRides,
        updateRideStatus,
        updatePaymentStatus,
        deleteRide,
        fetchUsers,
        deleteUser,
        fetchMessages,
        fetchBlogs,
        addBlog,
        deleteBlog,
        updateBlog,
        fetchComments,
        fetchCategories,
        fetchCategoryById,
        deleteCategory,
        updateCategory,
        addCategory,
        updateRentalType,
        updateBookingDateTime,
        fetchTestimonials,
        approveTestimonial,
        deleteTestimonial,
        fetchFormEntries,
        deleteFormEntry,
        updateFormEntry,
        selectedBlog,
        selectBlog,
        allComments,
        updateCommentApproval,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdminContext = () => useContext(AdminContext);
