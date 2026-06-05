import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { SegmentError } from './segment-error.client';

const captureMock = Sentry.captureException as unknown as ReturnType<typeof vi.fn>;

describe('SegmentError — gabarit error boundary (DEC-099)', () => {
  beforeEach(() => {
    captureMock.mockReset();
  });

  it("capture l'exception dans Sentry au mount avec tag segment", () => {
    const err = new Error('boom');
    render(
      <SegmentError
        error={err}
        reset={() => {}}
        segment="driver.conduite"
        title="X"
        description="Y"
      />,
    );
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith(err, { tags: { segment: 'driver.conduite' } });
  });

  it('affiche role="alert" pour les lecteurs d\'écran', () => {
    render(
      <SegmentError
        error={new Error('boom')}
        reset={() => {}}
        segment="app"
        title="Titre"
        description="Description"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });

  it('appelle reset() au clic sur Réessayer', () => {
    const reset = vi.fn();
    render(
      <SegmentError
        error={new Error('boom')}
        reset={reset}
        segment="app"
        title="X"
        description="Y"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /réessayer/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('affiche le titre + description fournis', () => {
    render(
      <SegmentError
        error={new Error('boom')}
        reset={() => {}}
        segment="driver.conduite"
        title="Un problème d’affichage est survenu"
        description="Vos pointages sont sauvegardés."
      />,
    );
    expect(screen.getByText('Un problème d’affichage est survenu')).toBeInTheDocument();
    expect(screen.getByText(/sauvegardés/)).toBeInTheDocument();
  });

  it('ne montre PAS de stack en production (NODE_ENV)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(
      <SegmentError
        error={Object.assign(new Error('boom'), { stack: 'at boom (foo.ts:1)' })}
        reset={() => {}}
        segment="app"
        title="X"
        description="Y"
      />,
    );
    expect(screen.queryByText(/Détails \(dev only\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/at boom/)).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
