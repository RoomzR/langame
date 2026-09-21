import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Button, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "./api";

export default function App() {
  const [phone, setPhone] = useState("+375291000004");
  const [password, setPassword] = useState("guest123");
  const [token, setToken] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [club, setClub] = useState(null);
  const [msg, setMsg] = useState("");

  async function login() {
    const t = await api("/api/v1/auth/login", { method: "POST", body: { phone, password } });
    setToken(t.accessToken);
    setClubs(await api("/api/v1/clubs"));
  }

  async function book(seat, tariffId) {
    const startsAt = new Date(Date.now() + 10 * 60000).toISOString();
    const endsAt = new Date(Date.now() + 70 * 60000).toISOString();
    await api(`/api/v1/clubs/${club.id}/bookings`, {
      token,
      method: "POST",
      body: { seatId: seat.id, tariffId, startsAt, endsAt },
    });
    setMsg("Бронь создана");
  }

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0810", padding: 24 }}>
        <StatusBar style="light" />
        <Text style={{ color: "#E0B84A", fontSize: 28, fontWeight: "700" }}>RUDEMIR</Text>
        <TextInput value={phone} onChangeText={setPhone} style={input} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={input} />
        <Button title="Войти" onPress={() => login().catch((e) => setMsg(e.message))} />
        <Text style={{ color: "#f87171", marginTop: 12 }}>{msg}</Text>
      </SafeAreaView>
    );
  }

  if (club) {
    const seats = club.zones?.flatMap((z) => z.seats) ?? [];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0810", padding: 16 }}>
        <Button title="Назад" onPress={() => setClub(null)} />
        <Text style={{ color: "white", fontSize: 22, marginVertical: 8 }}>{club.name}</Text>
        {seats.map((s) => (
          <TouchableOpacity key={s.id} onPress={() => book(s, club.tariffs[0]?.id)} style={card}>
            <Text style={{ color: "white" }}>
              {s.label} · {s.status}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={{ color: "#4ade80", marginTop: 8 }}>{msg}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0810", padding: 16 }}>
      <StatusBar style="light" />
      <Text style={{ color: "white", fontSize: 22, marginBottom: 12 }}>Клубы рядом</Text>
      <FlatList
        data={clubs}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={card}
            onPress={() => api(`/api/v1/clubs/${item.slug}`).then(setClub)}
          >
            <Text style={{ color: "white", fontSize: 18 }}>{item.name}</Text>
            <Text style={{ color: "#94a3b8" }}>
              {item.city} · свободно {item.freeSeats}/{item.totalSeats}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const input = { backgroundColor: "#1A1230", color: "white", padding: 12, marginVertical: 8, borderRadius: 8 };
const card = { backgroundColor: "#1A1230", padding: 16, borderRadius: 12, marginBottom: 8 };
