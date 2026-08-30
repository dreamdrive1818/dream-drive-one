import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

export default function App() {
  const [email, setEmail] = useState("customer@dreamdrive.test");
  const [token, setToken] = useState("");
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");

  async function call(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      method: options.method || "GET",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return res.json();
  }

  useEffect(() => {
    call("/v1/public/search").then((rows) => setCars(Array.isArray(rows) ? rows : [])).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b0f14" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>Dream-Drive</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="email"
          placeholderTextColor="#8b9bb0"
          style={{ color: "#fff", borderColor: "#243041", borderWidth: 1, padding: 10, marginVertical: 12, borderRadius: 8 }}
        />
        <TouchableOpacity
          onPress={async () => {
            const t = `dev:${email.trim().toLowerCase()}`;
            setToken(t);
            await fetch(`${API}/v1/auth/sync`, {
              method: "POST",
              headers: { "content-type": "application/json", Authorization: `Bearer ${t}` },
              body: "{}",
            });
            const mine = await fetch(`${API}/v1/me/bookings`, {
              headers: { Authorization: `Bearer ${t}` },
            }).then((r) => r.json());
            setBookings(Array.isArray(mine) ? mine : []);
            setMessage("Signed in");
          }}
          style={{ backgroundColor: "#3ee0a4", padding: 12, borderRadius: 8 }}
        >
          <Text style={{ fontWeight: "700", textAlign: "center" }}>Sign in</Text>
        </TouchableOpacity>
        {message ? <Text style={{ color: "#3ee0a4", marginTop: 8 }}>{message}</Text> : null}
        <Text style={{ color: "#fff", marginTop: 24, fontSize: 18 }}>Cars</Text>
        {cars.map((c) => (
          <View key={c.id} style={{ paddingVertical: 8, borderBottomColor: "#243041", borderBottomWidth: 1 }}>
            <Text style={{ color: "#e8eef6" }}>{c.name}</Text>
            <Text style={{ color: "#8b9bb0" }}>₹{((c.pricePaise || 0) / 100).toLocaleString("en-IN")} / day</Text>
          </View>
        ))}
        <Text style={{ color: "#fff", marginTop: 24, fontSize: 18 }}>My bookings</Text>
        {bookings.map((b) => (
          <Text key={b.id} style={{ color: "#8b9bb0", marginTop: 6 }}>
            {b.publicId} — {b.status}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
