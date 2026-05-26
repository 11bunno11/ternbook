/** Epoch increments by 1 every 2 calendar months (Jan+Feb share epoch 0, Mar+Apr share epoch 1, etc.) */
export function currentEpoch(): number {
  const now = new Date();
  return Math.floor((now.getUTCFullYear() * 12 + now.getUTCMonth()) / 2);
}
