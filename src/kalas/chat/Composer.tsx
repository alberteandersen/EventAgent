"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '../ui';
import { useLang } from '../i18n';

export interface ComposerHandle { focus: () => void }

/* The message box: grows with what is typed up to a few lines, Enter sends,
   Shift+Enter breaks the line. Typing is allowed while Ava works, sending
   waits until she is done. */
const Composer = forwardRef<ComposerHandle, {
  busy: boolean;
  placeholder: string;
  onSend: (text: string) => void;
}>(function Composer({ busy, placeholder, onSend }, ref) {
  const { t } = useLang();
  const [draft, setDraft] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }), []);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const canSend = !busy && draft.trim().length > 0;
  const send = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className="flex items-end gap-2 rounded-[18px] border border-line bg-card py-1.5 pl-3.5 pr-1.5 shadow-[0_1px_2px_rgba(18,51,43,0.04)] transition-colors focus-within:border-[#b9c4be]"
    >
      <textarea
        ref={area}
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        aria-label={t('Besked til Ava')}
        className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-[7px] text-[0.93rem] leading-[1.45] text-ink placeholder:text-faint focus:outline-none"
      />
      <button
        type="submit"
        aria-label={t('Send besked')}
        disabled={!canSend}
        className={cn(
          'mb-px flex size-9 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 active:scale-95',
          canSend ? 'bg-ink text-canvas hover:bg-ink/90 cursor-pointer' : 'bg-ink/10 text-ink/35',
        )}
      >
        <ArrowUp size={17} strokeWidth={2} />
      </button>
    </form>
  );
});

export default Composer;
