const recoveryKey = "piikki-recovery-v1";

export function loadRecovery(): Uint8Array | undefined {
  const value = localStorage.getItem(recoveryKey);
  if (!value) return;
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
export function persist(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  localStorage.setItem(recoveryKey, btoa(binary));
}
