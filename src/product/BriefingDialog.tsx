import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export function BriefingDialog({ error, retry, back }: {
  error: string;
  retry: () => void;
  back: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    heading.current?.focus();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="briefing-dialog" aria-labelledby="briefing-title" onCancel={(event) => event.preventDefault()} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first) { event.preventDefault(); heading.current?.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>
    <div className="briefing-card">
      <span className="briefing-mark"><Check size={28} /></span>
      <p className="eyebrow">SESSION SAVED</p>
      <h2 id="briefing-title" tabIndex={-1} ref={heading}>Interview complete</h2>
      {error ? <>
        <p>We couldn’t prepare your briefing yet. Your saved answers are safe.</p>
        <p className="briefing-error" role="alert">{error}</p>
        <button className="primary" onClick={retry}>Try preparing briefing again</button>
        <button className="text-button" onClick={back}>Return to dashboard</button>
      </> : <div role="status">
        <p>Maya is preparing your briefing, answer feedback, and next-step study plan.</p>
        <div className="briefing-progress" aria-hidden="true"><i /><i /><i /></div>
        <small>This can take a little time. Please keep this window open.</small>
      </div>}
    </div>
  </dialog>;
}
