import { describe, it, expect } from 'vitest';
import {
  groupMessagesByDay,
  reunionDayKey,
  SENDER_ROLE_LABEL,
  type RideMessage,
} from '../internal-message';

function msg(id: string, created_at: string): RideMessage {
  return {
    id,
    ride_id: 'r1',
    sender_profile_id: 'p1',
    sender_role: 'regulateur',
    body: `m-${id}`,
    image_path: null,
    created_at,
  };
}

describe('reunionDayKey', () => {
  it('rend le jour calendaire au fuseau de La Réunion (UTC+4)', () => {
    // 20 h UTC = minuit + 0 h le lendemain à La Réunion (UTC+4).
    expect(reunionDayKey('2026-06-08T20:00:00Z')).toBe('2026-06-09');
    // 19 h UTC = 23 h le même jour à La Réunion.
    expect(reunionDayKey('2026-06-08T19:00:00Z')).toBe('2026-06-08');
  });

  it('renvoie une chaîne vide sur date invalide (défensif)', () => {
    expect(reunionDayKey('pas-une-date')).toBe('');
  });
});

describe('groupMessagesByDay', () => {
  it('liste vide → tableau vide', () => {
    expect(groupMessagesByDay([])).toEqual([]);
  });

  it('un seul message → un groupe', () => {
    const groups = groupMessagesByDay([msg('1', '2026-06-08T06:00:00Z')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.day).toBe('2026-06-08');
    expect(groups[0]?.messages.map((m) => m.id)).toEqual(['1']);
  });

  it('plusieurs messages du même jour → un seul groupe ordonné', () => {
    const groups = groupMessagesByDay([
      msg('a', '2026-06-08T06:00:00Z'),
      msg('b', '2026-06-08T08:30:00Z'),
      msg('c', '2026-06-08T07:15:00Z'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.messages.map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('messages sur 2 jours → 2 groupes dans l’ordre chronologique', () => {
    const groups = groupMessagesByDay([
      msg('j2', '2026-06-09T05:00:00Z'),
      msg('j1', '2026-06-08T05:00:00Z'),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-06-08', '2026-06-09']);
    expect(groups[0]?.messages.map((m) => m.id)).toEqual(['j1']);
    expect(groups[1]?.messages.map((m) => m.id)).toEqual(['j2']);
  });

  it('respecte la frontière de minuit Réunion (un msg bascule au lendemain)', () => {
    const groups = groupMessagesByDay([
      msg('avant', '2026-06-08T19:00:00Z'), // 23 h Réunion → 08
      msg('apres', '2026-06-08T20:30:00Z'), // 00 h 30 Réunion → 09
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-06-08', '2026-06-09']);
  });
});

describe('SENDER_ROLE_LABEL', () => {
  it('expose un libellé FR pour chaque rôle', () => {
    expect(SENDER_ROLE_LABEL.dirigeant).toBe('Direction');
    expect(SENDER_ROLE_LABEL.regulateur).toBe('Régulation');
    expect(SENDER_ROLE_LABEL.chauffeur).toBe('Chauffeur');
  });
});
