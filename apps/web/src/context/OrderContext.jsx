import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-toastify";
import api from "../api/http";

const OrderContext = createContext();

export const OrderProvider = ({ children }) => {
  const [order, setOrder] = useState(() => {
    const stored = localStorage.getItem("order");
    return stored ? JSON.parse(stored) : null;
  });

  const [selectedCar, setSelectedCar] = useState(null); // only in-memory
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  // keep order in localStorage to survive reload
  useEffect(() => {
    if (order) {
      localStorage.setItem("order", JSON.stringify(order));
    } else {
      localStorage.removeItem("order");
    }
  }, [order]);

  // keep user in localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  // 12 hour expiry logic
  useEffect(() => {
    const createdAt = localStorage.getItem("orderCreatedAt");
    if (createdAt) {
      const now = Date.now();
      const twelveHours = 12 * 60 * 60 * 1000;
      if (now - Number(createdAt) > twelveHours) {
        console.log("Order expired after 12 hours, clearing...");
        clearOrder();
      }
    }
  }, []);

  // selects car (in memory)
  const handleOrder = (car) => {
    setSelectedCar(car);
  };

  // creates pending order
  const createPendingOrder = (userData) => {
    if (!selectedCar) {
      toast.warn("No car selected — order not saved.");
      return;
    }
    const bookingData = {
      user: userData,
      car: selectedCar,
      status: "pending",
      createdAt: new Date(),
    };
    setOrder(bookingData);
    console.log("Booking details saved locally -->", bookingData);
    localStorage.setItem("orderCreatedAt", Date.now().toString());
  };

  // clears everything
  const clearOrder = () => {
    setOrder(null);
    setSelectedCar(null);
    setUser(null);
    localStorage.removeItem("order");
    localStorage.removeItem("user");
    localStorage.removeItem("orderCreatedAt");
  };

  // submits to Firestore + confirmation email
  const submitOrderToFirestore = async (navigate) => {
    if (!order) {
      toast.error("No order found to submit.");
      return;
    }
    if (!order.user.bookingDate || !order.user.bookingTime || !order.user.rentalType) {
      toast.warn("Booking date, time, or rental type missing.");
      return;
    }

    const customId = `RIDE${Math.floor(100000 + Math.random() * 900000)}`;

    const userInfo = {
      fullName: order.user.fullName,
      email: order.user.email,
      phone: order.user.phone,
      uid: order.user.uid,
    };

    const orderWithCustomId = {
      ...order,
      id: customId,
      advancePaid: 0.0,
      paymentStatus: "pending",
      status: "pending",
      createdAt: new Date().toISOString(),
      bookingDate: order.user.bookingDate,
      bookingTime: order.user.bookingTime,
      rentalType: order.user.rentalType,
      bookingCategory: order.user.bookingCategory || null,
      tripType: order.user.tripType || null,
      pickupLocation: order.user.pickupLocation || null,
      startingCity: order.user.startingCity || null,
      endingCity: order.user.endingCity || null,
      user: userInfo,
    };

    try {
      await api.post("/api/booking/orders", orderWithCustomId);
      setOrder(orderWithCustomId);

      await api.post("/api/notify/send-confirmation", {
        user: userInfo,
        order: orderWithCustomId,
      });

      toast.success("Order confirmed!");
      if (navigate) navigate("/success");

    } catch (err) {
      console.error("Order Save Error:", err.message);
      toast.error("Failed to complete order. Please try again.");
    }
  };

  return (
    <OrderContext.Provider
      value={{
        order,
        setOrder,
        user,
        setUser,
        selectedCar,
        setSelectedCar,
        createPendingOrder,
        submitOrderToFirestore,
        handleOrder,
        clearOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrderContext = () => useContext(OrderContext);
