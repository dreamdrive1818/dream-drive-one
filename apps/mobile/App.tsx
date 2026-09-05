import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

const SCREENS = [
  "splash",
  "login",
  "home",
  "search",
  "detail",
  "packages",
  "checkout",
  "pay",
  "success",
  "kyc",
  "bookings",
  "track",
  "profile",
  "tickets",
  "notifications",
  "legal",
];

async function call(path, { token, method, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: method || "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

function Screen({ title, children, onBack }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b0f14" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {onBack ? (
            <TouchableOpacity onPress={onBack}>
              <Text style={{ color: "#3ee0a4" }}>Back</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>{title}</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <View>
      <Text style={{ color: "#8b9bb0", marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#8b9bb0"
        style={{ color: "#fff", borderColor: "#243041", borderWidth: 1, padding: 10, borderRadius: 8 }}
        {...rest}
      />
    </View>
  );
}

function Btn({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ backgroundColor: disabled ? "#243041" : "#3ee0a4", padding: 12, borderRadius: 8 }}
    >
      <Text style={{ fontWeight: "700", textAlign: "center", color: "#062016" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [email, setEmail] = useState("customer@dreamdrive.test");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [cities, setCities] = useState([]);
  const [cars, setCars] = useState([]);
  const [car, setCar] = useState(null);
  const [packages, setPackages] = useState([]);
  const [quote, setQuote] = useState(null);
  const [booking, setBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [me, setMe] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [health, setHealth] = useState(null);
  const [subject, setSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [publicId, setPublicId] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    call("/health")
      .then(setHealth)
      .catch(() => setHealth({ status: "down" }));
    const t = setTimeout(() => setScreen("login"), 800);
    return () => clearTimeout(t);
  }, []);

  async function afterLogin(nextToken) {
    setToken(nextToken);
    const user = await call("/v1/me", { token: nextToken });
    setMe(user);
    await call("/v1/me/devices", { token: nextToken, method: "POST", body: { token: "expo-dev", platform: "android" } }).catch(() => {});
    setScreen("home");
  }

  async function loadHome() {
    const [cityRows, search] = await Promise.all([
      call("/v1/public/cities"),
      call("/v1/public/search"),
    ]);
    setCities(Array.isArray(cityRows) ? cityRows : []);
    setCars(Array.isArray(search) ? search : search?.results || []);
  }

  useEffect(() => {
    if (screen === "home" || screen === "search") loadHome().catch((e) => setMessage(e.message));
    if (screen === "packages") call("/v1/public/packages").then((rows) => setPackages(Array.isArray(rows) ? rows : [])).catch((e) => setMessage(e.message));
    if (screen === "bookings" && token) call("/v1/me/bookings", { token }).then((rows) => setBookings(Array.isArray(rows) ? rows : [])).catch((e) => setMessage(e.message));
    if (screen === "tickets" && token) call("/v1/me/tickets", { token }).then((rows) => setTickets(Array.isArray(rows) ? rows : [])).catch((e) => setMessage(e.message));
    if (screen === "profile" && token) call("/v1/me", { token }).then(setMe).catch((e) => setMessage(e.message));
  }, [screen, token]);

  const tabs = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
      {["home", "search", "bookings", "profile", "tickets", "notifications"].map((s) => (
        <TouchableOpacity key={s} onPress={() => setScreen(s)}>
          <Text style={{ color: screen === s ? "#3ee0a4" : "#8b9bb0" }}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (screen === "splash") {
    return (
      <Screen title="Dream Drive">
        <Text style={{ color: "#8b9bb0" }}>Checking API… {health?.status || "…"}</Text>
      </Screen>
    );
  }

  if (screen === "login") {
    return (
      <Screen title="Login">
        <Field label="Email" value={email} onChange={setEmail} autoCapitalize="none" />
        <Btn
          label="Send OTP"
          onPress={async () => {
            try {
              const res = await call("/v1/auth/otp/send", { method: "POST", body: { email } });
              setMessage(res.devCode ? `OTP sent. Dev code ${res.devCode}` : "OTP sent");
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        <Field label="OTP" value={otp} onChange={setOtp} keyboardType="number-pad" />
        <Btn
          label="Verify OTP"
          onPress={async () => {
            try {
              const res = await call("/v1/auth/otp/verify", { method: "POST", body: { email, code: otp } });
              await afterLogin(res.token);
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        <Btn
          label="Dev sign-in"
          onPress={async () => {
            const t = `dev:${email.trim().toLowerCase()}`;
            await fetch(`${API}/v1/auth/sync`, {
              method: "POST",
              headers: { "content-type": "application/json", Authorization: `Bearer ${t}` },
              body: "{}",
            });
            await afterLogin(t);
          }}
        />
        {message ? <Text style={{ color: "#3ee0a4" }}>{message}</Text> : null}
      </Screen>
    );
  }

  if (screen === "home") {
    return (
      <Screen title="Home">
        <Text style={{ color: "#8b9bb0" }}>{me?.email || "Guest"}</Text>
        <Btn label="Search cars" onPress={() => setScreen("search")} />
        <Btn label="Packages" onPress={() => setScreen("packages")} />
        <Btn label="Legal" onPress={() => setScreen("legal")} />
        {cars.slice(0, 5).map((c) => (
          <TouchableOpacity key={c.id} onPress={() => { setCar(c); setScreen("detail"); }}>
            <Text style={{ color: "#e8eef6", marginTop: 8 }}>{c.name}</Text>
            <Text style={{ color: "#8b9bb0" }}>₹{((c.pricePaise || 0) / 100).toLocaleString("en-IN")} / day</Text>
          </TouchableOpacity>
        ))}
        {tabs}
      </Screen>
    );
  }

  if (screen === "search") {
    return (
      <Screen title="Search" onBack={() => setScreen("home")}>
        {cities.map((c) => (
          <Text key={c.id} style={{ color: "#8b9bb0" }}>{c.name}</Text>
        ))}
        {cars.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => { setCar(c); setScreen("detail"); }}>
            <Text style={{ color: "#e8eef6", marginTop: 10 }}>{c.name} {c.available === false ? "(unavailable)" : ""}</Text>
          </TouchableOpacity>
        ))}
        {tabs}
      </Screen>
    );
  }

  if (screen === "detail") {
    return (
      <Screen title={car?.name || "Car"} onBack={() => setScreen("search")}>
        <Text style={{ color: "#8b9bb0" }}>{car?.type} · {car?.seats} seats</Text>
        <Text style={{ color: "#e8eef6" }}>₹{((car?.pricePaise || 0) / 100).toLocaleString("en-IN")} / day</Text>
        <Btn
          label="Get quote"
          disabled={!token || car?.available === false}
          onPress={async () => {
            try {
              const from = new Date(Date.now() + 86400000).toISOString();
              const to = new Date(Date.now() + 3 * 86400000).toISOString();
              const q = await call("/v1/quotes", {
                token,
                method: "POST",
                body: { carModelId: car.id, rentalType: "SELF_DRIVE", startsAt: from, endsAt: to, cityId: car.cityId || cities[0]?.id },
              });
              setQuote(q);
              setScreen("checkout");
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        {!token ? <Text style={{ color: "#8b9bb0" }}>Sign in to quote.</Text> : null}
        {message ? <Text style={{ color: "#ff6b6b" }}>{message}</Text> : null}
      </Screen>
    );
  }

  if (screen === "packages") {
    return (
      <Screen title="Packages" onBack={() => setScreen("home")}>
        {packages.map((p) => (
          <View key={p.id} style={{ marginBottom: 12 }}>
            <Text style={{ color: "#e8eef6" }}>{p.name}</Text>
            <Text style={{ color: "#8b9bb0" }}>{p.days} days · ₹{((p.pricePaise || 0) / 100).toLocaleString("en-IN")}</Text>
          </View>
        ))}
        {tabs}
      </Screen>
    );
  }

  if (screen === "checkout") {
    return (
      <Screen title="Checkout" onBack={() => setScreen("detail")}>
        <Text style={{ color: "#e8eef6" }}>Quote {quote?.id}</Text>
        <Text style={{ color: "#8b9bb0" }}>₹{((quote?.amountPaise || 0) / 100).toLocaleString("en-IN")}</Text>
        <Btn
          label="Hold booking"
          onPress={async () => {
            try {
              const b = await call("/v1/bookings", { token, method: "POST", body: { quoteId: quote.id } });
              setBooking(b);
              setScreen("pay");
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        {message ? <Text style={{ color: "#ff6b6b" }}>{message}</Text> : null}
      </Screen>
    );
  }

  if (screen === "pay") {
    return (
      <Screen title="Pay" onBack={() => setScreen("checkout")}>
        <Text style={{ color: "#e8eef6" }}>{booking?.publicId}</Text>
        <Btn
          label="Create payment order"
          onPress={async () => {
            try {
              const order = await call("/v1/payments/orders", {
                token,
                method: "POST",
                body: { bookingId: booking.id, kind: "TOKEN" },
              });
              if (order.mock) {
                await call("/v1/payments/verify", { token, method: "POST", body: { paymentId: order.paymentId } });
              }
              setScreen("success");
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        {message ? <Text style={{ color: "#ff6b6b" }}>{message}</Text> : null}
      </Screen>
    );
  }

  if (screen === "success") {
    return (
      <Screen title="Booked">
        <Text style={{ color: "#3ee0a4" }}>{booking?.publicId}</Text>
        <Btn label="KYC" onPress={() => setScreen("kyc")} />
        <Btn label="Track" onPress={() => { setPublicId(booking?.publicId || ""); setScreen("track"); }} />
        <Btn label="My bookings" onPress={() => setScreen("bookings")} />
      </Screen>
    );
  }

  if (screen === "kyc") {
    return (
      <Screen title="KYC" onBack={() => setScreen("bookings")}>
        <Text style={{ color: "#8b9bb0" }}>Upload DL, Aadhaar/address, and selfie via POST /v1/kyc/uploads then submit.</Text>
        <Btn
          label="Load KYC status"
          onPress={async () => {
            try {
              const k = await call("/v1/me/kyc", { token });
              setMessage(`Status: ${k.status || k.kycStatus || JSON.stringify(k).slice(0, 80)}`);
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        {message ? <Text style={{ color: "#3ee0a4" }}>{message}</Text> : null}
      </Screen>
    );
  }

  if (screen === "bookings") {
    return (
      <Screen title="My bookings" onBack={() => setScreen("home")}>
        {bookings.map((b) => (
          <TouchableOpacity key={b.id} onPress={() => { setBooking(b); setPublicId(b.publicId); setScreen("track"); }}>
            <Text style={{ color: "#e8eef6", marginTop: 8 }}>{b.publicId} — {b.status}</Text>
          </TouchableOpacity>
        ))}
        {tabs}
      </Screen>
    );
  }

  if (screen === "track") {
    return (
      <Screen title="Track" onBack={() => setScreen("bookings")}>
        <Field label="Booking ID" value={publicId} onChange={setPublicId} />
        <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <Btn
          label="Send guest OTP"
          onPress={async () => {
            try {
              await call("/v1/public/bookings/track/otp", { method: "POST", body: { publicId, phone } });
              setMessage("OTP sent");
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        {token && publicId ? (
          <Btn
            label="Load as signed-in user"
            onPress={async () => {
              try {
                setBooking(await call(`/v1/bookings/${publicId}`, { token }));
              } catch (e) {
                setMessage(e.message);
              }
            }}
          />
        ) : null}
        {booking ? <Text style={{ color: "#e8eef6" }}>{booking.publicId} · {booking.status}</Text> : null}
        {message ? <Text style={{ color: "#3ee0a4" }}>{message}</Text> : null}
      </Screen>
    );
  }

  if (screen === "profile") {
    return (
      <Screen title="Profile" onBack={() => setScreen("home")}>
        <Text style={{ color: "#e8eef6" }}>{me?.fullName || me?.profile?.fullName}</Text>
        <Text style={{ color: "#8b9bb0" }}>{me?.email}</Text>
        <Text style={{ color: "#8b9bb0" }}>{me?.phone || "No phone"}</Text>
        {tabs}
      </Screen>
    );
  }

  if (screen === "tickets") {
    return (
      <Screen title="Support" onBack={() => setScreen("home")}>
        {tickets.map((t) => (
          <Text key={t.id} style={{ color: "#e8eef6", marginTop: 8 }}>{t.subject} · {t.status}</Text>
        ))}
        <Field label="Subject" value={subject} onChange={setSubject} />
        <Field label="Message" value={ticketBody} onChange={setTicketBody} />
        <Btn
          label="Create ticket"
          onPress={async () => {
            try {
              await call("/v1/me/tickets", { token, method: "POST", body: { subject, body: ticketBody } });
              setSubject("");
              setTicketBody("");
              setTickets(await call("/v1/me/tickets", { token }));
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        {tabs}
      </Screen>
    );
  }

  if (screen === "notifications") {
    return (
      <Screen title="Notifications" onBack={() => setScreen("home")}>
        <Text style={{ color: "#8b9bb0" }}>Push list is device-side. Token is registered after login via POST /v1/me/devices.</Text>
        {tabs}
      </Screen>
    );
  }

  if (screen === "legal") {
    return (
      <Screen title="Legal" onBack={() => setScreen("home")}>
        <Btn
          label="Load terms"
          onPress={async () => {
            try {
              const page = await call("/v1/public/pages/terms");
              setMessage(page.title || page.slug);
            } catch (e) {
              setMessage(e.message);
            }
          }}
        />
        {message ? <Text style={{ color: "#e8eef6" }}>{message}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen title={screen}>
      <Text style={{ color: "#8b9bb0" }}>{SCREENS.join(" · ")}</Text>
      {tabs}
    </Screen>
  );
}
