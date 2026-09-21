"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skel ${className}`} aria-hidden />;
}

export function EmptyState({ text, href, action = "Клубы" }: { text: string; href?: string; action?: string }) {
  return (
    <div className="py-16 text-center">
      <p className="display text-[36px] text-dim">{text}</p>
      {href && (
        <a href={href} className="link-coral mt-4 inline-block">
          {action}
        </a>
      )}
    </div>
  );
}

export function ErrorBanner({ text = "Связь потеряна. Повторить", onRetry }: { text?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="error-hud font-medium">{text}</p>
      {onRetry && (
        <button type="button" className="btn-retry" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function SuccessMark({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-ink" role="status">
      <i className="mark-rect" aria-hidden />
      {text}
    </p>
  );
}
