import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Button, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "./api";

export default function App() {
  const [phone, setPhone] = useState("+375291000003");
  const [password, setPassword] = useState("admin123");
  const [token, setToken] = useState(null);
  const [clubId, setClubId] = useState("");
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(null);
  const [guestId, setGuestId] = useState("");
  const [calls, setCalls] = useState([]);
  const [msg, setMsg] = useState("");

  async function login() {
    const t = await api("/api/v1/auth/login", { method: "POST", body: { phone, password } });
    const me = await api("/api/v1/auth/me", { token: t.accessToken });
    const cid = me.clubRoles?.[0]?.clubId;
    setToken(t.accessToken);
    setClubId(cid);
    setSeats(await api(`/api/v1/clubs/${cid}/seat-map`, { token: t.accessToken }));
    setCalls(await api(`/api/v1/clubs/${cid}/calls`, { token: t.accessToken }).catch(() => []));
  }

  async function start() {
    const club = await api(`/api/v1/clubs/${clubId}`, { token });
    await api(`/api/v1/clubs/${clubId}/sessions`, {
      token,
      method: "POST",
      body: { seatId: selected.id, userId: guestId, tariffId: club.tariffs[0].id },
    });
    setSeats(await api(`/api/v1/clubs/${clubId}/seat-map`, { token }));
    setMsg("Сессия запущена");
  }

  async function stop() {
    if (!selected?.sessionId) return;
    await api(`/api/v1/sessions/${selected.sessionId}/stop`, { token, method: "POST", body: {} });
    setSeats(await api(`/api/v1/clubs/${clubId}/seat-map`, { token }));
  }

  if (!token) {
    return (
        <View style={{ flex: 1, backgroundColor: "#0A0810", padding: 24, paddingTop: 64 }}>
        <StatusBar style="light" />
        <Text style={{ color: "#E0B84A", fontSize: 24, fontWeight: "700" }}>RUDEMIR Смена</Text>
        <TextInput value={phone} onChangeText={setPhone} style={input} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={input} />
        <Button title="Войти" onPress={() => login().catch((e) => setMsg(e.message))} />
        <Text style={{ color: "#f87171" }}>{msg}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0A0810", padding: 16, paddingTop: 48 }}>
      <StatusBar style="light" />
      <Text style={{ color: "white", fontSize: 22 }}>Загрузка зала</Text>
      {seats.map((s) => (
        <TouchableOpacity key={s.id} onPress={() => setSelected(s)} style={card}>
          <Text style={{ color: "white" }}>
            {s.label} · {s.status} · {s.guestName || "—"}
          </Text>
        </TouchableOpacity>
      ))}
      {selected && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: "#E0B84A" }}>{selected.label}</Text>
          <TextInput placeholder="UUID гостя" placeholderTextColor="#64748b" value={guestId} onChangeText={setGuestId} style={input} />
          <Button title="Старт" onPress={() => start().catch((e) => setMsg(e.message))} />
          <Button title="Стоп" onPress={() => stop().catch((e) => setMsg(e.message))} />
        </View>
      )}
      {calls.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: "#fbbf24" }}>Вызовы</Text>
          {calls.map((c) => (
            <Text key={c.id} style={{ color: "white", marginTop: 4 }}>
              {c.seat?.label} · {c.user?.displayName} · {c.message || "помощь"}
            </Text>
          ))}
        </View>
      )}
      <Text style={{ color: "#fbbf24", marginTop: 12 }}>{msg}</Text>
    </ScrollView>
  );
}

const input = { backgroundColor: "#1A1230", color: "white", padding: 12, marginVertical: 8, borderRadius: 8 };
const card = { backgroundColor: "#1A1230", padding: 14, borderRadius: 10, marginTop: 8 };
