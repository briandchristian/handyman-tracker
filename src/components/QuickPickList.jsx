/**
 * Saved quick pick rows. Drag a row onto the top half of another to place it
 * above that line, or the bottom half to place it below. Buttons on the row
 * stay clicks. The name-order dropdown is separate from this list.
 */
import { useRef, useState } from 'react';

function dropPlace(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = typeof event.clientY === 'number' ? event.clientY : 0;
  if (!rect.height) return y < 0 ? 'above' : 'below';
  return y < rect.top + rect.height / 2 ? 'above' : 'below';
}

export default function QuickPickList({ picks, onMove, className = '', itemClassName, children }) {
  const draggingId = useRef('');
  const [over, setOver] = useState(null);
  const rows = Array.isArray(picks) ? picks : [];
  if (!rows.length) return null;

  return (
    <ul aria-label="Quick picks" className={`space-y-2 ${className}`.trim()}>
      {rows.map((pick) => {
        const id = String(pick._id);
        const tone = itemClassName?.(pick) || 'border-emerald-200 bg-white';
        const edge = over?.id === id
          ? (over.place === 'above' ? 'border-t-4 border-t-emerald-600' : 'border-b-4 border-b-emerald-600')
          : '';
        return (
          <li
            key={id}
            draggable
            onDragStart={(event) => {
              if (event.target.closest && event.target.closest('button, input, label, a, select')) {
                event.preventDefault();
                return;
              }
              draggingId.current = id;
              if (event.dataTransfer) {
                event.dataTransfer.setData('text/plain', id);
                event.dataTransfer.effectAllowed = 'move';
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
              const place = dropPlace(event);
              setOver((current) => (current?.id === id && current.place === place ? current : { id, place }));
            }}
            onDragLeave={() => setOver((current) => (current?.id === id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const fromId = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || draggingId.current;
              const place = dropPlace(event);
              setOver(null);
              draggingId.current = '';
              if (fromId) onMove(fromId, id, place);
            }}
            onDragEnd={() => {
              draggingId.current = '';
              setOver(null);
            }}
            className={`flex cursor-grab items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm text-slate-800 shadow-md ${tone} ${edge}`}
          >
            {children(pick)}
          </li>
        );
      })}
    </ul>
  );
}
