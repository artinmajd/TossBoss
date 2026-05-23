// Tester config — custom rules that apply ONLY when the test user is logged
// in. They never affect normal players. Edit the values below freely.

// True if the given Supabase session belongs to the test user.
// Detection is via app_metadata.is_tester (set server-side in Supabase Auth
// → Users → Edit → app_metadata), so no email is hard-coded here.
export function isTestUser(session) {
    return !!session && session.user?.app_metadata?.is_tester === true;
}

// Custom-rule parameters for the test user — tweak these as needed.
export const testerConfig = {
    // Rule 1 — press on the ball to drag it to any position before a throw.
    freeBallPlacement: true,

    // Rule 2 — the black hole spawns this many shots into a run.
    // Normal players: 10. Lowering it makes the black hole easy to test.
    blackHoleShotThreshold: 1,
};
