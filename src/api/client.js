import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' }
});

API.interceptors.request.use(config => {
  const token = localStorage.getItem('atac_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('atac_token');
      localStorage.removeItem('atac_candidate');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;

// ── Simulator (M2 sim-live) helpers ──────────────────────────────────────
// Wraps the authenticated axios client with named functions for the three
// /api/sim-live/* endpoints used by the new ATAC Call Readiness Simulator
// frontend flow. JWT is injected by the existing request interceptor.

/**
 * Assign a simulator session. Backend returns { sessionId, signedUrl,
 * scenario, ... }. Pass scenarioCode for Pioneer flow (user picked a
 * scenario), or leave null for new-candidate flow (backend auto-assigns).
 * Pass credentialId for Pioneer flow only.
 */
export function assignSimulator(scenarioCode = null, credentialId = null) {
  const body = {};
  if (scenarioCode)  body.scenario_code = scenarioCode;
  if (credentialId)  body.credential_id = credentialId;

  // TEMPORARY DIAGNOSTIC - log every call with caller stack
  console.log('[ASSIGN-SIM CALL]', {
    scenarioCode,
    credentialId,
    bodyKeys: Object.keys(body),
    stack: new Error().stack,
    timestamp: new Date().toISOString(),
  });

  return API.post('/api/sim-live/assign', body);
}

/**
 * Persist the ElevenLabs conversation_id against an active simulator
 * session. Fired once on WebSocket onConnect from Call.jsx so the backend
 * can correlate the live conversation with the session row.
 */
export function patchConversation(sessionId, conversationId) {
  return API.patch(`/api/sim-live/session/${sessionId}/conversation`, {
    conversation_id: conversationId,
  });
}

/**
 * Poll session status. Backend returns { status, scoring, credential, ... }.
 * status flows: 'in_progress' -> 'completed' -> 'scoring' -> 'scored'.
 * Results.jsx polls this every 3s until 'scored' or 5min timeout.
 */
export function getSimulatorStatus(sessionId) {
  return API.get(`/api/sim-live/status/${sessionId}`);
}