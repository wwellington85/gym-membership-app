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
  { bg: "bg-sky-400/20", border: "border-sky-300/40", text: "text-sky-200" },
  { bg: "bg-emerald-400/20", border: "border-emerald-300/40", text: "text-emerald-200" },
  { bg: "bg-amber-400/20", border: "border-amber-300/40", text: "text-amber-200" },
  { bg: "bg-fuchsia-400/20", border: "border-fuchsia-300/40", text: "text-fuchsia-200" },
  { bg: "bg-cyan-400/20", border: "border-cyan-300/40", text: "text-cyan-200" },
  { bg: "bg-indigo-400/20", border: "border-indigo-300/40", text: "text-indigo-200" },
  { bg: "bg-rose-400/20", border: "border-rose-300/40", text: "text-rose-200" },
  { bg: "bg-teal-400/20", border: "border-teal-300/40", text: "text-teal-200" },
];

const AVATAR_GLYPHS = ["◉", "◆", "▲", "●", "✦", "■", "✶", "⬢"];

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
};

export type LeaderboardRow = RankedRowBase & {
  alias: string;
  avatar: LeaderboardAvatar;
  isCurrentMember: boolean;
};

export type MemberLeaderboardSnapshot = {
  monthLabel: string;
  rows: LeaderboardRow[];
  nearRows: LeaderboardRow[];
  topRows: LeaderboardRow[];
  myRank: number | null;
  myCheckins: number;
  totalRanked: number;
  nextGap: number | null;
};

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

function avatarForMember(memberId: string): LeaderboardAvatar {
  const h = hashString(memberId);
  const theme = AVATAR_THEMES[h % AVATAR_THEMES.length] ?? AVATAR_THEMES[0];
  const glyph = AVATAR_GLYPHS[(h >>> 7) % AVATAR_GLYPHS.length] ?? "◉";

  return {
    glyph,
    bgClass: theme.bg,
    borderClass: theme.border,
    textClass: theme.text,
  };
}

export async function getMemberLeaderboardSnapshot({
  supabase,
  memberId,
  nearWindow = 5,
}: {
  supabase: any;
  memberId: string;
  nearWindow?: number;
}): Promise<MemberLeaderboardSnapshot> {
  const { year, month } = currentJamaicaYearMonth();
  const startIso = monthStartUtcIsoFromJamaicaYearMonth(year, month);
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endIso = monthStartUtcIsoFromJamaicaYearMonth(nextMonthYear, nextMonth);

  const { data, error } = await supabase
    .from("checkins")
    .select("member_id, checked_in_at")
    .gte("checked_in_at", startIso)
    .lt("checked_in_at", endIso);

  if (error) {
    return {
      monthLabel: `${monthLabelJamaica()} (Jamaica)`,
      rows: [],
      nearRows: [],
      topRows: [],
      myRank: null,
      myCheckins: 0,
      totalRanked: 0,
      nextGap: null,
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
    avatar: avatarForMember(row.member_id),
    isCurrentMember: row.member_id === memberId,
  });

  const rows = ranked.map(decorate);
  const nearRows = ranked.slice(start, end).map(decorate);
  const topRows = ranked.slice(0, 25).map(decorate);

  const nextRow = myIndex > 0 ? ranked[myIndex - 1] : null;
  const nextGap = nextRow && myRow ? Math.max(nextRow.checkins - myRow.checkins, 0) : null;

  return {
    monthLabel: `${monthLabelJamaica()} (Jamaica)`,
    rows,
    nearRows,
    topRows,
    myRank: myRow?.rank ?? null,
    myCheckins: myRow?.checkins ?? 0,
    totalRanked: ranked.length,
    nextGap,
  };
}
