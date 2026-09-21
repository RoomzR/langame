import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Button, SafeAreaView, Text, TextInput, View } from "react-native";
import { api } from "./api";

export default function App() {
  const [phone, setPhone] = useState("+375291000002");
  const [password, setPassword] = useState("owner123");
  const [overview, setOverview] = useState(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const t = await api("/api/v1/auth/login", { method: "POST", body: { phone, password } });
    const me = await api("/api/v1/auth/me", { token: t.accessToken });
    const clubId = me.clubRoles?.[0]?.clubId;
    if (!clubId) throw new Error("Нет клуба у владельца");
    setOverview(await api(`/api/v1/clubs/${clubId}/analytics/overview`, { token: t.accessToken }));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0810", padding: 24 }}>
      <StatusBar style="light" />
      <Text style={{ color: "#E0B84A", fontSize: 24, fontWeight: "700" }}>RUDEMIR Business</Text>
      <TextInput value={phone} onChangeText={setPhone} style={input} />
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={input} />
      <Button title="Открыть дашборд" onPress={() => load().catch((e) => setMsg(e.message))} />
      {overview && (
        <View style={{ marginTop: 24 }}>
          <Text style={stat}>Загрузка {overview.occupancyPct}%</Text>
          <Text style={stat}>Сессии {overview.sessionsToday}</Text>
          <Text style={stat}>Выручка {(overview.sessionRevenueKopecks / 100).toFixed(2)} Br</Text>
          <Text style={stat}>Бар {(overview.barRevenueKopecks / 100).toFixed(2)} Br</Text>
        </View>
      )}
      <Text style={{ color: "#f87171", marginTop: 12 }}>{msg}</Text>
    </SafeAreaView>
  );
}

const input = { backgroundColor: "#1A1230", color: "white", padding: 12, marginVertical: 8, borderRadius: 8 };
const stat = { color: "white", fontSize: 20, marginTop: 8 };
