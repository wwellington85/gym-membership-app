const JAMAICA_TZ = "America/Jamaica";
const JAMAICA_UTC_OFFSET_HOURS = 5; // Jamaica has no DST (UTC-5 year-round)

const ADJECTIVES = [
  "Palm",
  "Lagoon",
  "Coral",
  "Sunset",
  "Breeze",
  "Harbor",
  "Island",
  "Cove",
  "Ocean",
  "Sand",
  "Tropic",
  "Marlin",
];

const ANIMALS = [
  "Runner",
  "Voyager",
  "Surfer",
  "Pelican",
  "Parrot",
  "Dolphin",
  "Skipper",
  "Sprinter",
  "Navigator",
  "Pioneer",
  "Drifter",
  "Seeker",
];

const AVATAR_THEMES = [
  {
    bg: "bg-gradient-to-br from-sky-400/35 to-indigo-500/35",
    border: "border-sky-200/40",
    text: "text-sky-100",
    accent: "bg-sky-200/70",
  },
  {
    bg: "bg-gradient-to-br from-emerald-400/35 to-teal-500/35",
    border: "border-emerald-200/40",
    text: "text-emerald-100",
    accent: "bg-emerald-200/70",
  },
  {
    bg: "bg-gradient-to-br from-amber-400/35 to-orange-500/35",
    border: "border-amber-200/40",
    text: "text-amber-100",
    accent: "bg-amber-200/70",
  },
  {
    bg: "bg-gradient-to-br from-fuchsia-400/35 to-violet-500/35",
    border: "border-fuchsia-200/40",
    text: "text-fuchsia-100",
    accent: "bg-fuchsia-200/70",
  },
  {
    bg: "bg-gradient-to-br from-cyan-400/35 to-blue-500/35",
    border: "border-cyan-200/40",
    text: "text-cyan-100",
    accent: "bg-cyan-200/70",
  },
  {
    bg: "bg-gradient-to-br from-indigo-400/35 to-purple-500/35",
    border: "border-indigo-200/40",
    text: "text-indigo-100",
    accent: "bg-indigo-200/70",
  },
  {
    bg: "bg-gradient-to-br from-rose-400/35 to-pink-500/35",
    border: "border-rose-200/40",
    text: "text-rose-100",
    accent: "bg-rose-200/70",
  },
  {
    bg: "bg-gradient-to-br from-teal-400/35 to-cyan-500/35",
    border: "border-teal-200/40",
    text: "text-teal-100",
    accent: "bg-teal-200/70",
  },
];

const AVATAR_GLYPHS = ["🌴", "🌊", "☀️", "🐚", "⛵", "🦜", "🐬", "⭐"];

type RawCheckin = {
  member_id: string | null;
  checked_in_at: string | null;
};

type RankedRowBase = {
  member_id: string;
  checkins: number;
  last_checkin_at: string | null;
  rank: number;
};

export type LeaderboardAvatar = {
  glyph: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  accentClass: string;
};

export type LeaderboardRow = RankedRowBase & {
  alias: string;
  avatar: LeaderboardAvatar;
  isCurrentMember: boolean;
};

export type MemberLeaderboardSnapshot = {
  periodLabel: string;
  rows: LeaderboardRow[];
  nearRows: LeaderboardRow[];
  topRows: LeaderboardRow[];
  myRank: number | null;
  myCheckins: number;
  totalRanked: number;
  nextGap: number | null;
  streakDays: number;
  allTimeCheckins: number;
  badges: Array<{ label: string; tone: "teal" | "amber" | "violet" | "rose" | "sky" }>;
};

export type LeaderboardPeriod = "all" | "month";

function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function monthStartUtcIsoFromJamaicaYearMonth(year: number, month1to12: number) {
  const utcMs = Date.UTC(year, month1to12 - 1, 1, JAMAICA_UTC_OFFSET_HOURS, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

function monthLabelJamaica(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: JAMAICA_TZ,
    month: "long",
    year: "numeric",
  }).format(now);
}

function ymdJamaica(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAMAICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function ymdFromTimestampJamaica(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAMAICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function prevYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function computeCurrentStreakDays(memberRows: Array<{ checked_in_at: string | null }>) {
  const uniqueDays = new Set(
    memberRows
      .map((r) => (r.checked_in_at ? ymdFromTimestampJamaica(String(r.checked_in_at)) : null))
      .filter((v): v is string => Boolean(v))
  );

  if (uniqueDays.size === 0) return 0;

  const today = ymdJamaica();
  const yesterday = prevYmd(today);
  let cursor = uniqueDays.has(today) ? today : uniqueDays.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  while (cursor && uniqueDays.has(cursor)) {
    streak += 1;
    cursor = prevYmd(cursor);
  }
  return streak;
}

function deriveBadges(args: {
  streakDays: number;
  allTimeCheckins: number;
  rank: number | null;
  totalRanked: number;
}) {
  const out: Array<{ label: string; tone: "teal" | "amber" | "violet" | "rose" | "sky" }> = [];

  if (args.rank === 1 && args.totalRanked > 1) out.push({ label: "Top Spot", tone: "amber" });
  else if (args.rank && args.rank <= 10) out.push({ label: "Top 10", tone: "violet" });

  if (args.streakDays >= 14) out.push({ label: `${args.streakDays}-Day Streak`, tone: "rose" });
  else if (args.streakDays >= 7) out.push({ label: `${args.streakDays}-Day Streak`, tone: "teal" });
  else if (args.streakDays >= 3) out.push({ label: `${args.streakDays}-Day Streak`, tone: "sky" });

  if (args.allTimeCheckins >= 100) out.push({ label: "Century Club", tone: "amber" });
  else if (args.allTimeCheckins >= 50) out.push({ label: "50 Check-ins", tone: "violet" });
  else if (args.allTimeCheckins >= 25) out.push({ label: "25 Check-ins", tone: "teal" });
  else if (args.allTimeCheckins >= 10) out.push({ label: "10 Check-ins", tone: "sky" });

  return out.slice(0, 4);
}

function currentJamaicaYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAMAICA_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const out: Record<string, string> = {};
  parts.forEach((p) => {
    if (p.type !== "literal") out[p.type] = p.value;
  });

  return {
    year: Number.parseInt(out.year ?? "1970", 10),
    month: Number.parseInt(out.month ?? "1", 10),
  };
}

function aliasForMember(memberId: string) {
  const h = hashString(memberId);
  const adjective = ADJECTIVES[h % ADJECTIVES.length] ?? "Island";
  const animal = ANIMALS[(h >>> 5) % ANIMALS.length] ?? "Member";
  const code = String((h % 9000) + 1000);
  return `${adjective}-${animal}-${code}`;
}

export function getMemberAvatar(memberId: string): LeaderboardAvatar {
  const h = hashString(memberId);
  const theme = AVATAR_THEMES[h % AVATAR_THEMES.length] ?? AVATAR_THEMES[0];
  const glyph = AVATAR_GLYPHS[(h >>> 7) % AVATAR_GLYPHS.length] ?? "◉";

  return {
    glyph,
    bgClass: theme.bg,
    borderClass: theme.border,
    textClass: theme.text,
    accentClass: theme.accent,
  };
}

export async function getMemberLeaderboardSnapshot({
  supabase,
  memberId,
  nearWindow = 5,
  period = "all",
}: {
  supabase: any;
  memberId: string;
  nearWindow?: number;
  period?: LeaderboardPeriod;
}): Promise<MemberLeaderboardSnapshot> {
  const { year, month } = currentJamaicaYearMonth();
  const startIso = monthStartUtcIsoFromJamaicaYearMonth(year, month);
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endIso = monthStartUtcIsoFromJamaicaYearMonth(nextMonthYear, nextMonth);

  let query = supabase.from("checkins").select("member_id, checked_in_at");
  if (period === "month") {
    query = query.gte("checked_in_at", startIso).lt("checked_in_at", endIso);
  }

  const { data, error } = await query;

  if (error) {
    return {
      periodLabel: period === "month" ? `${monthLabelJamaica()}` : "All-time",
      rows: [],
      nearRows: [],
      topRows: [],
      myRank: null,
      myCheckins: 0,
      totalRanked: 0,
      nextGap: null,
      streakDays: 0,
      allTimeCheckins: 0,
      badges: [],
    };
  }

  const byMember = new Map<string, { checkins: number; last_checkin_at: string | null }>();

  ((data ?? []) as RawCheckin[]).forEach((row) => {
    const id = String(row.member_id ?? "").trim();
    if (!id) return;

    const current = byMember.get(id) ?? { checkins: 0, last_checkin_at: null };
    current.checkins += 1;

    const ts = row.checked_in_at ? String(row.checked_in_at) : null;
    if (ts && (!current.last_checkin_at || ts > current.last_checkin_at)) {
      current.last_checkin_at = ts;
    }

    byMember.set(id, current);
  });

  const ranked: RankedRowBase[] = Array.from(byMember.entries())
    .map(([id, agg]) => ({
      member_id: id,
      checkins: agg.checkins,
      last_checkin_at: agg.last_checkin_at,
      rank: 0,
    }))
    .sort((a, b) => {
      if (b.checkins !== a.checkins) return b.checkins - a.checkins;
      if ((b.last_checkin_at ?? "") !== (a.last_checkin_at ?? "")) {
        return (b.last_checkin_at ?? "").localeCompare(a.last_checkin_at ?? "");
      }
      return a.member_id.localeCompare(b.member_id);
    })
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  const myIndex = ranked.findIndex((r) => r.member_id === memberId);
  const myRow = myIndex >= 0 ? ranked[myIndex] : null;

  const start = myIndex >= 0 ? Math.max(0, myIndex - nearWindow) : 0;
  const end =
    myIndex >= 0
      ? Math.min(ranked.length, myIndex + nearWindow + 1)
      : Math.min(ranked.length, nearWindow * 2 + 1);

  const decorate = (row: RankedRowBase): LeaderboardRow => ({
    ...row,
    alias: aliasForMember(row.member_id),
    avatar: getMemberAvatar(row.member_id),
    isCurrentMember: row.member_id === memberId,
  });

  const rows = ranked.map(decorate);
  const nearRows = ranked.slice(start, end).map(decorate);
  const topRows = ranked.slice(0, 25).map(decorate);

  const nextRow = myIndex > 0 ? ranked[myIndex - 1] : null;
  const nextGap = nextRow && myRow ? Math.max(nextRow.checkins - myRow.checkins, 0) : null;

  const { data: memberRows } = await supabase
    .from("checkins")
    .select("checked_in_at")
    .eq("member_id", memberId)
    .order("checked_in_at", { ascending: false })
    .limit(1000);
  const { count: memberCheckinCount } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);

  const allTimeCheckins = Number(memberCheckinCount ?? 0);
  const streakDays = computeCurrentStreakDays((memberRows ?? []) as Array<{ checked_in_at: string | null }>);
  const badges = deriveBadges({
    streakDays,
    allTimeCheckins,
    rank: myRow?.rank ?? null,
    totalRanked: ranked.length,
  });

  return {
    periodLabel: period === "month" ? `${monthLabelJamaica()}` : "All-time",
    rows,
    nearRows,
    topRows,
    myRank: myRow?.rank ?? null,
    myCheckins: myRow?.checkins ?? 0,
    totalRanked: ranked.length,
    nextGap,
    streakDays,
    allTimeCheckins,
    badges,
  };
}
