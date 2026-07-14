import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CompareMap } from "@/components/CompareMap";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  api,
  type CompareResult,
  type FeedItem,
  type LeaderRow,
  type PendingTag,
  type PersonRow,
} from "@/lib/api";
import { useMapTheme } from "@/lib/map-theme-context";

type Tab = "feed" | "board" | "friends";
const TABS: Tab[] = ["feed", "board", "friends"];
const TAB_LABEL: Record<Tab, string> = { feed: "Feed", board: "Leaderboard", friends: "Friends" };

export default function FriendsScreen() {
  const L = useLayout();
  const [tab, setTab] = useState<Tab>("feed");
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [board, setBoard] = useState<LeaderRow[] | null>(null);
  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [tags, setTags] = useState<PendingTag[]>([]);
  const [compareId, setCompareId] = useState<string | null>(null);

  const loadTags = useCallback(() => {
    api.getPendingTags().then((r) => setTags(r.tags)).catch(() => setTags([]));
  }, []);

  useEffect(() => {
    if (tab === "feed" && feed == null) api.getFeed().then((r) => setFeed(r.feed)).catch(() => setFeed([]));
    if (tab === "feed") loadTags();
    if (tab === "board" && board == null) api.getLeaderboard().then((r) => setBoard(r.leaderboard)).catch(() => setBoard([]));
    if (tab === "friends" && people == null) api.getFollowing().then((r) => setPeople(r.following)).catch(() => setPeople([]));
  }, [tab, feed, board, people, loadTags]);

  const respond = useCallback(
    (t: PendingTag, accept: boolean) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      api.respondTag(t.visitId, accept).then(() => {
        setTags((cur) => cur.filter((x) => x.visitId !== t.visitId));
        if (accept) {
          Alert.alert("Add to your map?", `Log your own visit to ${t.placeName}?`, [
            { text: "Not now", style: "cancel" },
            {
              text: "Add it",
              onPress: () => api.createVisit({ placeId: t.placeId }).catch(() => {}),
            },
          ]);
        }
      });
    },
    [],
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Friends" />
      <View style={{ paddingHorizontal: L.gutter, paddingBottom: spacing.sm }}>
        <View style={styles.segment}>
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segItem, tab === t && styles.segItemActive]}>
              <Text variant="body" style={[styles.segText, tab === t && styles.segTextActive]}>
                {TAB_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: L.gutter, paddingTop: spacing.md, paddingBottom: L.scrollPadBottom, gap: spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "feed" && tags.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text variant="hero" style={styles.tagHeader}>Tagged you</Text>
            {tags.map((t) => (
              <View key={t.visitId} style={styles.tagCard}>
                <Text variant="body" numberOfLines={2} style={styles.tagText}>
                  <Text variant="body" style={styles.bold}>{t.taggerName}</Text> tagged you in {t.placeName}
                  {t.countryName ? `, ${t.countryName}` : ""}
                </Text>
                <View style={styles.tagActions}>
                  <Pressable onPress={() => respond(t, false)} style={styles.declineBtn}>
                    <Text variant="body" style={styles.declineText}>Decline</Text>
                  </Pressable>
                  <Pressable onPress={() => respond(t, true)} style={styles.acceptBtn}>
                    <Text variant="body" style={styles.acceptText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
        {tab === "feed" && <Feed items={feed} L={L} />}
        {tab === "board" && <Board rows={board} L={L} />}
        {tab === "friends" && <Friends people={people} L={L} onCompare={setCompareId} />}
      </ScrollView>

      <CompareModal userId={compareId} onClose={() => setCompareId(null)} />
    </View>
  );
}

function Feed({ items, L }: { items: FeedItem[] | null; L: ReturnType<typeof useLayout> }) {
  if (items == null) return <ActivityIndicator color={colors.mint} />;
  if (items.length === 0) return <Text variant="body" style={styles.dim}>No activity yet. Follow people to see their trips.</Text>;
  return (
    <>
      {items.map((f) => (
        <View key={f.id} style={[styles.row, { minHeight: L.listRow }]}>
          <View style={styles.avatar}>
            <Text variant="body" style={styles.avatarText}>{f.handle[0].toUpperCase()}</Text>
          </View>
          <View style={styles.rowMain}>
            <Text variant="body" numberOfLines={1} style={styles.rowText}>
              <Text variant="body" style={styles.bold}>{f.displayName}</Text> · {f.placeName}
            </Text>
            <Text variant="body" numberOfLines={1} style={styles.rowSub}>
              {f.countryName ?? f.placeLevel}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

function Board({ rows, L }: { rows: LeaderRow[] | null; L: ReturnType<typeof useLayout> }) {
  if (rows == null) return <ActivityIndicator color={colors.mint} />;
  return (
    <>
      {rows.map((r, i) => (
        <View key={r.id} style={[styles.row, { minHeight: L.listRow }, r.isMe && styles.rowMe]}>
          <Text variant="hero" style={styles.rank}>{i + 1}</Text>
          <View style={styles.rowMain}>
            <Text variant="body" numberOfLines={1} style={styles.rowText}>
              {r.displayName}{r.isMe ? " (you)" : ""}
            </Text>
            <Text variant="body" style={styles.rowSub}>
              {r.regions} regions · {r.cities} cities
            </Text>
          </View>
          <Text variant="hero" style={styles.count}>{r.countries}</Text>
        </View>
      ))}
    </>
  );
}

function Friends({
  people,
  L,
  onCompare,
}: {
  people: PersonRow[] | null;
  L: ReturnType<typeof useLayout>;
  onCompare: (id: string) => void;
}) {
  if (people == null) return <ActivityIndicator color={colors.mint} />;
  if (people.length === 0) return <Text variant="body" style={styles.dim}>You’re not following anyone yet.</Text>;
  return (
    <>
      {people.map((p) => (
        <View key={p.id} style={[styles.row, { minHeight: L.listRow }]}>
          <View style={styles.avatar}>
            <Text variant="body" style={styles.avatarText}>{p.handle[0].toUpperCase()}</Text>
          </View>
          <View style={styles.rowMain}>
            <Text variant="body" numberOfLines={1} style={styles.rowText}>{p.displayName}</Text>
            <Text variant="body" style={styles.rowSub}>{p.countries} countries</Text>
          </View>
          <Pressable onPress={() => onCompare(p.id)} style={styles.compareBtn}>
            <Text variant="body" style={styles.compareText}>Compare</Text>
          </Pressable>
        </View>
      ))}
    </>
  );
}

function CompareModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const L = useLayout();
  const { theme } = useMapTheme();
  const [data, setData] = useState<CompareResult | null>(null);

  const load = useCallback(async (id: string) => {
    setData(null);
    try {
      setData(await api.compare(id));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  return (
    <Modal visible={userId != null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.modalHeader, { paddingTop: L.insets.top + spacing.sm, paddingHorizontal: L.gutter }]}>
          <Text variant="hero" style={styles.h1} numberOfLines={1}>
            {data ? `You & ${data.otherName}` : "Compare"}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text variant="hero" style={styles.close}>Done</Text>
          </Pressable>
        </View>
        {!data ? (
          <View style={styles.center}><ActivityIndicator color={colors.mint} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: L.gutter, paddingBottom: L.scrollPadBottom, gap: spacing.md }}>
            <CompareMap
              both={new Set(data.both)}
              onlyMe={new Set(data.onlyMe)}
              onlyThem={new Set(data.onlyThem)}
              theme={theme}
            />
            <View style={styles.legend}>
              <Legend color={theme.visited} label={`Both · ${data.both.length}`} />
              <Legend color={theme.partial} label={`Only you · ${data.onlyMe.length}`} />
              <Legend color={colors.textDim} label={`Only them · ${data.onlyThem.length}`} />
            </View>
            <Text variant="body" style={styles.compareLine}>
              You’ve both been to {data.both.length} countries.
            </Text>
            <Text variant="body" style={styles.compareLine}>
              {data.otherName} has been to {data.onlyThem.length} you haven’t.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="body" style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.pill },
  segItemActive: { backgroundColor: colors.surfaceAlt },
  segText: { color: colors.textDim, fontSize: 13 },
  segTextActive: { color: colors.textPrimary, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowMe: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: spacing.sm },
  rowMain: { flex: 1 },
  rowText: { color: colors.textPrimary, fontSize: 16 },
  rowSub: { color: colors.textDim, fontSize: 13 },
  bold: { fontWeight: "700" },
  dim: { color: colors.textDim },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.mint, fontWeight: "700" },
  rank: { width: 24, color: colors.textDim, fontSize: 16, fontWeight: "700", textAlign: "center" },
  count: { color: colors.mint, fontSize: 22, fontWeight: "700" },
  compareBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.mint },
  compareText: { color: colors.mint, fontWeight: "600", fontSize: 13 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm },
  close: { color: colors.mint, fontSize: 17, fontWeight: "600" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: colors.textPrimary, fontSize: 13 },
  compareLine: { color: colors.textPrimary, fontSize: 16, textAlign: "center" },
  tagHeader: { color: colors.mint, fontSize: 15, fontWeight: "700" },
  tagCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  tagText: { color: colors.textPrimary, fontSize: 15 },
  tagActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  declineBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  declineText: { color: colors.textDim, fontWeight: "600" },
  acceptBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.mint },
  acceptText: { color: colors.bg, fontWeight: "700" },
});

