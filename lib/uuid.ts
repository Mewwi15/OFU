/**
 * RFC4122 v4 UUID (pure JS). Used for client-generated idempotency keys at
 * checkout (uniqueness is what matters; cryptographic strength is not required).
 * Pure JS so it needs no native crypto module / dev-client rebuild.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
