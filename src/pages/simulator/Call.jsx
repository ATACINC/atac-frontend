/**
 * ATAC Platform - Call.jsx
 * Path: frontend/src/pages/simulator/Call.jsx
 *
 * Route: /simulator/call/:sessionId
 *
 * Candidate-flow wrapper around the presentational <VoiceCall> component.
 * This file owns ONLY the candidate-specific side effects; the live call
 * mechanics (the @elevenlabs/client lifecycle, silence banner, mic meter,
 * duration timer, transcript UI) live in VoiceCall.jsx and are shared with
 * the invite-only sandbox.
 *
 * Lifecycle:
 *   1. Read the session payload from sessionStorage (set by SimulatorEntry
 *      or ScenarioPicker after /api/sim-live/assign). Missing or mismatched
 *      session -> redirect to /dashboard.
 *   2. Render <VoiceCall> with the signed URL + persona from that payload.
 *   3. onConversationId: PATCH the id to
 *      /api/sim-live/session/:sessionId/conversation so the backend can
 *      correlate the live conversation with the session row.
 *   4. onEnded: navigate to /simulator/results/:sessionId. Results polls
 *      backend status to figure out what actually happened.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patchConversation } from '../../api/client';
import VoiceCall from './VoiceCall';

const BG = '#080B12';

export default function Call() {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();

  // Read the stashed session synchronously on first render (set by
  // SimulatorEntry or ScenarioPicker after /api/sim-live/assign). Same key,
  // same parse, and same sessionId match as before. Reading it in a lazy
  // initializer rather than a post-mount effect + setState keeps this wrapper
  // free of a setState-in-effect on the candidate path; the resulting
  // behavior (load, validate, redirect on miss) is unchanged.
  const [session] = useState(() => {
    try {
      const raw = sessionStorage.getItem('atac_sim_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.sessionId || parsed.sessionId !== routeSessionId) return null;
      return parsed;
    } catch {
      return null;
    }
  });

  // Missing or mismatched session: send the user to the dashboard rather than
  // auto-reassigning (which would issue a different scenario than the one they
  // originally started). Identical redirect to before.
  useEffect(() => {
    if (!session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

  // While the redirect fires, hold a dark full-screen so there is no flash.
  if (!session) {
    return <div style={{ minHeight: '100vh', background: BG }} />;
  }

  return (
    <VoiceCall
      signedUrl={session.signedUrl || null}
      personaName={session.personaName}
      customerProfile={session.customerProfile}
      inputDeviceId={session.micDeviceId || undefined}
      onConversationId={(conversationId) => {
        // Persist conversation_id to backend (fire-and-forget; errors here do
        // not block the candidate from continuing the call).
        patchConversation(routeSessionId, conversationId).catch((err) => {
          // Soft-log; do not surface to the user.
          console.warn('[Call] patchConversation failed', err?.message || err);
        });
      }}
      onEnded={() => {
        navigate(`/simulator/results/${routeSessionId}`, { replace: true });
      }}
    />
  );
}
