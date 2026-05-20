const SUPABASE_URL = 'https://xjqsfiszpxfptvnpzayz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcXNmaXN6cHhmcHR2bnB6YXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNDAzMDEsImV4cCI6MjA5NDgxNjMwMX0.tQmBQLSCOnRPTOwFOqkKlOc7nk2rTLnnZ3odgdPHEDU';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getHighScores() {
    const { data, error } = await supabase
        .from('high_scores')
        .select('mode, score');
    if (error) return { pingpong: 0, basketball: 0 };
    const scores = { pingpong: 0, basketball: 0 };
    data.forEach(row => { scores[row.mode] = row.score; });
    return scores;
}

export async function saveHighScore(mode, score) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('high_scores').upsert(
        { user_id: user.id, mode, score },
        { onConflict: 'user_id,mode' }
    );
}
