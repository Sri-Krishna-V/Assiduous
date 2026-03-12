import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status,
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function startOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const action = segments.length >= 3 ? segments[2] : null;

  try {
    // GET /stats/overview - full dashboard overview
    if (!action || action === "overview") {
      const now = new Date();

      // Total study time (all completed sessions)
      const { data: allSessions } = await supabase
        .from("study_sessions")
        .select("duration_minutes, subject_id, started_at, subjects(name, icon, color)")
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false });

      const sessions = allSessions || [];
      const totalMinutes = sessions.reduce(
        (sum, s) => sum + (s.duration_minutes || 0), 0
      );
      const totalSessions = sessions.length;

      // Today's study time
      const todayStart = startOfDay(now);
      const todayMinutes = sessions
        .filter((s) => s.started_at >= todayStart)
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      // This week's study time (last 7 days)
      const weekStart = daysAgo(7);
      const weekMinutes = sessions
        .filter((s) => s.started_at >= weekStart)
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      // Per-subject breakdown
      const subjectMap = new Map<string, {
        name: string; icon: string; color: string;
        total_minutes: number; session_count: number;
      }>();

      for (const s of sessions) {
        const key = s.subject_id;
        const existing = subjectMap.get(key);
        const subj = s.subjects as { name: string; icon: string; color: string };
        if (existing) {
          existing.total_minutes += s.duration_minutes || 0;
          existing.session_count += 1;
        } else {
          subjectMap.set(key, {
            name: subj?.name || "Unknown",
            icon: subj?.icon || "📘",
            color: subj?.color || "#6366f1",
            total_minutes: s.duration_minutes || 0,
            session_count: 1,
          });
        }
      }

      const bySubject = [...subjectMap.entries()]
        .map(([id, data]) => ({ subject_id: id, ...data }))
        .sort((a, b) => b.total_minutes - a.total_minutes);

      // Study streak (consecutive days with at least one completed session)
      const studyDays = new Set(
        sessions.map((s) => s.started_at.substring(0, 10))
      );
      let streak = 0;
      const today = now.toISOString().substring(0, 10);
      const checkDate = new Date(now);

      // If no session today, start checking from yesterday
      if (!studyDays.has(today)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const dateStr = checkDate.toISOString().substring(0, 10);
        if (studyDays.has(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Daily breakdown for last 7 days
      const dailyBreakdown = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().substring(0, 10);
        const dayMinutes = sessions
          .filter((s) => s.started_at.substring(0, 10) === dateStr)
          .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        dailyBreakdown.push({
          date: dateStr,
          day: d.toLocaleDateString("en-US", { weekday: "short" }),
          minutes: dayMinutes,
        });
      }

      return jsonResponse({
        overview: {
          total_minutes: totalMinutes,
          total_hours: Math.round((totalMinutes / 60) * 10) / 10,
          total_sessions: totalSessions,
          today_minutes: todayMinutes,
          week_minutes: weekMinutes,
          current_streak: streak,
          avg_session_minutes:
            totalSessions > 0
              ? Math.round(totalMinutes / totalSessions)
              : 0,
        },
        by_subject: bySubject,
        daily_breakdown: dailyBreakdown,
      });
    }

    // GET /stats/leaderboard - top subjects ranked by time
    if (action === "leaderboard") {
      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("duration_minutes, subjects(name, icon, color)")
        .not("ended_at", "is", null);

      const subjectTotals = new Map<string, {
        name: string; icon: string; color: string; minutes: number;
      }>();

      for (const s of sessions || []) {
        const subj = s.subjects as { name: string; icon: string; color: string };
        const key = subj?.name || "Unknown";
        const existing = subjectTotals.get(key);
        if (existing) {
          existing.minutes += s.duration_minutes || 0;
        } else {
          subjectTotals.set(key, {
            name: key,
            icon: subj?.icon || "📘",
            color: subj?.color || "#6366f1",
            minutes: s.duration_minutes || 0,
          });
        }
      }

      const leaderboard = [...subjectTotals.values()]
        .sort((a, b) => b.minutes - a.minutes)
        .map((entry, i) => ({
          rank: i + 1,
          ...entry,
          hours: Math.round((entry.minutes / 60) * 10) / 10,
        }));

      return jsonResponse({ leaderboard });
    }

    return errorResponse("Unknown stats endpoint. Try /stats/overview or /stats/leaderboard", 404);
  } catch (err) {
    return errorResponse(`Internal error: ${err.message}`, 500);
  }
});
