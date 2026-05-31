// Supabase integration is deprecated in favor of Firebase Cloud Firestore.
// Refer to src/lib/firebase.ts for the active cloud database connection.
export const isSupabaseConfigured = () => false;
export const getSupabaseCredentials = async () => ({ url: null, anonKey: null });
export const clearSupabaseCredentials = async () => {};
