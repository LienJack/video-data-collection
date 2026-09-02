export function resolveAdminEmail(
  identity: string,
  configured: { username: string; email: string },
) {
  const normalizedIdentity = identity.trim().toLowerCase();
  const normalizedUsername = configured.username.trim().toLowerCase();
  if (normalizedIdentity === normalizedUsername) return configured.email.trim().toLowerCase();
  return normalizedIdentity.includes("@") ? normalizedIdentity : null;
}
