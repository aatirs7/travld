import { type ThemeColors, radius, spacing, Text, useLayout } from "@travld/ui";
import { pluralize, relativeTime } from "@travld/core";
import { useAppColors } from "@/lib/app-theme";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
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

interface FeedGroup {
  key: string;
  displayName: string;
  handle: string;
  count: number;
  placeName: string;
  placeLevel: string;
  countryName: string | null;
  createdAt: string; // most recent event in the burst (feed is newest-first)
}

/** Plural noun for a place level, e.g. level "city" + n=6 → "6 cities". */
function levelCount(n: number, level: string): string {
  switch (level) {
    case "city": return pluralize(n, "city", "cities");
    case "country": return pluralize(n, "country", "countries");
    case "region": return pluralize(n, "region");
    case "continent": return pluralize(n, "continent");
    default: return pluralize(n, "place");
  }
}

/**
 * Collapse consecutive events from the same user in the same country/level into
 * one row ("Omar added 6 cities in Pakistan · 2d") instead of six identical rows.
 * Feed arrives newest-first, so the first item of a burst carries the timestamp.
 */
function collapseFeed(items: FeedItem[]): FeedGroup[] {
  const groups: FeedGroup[] = [];
  for (const f of items) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.displayName === f.displayName &&
      last.countryName === f.countryName &&
      last.placeLevel === f.placeLevel
    ) {
      last.count += 1;
    } else {
      groups.push({
        key: `${f.id}`,
        displayName: f.displayName,
        handle: f.handle,
        count: 1,
        placeName: f.placeName,
        placeLevel: f.placeLevel,
        countryName: f.countryName,
        createdAt: f.createdAt,
      });
    }
  }
  return groups;
}

function Feed({ items, L }: { items: FeedItem[] | null; L: ReturnType<typeof useLayout> }) {
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  const groups = useMemo(() => (items ? collapseFeed(items) : []), [items]);
  if (items == null) return <ActivityIndicator color={tc.mint} />;
  if (items.length === 0) return <Text variant="body" style={styles.dim}>No activity yet. Follow people to see their trips.</Text>;
  return (
    <>
      {groups.map((g) => {
        const when = relativeTime(g.createdAt);
        return (
          <View key={g.key} style={[styles.row, { minHeight: L.listRow }]}>
            <View style={styles.avatar}>
              <Text variant="body" style={styles.avatarText}>{g.handle[0].toUpperCase()}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text variant="body" numberOfLines={1} style={styles.rowText}>
                <Text variant="body" style={styles.bold}>{g.displayName}</Text>
                {g.count > 1
                  ? ` added ${levelCount(g.count, g.placeLevel)}${g.countryName ? ` in ${g.countryName}` : ""}`
                  : ` · ${g.placeName}`}
              </Text>
              <Text variant="body" numberOfLines={1} style={styles.rowSub}>
                {(g.count > 1 ? "" : `${g.countryName ?? g.placeLevel}`)}
                {when ? `${g.count > 1 ? "" : " · "}${when}` : ""}
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

function Board({ rows, L }: { rows: LeaderRow[] | null; L: ReturnType<typeof useLayout> }) {
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  if (rows == null) return <ActivityIndicator color={tc.mint} />;
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
              {pluralize(r.regions, "region")} · {pluralize(r.cities, "city", "cities")}
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
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  if (people == null) return <ActivityIndicator color={tc.mint} />;
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
            <Text variant="body" style={styles.rowSub}>{pluralize(p.countries, "country", "countries")}</Text>
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
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
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
          <View style={styles.center}><ActivityIndicator color={tc.mint} /></View>
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
              <Legend color={tc.textDim} label={`Only them · ${data.onlyThem.length}`} />
            </View>
            <Text variant="body" style={styles.compareLine}>
              You’ve both been to {pluralize(data.both.length, "country", "countries")}.
            </Text>
            <Text variant="body" style={styles.compareLine}>
              {data.otherName} has been to {pluralize(data.onlyThem.length, "country", "countries")} you haven’t.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="body" style={styles.legendText}>{label}</Text>
    </View>
  );
}

const makeStyles = (tc: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 28, fontWeight: "700", color: tc.textPrimary, flex: 1 },
  segment: { flexDirection: "row", backgroundColor: tc.surface, borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.pill },
  segItemActive: { backgroundColor: tc.surfaceAlt },
  segText: { color: tc.textDim, fontSize: 13 },
  segTextActive: { color: tc.textPrimary, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowMe: { backgroundColor: tc.surface, borderRadius: radius.card, paddingHorizontal: spacing.sm },
  rowMain: { flex: 1 },
  rowText: { color: tc.textPrimary, fontSize: 16 },
  rowSub: { color: tc.textDim, fontSize: 13 },
  bold: { fontWeight: "700" },
  dim: { color: tc.textDim },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: tc.surfaceAlt, alignItems: "center", justifyContent: "center" },
  avatarText: { color: tc.mint, fontWeight: "700" },
  rank: { width: 24, color: tc.textDim, fontSize: 16, fontWeight: "700", textAlign: "center" },
  count: { color: tc.mint, fontSize: 22, fontWeight: "700" },
  compareBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: tc.mint },
  compareText: { color: tc.mint, fontWeight: "600", fontSize: 13 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm },
  close: { color: tc.mint, fontSize: 17, fontWeight: "600" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: tc.textPrimary, fontSize: 13 },
  compareLine: { color: tc.textPrimary, fontSize: 16, textAlign: "center" },
  tagHeader: { color: tc.mint, fontSize: 15, fontWeight: "700" },
  tagCard: { backgroundColor: tc.surface, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  tagText: { color: tc.textPrimary, fontSize: 15 },
  tagActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  declineBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: tc.surfaceAlt },
  declineText: { color: tc.textDim, fontWeight: "600" },
  acceptBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: tc.mint },
  acceptText: { color: tc.bg, fontWeight: "700" },
});

