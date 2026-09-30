/**
 * Bid worksheet materials keep the order they are stored in.
 * Dragging a line onto another line moves it to that position.
 * A saved order must list every existing line exactly once.
 */

/**
 * @param {Array<{ _id: unknown }>} lines
 * @param {unknown} fromId
 * @param {unknown} toId
 * @returns {Array<{ _id: unknown }>}
 */
export function moveBidMaterial(lines, fromId, toId) {
  const list = Array.isArray(lines) ? lines : [];
  const from = list.findIndex((line) => String(line._id) === String(fromId));
  const to = list.findIndex((line) => String(line._id) === String(toId));
  if (from < 0 || to < 0 || from === to) return list;
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * @param {Array<{ _id: unknown }>} lines
 * @param {unknown[]} orderedIds
 * @returns {Array<{ _id: unknown }>}
 */
export function reorderByIds(lines, orderedIds) {
  const list = Array.isArray(lines) ? lines : [];
  if (!Array.isArray(orderedIds) || orderedIds.length !== list.length) {
    throw new Error('Bid worksheet order must list every line once');
  }
  const byId = new Map(list.map((line) => [String(line._id), line]));
  const seen = new Set();
  const next = [];
  for (const id of orderedIds) {
    const key = String(id);
    const line = byId.get(key);
    if (!line || seen.has(key)) {
      throw new Error('Bid worksheet order must list every line once');
    }
    seen.add(key);
    next.push(line);
  }
  return next;
}
