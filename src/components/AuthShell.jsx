import PublicNav from './PublicNav';

/**
 * Public auth/lead chrome matching the home page:
 * sticky PublicNav + dark slate/emerald hero + centered content column.
 * Login and bid use this so they no longer look like a separate gray/teal app.
 */
export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  afterHero,
  contentTestId,
}) {
  return (
    <div data-testid="auth-shell" className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNav />
      <section
        data-testid="auth-hero"
        className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white min-h-[calc(100vh-4.5rem)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(16,185,129,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(56,189,248,0.12), transparent 40%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <div
          data-testid={contentTestId}
          className="relative px-4 py-10 md:px-8 md:py-16 max-w-md mx-auto w-full"
        >
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-slate-300 text-base leading-relaxed">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </section>
      {afterHero}
    </div>
  );
}
