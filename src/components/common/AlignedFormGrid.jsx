/**
 * Shared aligned form primitives for consistent "label above input" layouts.
 */
export function AlignedFormGrid({ children, className = '', testId }) {
  return (
    <div data-testid={testId} className={`grid grid-cols-12 gap-2 items-end ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AlignedFormField({
  label,
  htmlFor,
  children,
  className = '',
  labelClassName = 'block text-sm font-medium text-gray-700 mb-1'
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClassName}>{label}</label>
      {children}
    </div>
  );
}
