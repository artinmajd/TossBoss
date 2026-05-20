const SUPABASE_URL = 'https://xjqsfiszpxfptvnpzayz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcXNmaXN6cHhmcHR2bnB6YXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNDAzMDEsImV4cCI6MjA5NDgxNjMwMX0.tQmBQLSCOnRPTOwFOqkKlOc7nk2rTLnnZ3odgdPHEDU';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getHighScores() {
    const empty = { pingpong: { score: 0, bestStreak: 0 }, basketball: { score: 0, bestStreak: 0 } };
    const { data, error } = await supabase
        .from('high_scores')
        .select('mode, score, best_streak');
    if (error) return empty;
    const result = { ...empty };
    data.forEach(row => {
        result[row.mode] = { score: row.score, bestStreak: row.best_streak || 0 };
    });
    return result;
}

export async function saveHighScore(mode, score, bestStreak) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const display_name = user.user_metadata?.name || user.email;
    await supabase.from('high_scores').upsert(
        { user_id: user.id, mode, score, best_streak: bestStreak, display_name },
        { onConflict: 'user_id,mode' }
    );
}

export async function getLeaderboard(mode, sortBy = 'score') {
    const col = sortBy === 'best_streak' ? 'best_streak' : 'score';
    const { data, error } = await supabase
        .from('high_scores')
        .select('display_name, score, best_streak')
        .eq('mode', mode)
        .order(col, { ascending: false })
        .limit(10);
    if (error) return [];
    return data;
}
