/**
 * Line paid is the cost of the part. Entering it suggests a price of that
 * cost plus 30%. A blank or unusable paid amount does not suggest a price,
 * so a price the user typed can stay until paid changes again.
 */

export function priceFromPaid(paid) {
  if (paid === '' || paid == null) return null;
  const amount = Number(paid);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 130) / 100;
}
