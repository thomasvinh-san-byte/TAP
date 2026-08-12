'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ImagePlus, Send, X } from 'lucide-react';
import { groupMessagesByDay, SENDER_ROLE_LABEL, type RideMessage } from '@tap/shared';
import { createClient } from '@/lib/supabase/client';
import { useRideMessages, type ChatStatus } from '@/lib/messaging/use-ride-messages';
import { getMessageImageUrlAction } from '@/lib/messaging/actions';
import { useDriverAudio } from '@/app/(driver)/_components/driver-audio.client';
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

// Pré-validation client (confort). L'AUTORITÉ reste le serveur
// (`uploadMessageImageAction` + RLS bucket) qui re-valide MIME et taille.
const MESSAGE_IMAGE_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MESSAGE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [me, setMe] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  // PWA-02 (§5.16) : earcon « message » côté chauffeur. Hors zone (driver), le
  // contexte renvoie des no-op (aucun son côté régulateur — canal existant côté
  // chauffeur uniquement).
  const audio = useDriverAudio();
  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  // Earcon sur nouveau message ENTRANT (émis par un autre que soi), jamais au
  // chargement initial de l'historique ni sur ses propres envois.
  React.useEffect(() => {
    if (loading) return;
    if (!initializedRef.current) {
      seenIdsRef.current = new Set(messages.map((m) => m.id));
      initializedRef.current = true;
      return;
    }
    const seen = seenIdsRef.current;
    let incoming = false;
    for (const m of messages) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (me !== null && m.sender_profile_id !== me) incoming = true;
    }
    if (incoming) audio.earcon('message');
  }, [messages, me, loading, audio]);

  React.useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages]);

  const groups = React.useMemo(() => groupMessagesByDay(messages), [messages]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    if (picked && !MESSAGE_IMAGE_ALLOWED_MIME.includes(picked.type)) {
      toast.error('Format non accepté. Images JPEG, PNG ou WebP.');
      e.target.value = '';
      return;
    }
    if (picked && picked.size > MESSAGE_IMAGE_MAX_BYTES) {
      toast.error('Image trop volumineuse (5 Mo maximum).');
      e.target.value = '';
      return;
    }
    setFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async () => {
    const body = draft.trim();
    if ((body.length === 0 && !file) || sending) return;
    const res = await send(body, file ?? undefined);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setDraft('');
    clearFile();
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

      {file ? (
        <div className="border-border bg-muted/30 flex items-center gap-8 rounded-md border px-12 py-8">
          <ImagePlus className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
          <span className="truncate text-sm" title={file.name}>
            {file.name}
          </span>
          <button
            type="button"
            onClick={clearFile}
            className="text-muted-foreground hover:text-foreground ml-auto shrink-0"
            aria-label="Retirer la photo"
          >
            <X className="h-16 w-16" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPickFile}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label="Joindre une photo"
        >
          <ImagePlus className="h-16 w-16" aria-hidden />
        </Button>
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
          disabled={sending || (draft.trim().length === 0 && !file)}
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
      {message.image_path ? <MessageImage messageId={message.id} mine={mine} /> : null}
      {message.body ? (
        <div
          className={cn(
            'max-w-[80%] whitespace-pre-line rounded-md px-12 py-8 text-sm',
            mine ? 'bg-primary text-primary-foreground' : 'bg-background border-border border',
          )}
        >
          {message.body}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Vignette d'une photo de message. Le chemin d'objet n'est jamais exposé : on
 * demande une URL SIGNÉE courte à la Server Action (bucket privé, RLS org-scoped).
 * L'URL est récupérée à l'affichage puis ouvrable en plein écran (nouvel onglet).
 */
function MessageImage({ messageId, mine }: { messageId: string; mine: boolean }): JSX.Element {
  const [url, setUrl] = React.useState<string | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');

  React.useEffect(() => {
    let active = true;
    void getMessageImageUrlAction(messageId).then((res) => {
      if (!active) return;
      if (res.url) {
        setUrl(res.url);
        setState('ready');
      } else {
        setState('error');
      }
    });
    return () => {
      active = false;
    };
  }, [messageId]);

  const frame = cn(
    'flex max-w-[80%] items-center justify-center overflow-hidden rounded-md border',
    mine ? 'border-primary/40' : 'border-border',
  );

  if (state === 'loading') {
    return <div className={cn(frame, 'bg-muted h-[120px] w-[160px] animate-pulse')} aria-hidden />;
  }
  if (state === 'error' || !url) {
    return (
      <div className={cn(frame, 'bg-muted text-muted-foreground px-12 py-8 text-xs')}>
        Photo indisponible
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Photo jointe au message"
        className="max-h-[220px] w-auto object-contain"
      />
    </a>
  );
}
