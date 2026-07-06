/**
 * Client-side validation helpers for the auth forms.
 *
 * These mirror the rules enforced by the database (for example the 3-20
 * character username check constraint) so users get instant feedback before a
 * request is ever sent. Each function returns an error string, or null when the
 * value is valid.
 */

export function validateUsername(username: string): string | null {
  const value = username.trim();
  if (value.length < 3 || value.length > 20) {
    return "Username must be between 3 and 20 characters.";
  }
  // Keep usernames URL- and mention-friendly: letters, numbers, underscores.
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return "Username can only contain letters, numbers, and underscores.";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  // Deliberately simple: a stricter check happens server-side at Supabase.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}
