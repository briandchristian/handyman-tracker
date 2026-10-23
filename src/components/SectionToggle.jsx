/**
 * Heading that expands or contracts the section beneath it.
 * Headings start closed on a new login. An opened heading stays open
 * while moving between pages in this login, and closes again at the next sign-in.
 * The heading button toggles the body. Side actions stay clickable on their own.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { sectionIsOpen, sectionToggleKey, setSectionOpen } from '../constants/sectionToggles';

function SectionToggleBody({
  pathname,
  title,
  children,
  open,
  onOpenChange,
  actions = null,
  nested = false,
  plain = false,
  className = '',
  id,
  ariaLabel,
  testId,
}) {
  const storageKey = sectionToggleKey(pathname, title);
  const panelId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(() => sectionIsOpen(storageKey));
  const expanded = open === undefined ? uncontrolledOpen : open;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const skipInitialClosed = useRef(open === false);

  useEffect(() => {
    if (open === undefined) return undefined;
    if (skipInitialClosed.current) {
      skipInitialClosed.current = false;
      if (sectionIsOpen(storageKey)) onOpenChangeRef.current?.(true);
      return undefined;
    }
    setSectionOpen(storageKey, Boolean(open));
    return undefined;
  }, [open, storageKey]);

  const setExpanded = (next) => {
    setSectionOpen(storageKey, next);
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const Heading = nested ? 'h3' : 'h2';
  const shell = plain
    ? className
    : nested
      ? `mt-4 border-t border-slate-200 pt-4 ${className}`
      : `card-surface p-4 md:p-6 ${className}`;

  return (
    <section id={id} aria-label={ariaLabel} data-testid={testId} className={shell.trim()}>
      <div className="flex items-center justify-between gap-3">
        <Heading className={nested ? 'text-lg font-semibold min-w-0' : 'text-xl font-semibold min-w-0'}>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-left"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded(!expanded)}
          >
            <span aria-hidden="true" className="text-slate-500 w-4">{expanded ? '▾' : '▸'}</span>
            {title}
          </button>
        </Heading>
        {actions}
      </div>
      <div id={panelId} hidden={!expanded} className={expanded ? 'mt-4' : undefined}>
        {children}
      </div>
    </section>
  );
}

function RoutedSectionToggle(props) {
  const { pathname } = useLocation();
  return <SectionToggleBody {...props} pathname={pathname} />;
}

export default function SectionToggle(props) {
  if (!useInRouterContext()) {
    return <SectionToggleBody {...props} pathname={window.location.pathname || '/'} />;
  }
  return <RoutedSectionToggle {...props} />;
}
