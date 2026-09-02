export type UploadSessionOption = {
  publicId: string;
  status: string;
};

export type UploadSessionContext<T extends UploadSessionOption> =
  | { kind: "generic" }
  | { kind: "invalid" }
  | { kind: "locked"; session: T };

export function resolveUploadSessionContext<T extends UploadSessionOption>(
  requestedSession: string | string[] | undefined,
  sessions: T[],
): UploadSessionContext<T> {
  if (requestedSession === undefined) return { kind: "generic" };
  if (typeof requestedSession !== "string" || requestedSession.length === 0) {
    return { kind: "invalid" };
  }

  const session = sessions.find((candidate) => (
    candidate.publicId === requestedSession && candidate.status === "open"
  ));
  return session ? { kind: "locked", session } : { kind: "invalid" };
}
