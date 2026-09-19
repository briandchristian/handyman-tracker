/**
 * Inline success/error for public forms. Replaces window.alert on phones.
 */
export default function FormStatus({ message, tone = 'error' }) {
  if (!message) return null;

  const styles =
    tone === 'success'
      ? 'bg-green-50 border-green-300 text-green-800'
      : 'bg-red-50 border-red-300 text-red-800';

  return (
    <div
      data-testid="form-status"
      role="alert"
      className={`mb-4 p-3 border rounded text-sm ${styles}`}
    >
      {message}
    </div>
  );
}
