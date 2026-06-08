'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { groupMessagesByDay, SENDER_ROLE_LABEL, type RideMessage } from '@tap/shared';
import { createClient } from '@/lib/supabase/client';
import { useRideMessages, type ChatStatus } from '@/lib/messaging/use-ride-messages';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props {
  rideId: string;
  /** Hauteur de la zone messages (Sheet régulateur vs page chauffeur). */
  className?: string;
}

const dayLabelFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Indian/Reunion',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Indian/Reunion',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_LABEL: Record<ChatStatus, string> = {
  connecting: 'Connexion…',
  connected: 'En direct',
  reconnecting: 'Reconnexion…',
  disconnected: 'Hors ligne',
};

/**
 * Fil de discussion temps réel d'une course (Phase 06.41, DEC-120).
 * Réutilisé côté régulateur (ride-drawer) et chauffeur (ride-detail).
 *
 * A11y : `aria-live="polite"` sur la liste (annonce des nouveaux messages),
 * distinction d'auteur par le LIBELLÉ de rôle (jamais la couleur seule),
 * auto-scroll respectant `prefers-reduced-motion`, clavier (Cmd/Ctrl+Entrée).
 */
export function RideChat({ rideId, className }: Props): JSX.Element {
  const { messages, status, loading, sending, send } = useRideMessages(rideId);
  const [draft, setDraft] = React.useState('');
  const [me, setMe] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  React.useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages]);

  const groups = React.useMemo(() => groupMessagesByDay(messages), [messages]);

  const submit = async () => {
    const body = draft.trim();
    if (body.length === 0 || sending) return;
    const res = await send(body);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setDraft('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Messages
        </h3>
        <span
          className="text-muted-foreground inline-flex items-center gap-4 text-xs"
          aria-live="polite"
        >
          <span
            className={cn(
              'h-8 w-8 rounded-full',
              status === 'connected' ? 'bg-success' : 'bg-muted-foreground/40',
            )}
            aria-hidden
          />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div
        className={cn(
          'border-border bg-muted/30 flex flex-col gap-12 overflow-y-auto rounded-md border p-12',
          className ?? 'max-h-[320px] min-h-[160px]',
        )}
        aria-label="Fil de messages de la course"
        aria-live="polite"
      >
        {loading ? (
          <p className="text-muted-foreground m-auto text-sm">Chargement…</p>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground m-auto text-center text-sm">
            Aucun message. Démarrez la conversation.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.day} className="flex flex-col gap-8">
              <div className="text-muted-foreground text-center text-xs">
                {dayLabelFmt.format(new Date(group.messages[0]!.created_at))}
              </div>
              {group.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  mine={me !== null && m.sender_profile_id === me}
                />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-8">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={2000}
          placeholder="Écrire un message…  (Cmd/Ctrl + Entrée pour envoyer)"
          aria-label="Nouveau message"
          className="min-h-[44px] resize-none"
        />
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={sending || draft.trim().length === 0}
          aria-label="Envoyer le message"
        >
          <Send className="h-16 w-16" aria-hidden />
          <span className="ml-8 hidden sm:inline">Envoyer</span>
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message, mine }: { message: RideMessage; mine: boolean }): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-4', mine ? 'items-end' : 'items-start')}>
      <div className="text-muted-foreground flex items-center gap-8 text-xs">
        <span className="font-medium">{SENDER_ROLE_LABEL[message.sender_role]}</span>
        <span className="tabular-nums">{timeFmt.format(new Date(message.created_at))}</span>
      </div>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-line rounded-md px-12 py-8 text-sm',
          mine ? 'bg-primary text-primary-foreground' : 'bg-background border-border border',
        )}
      >
        {message.body}
      </div>
    </div>
  );
}
