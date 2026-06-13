export type Message = {
  id: string;
  type: string;
  action?: string;
  content: string;
}

export type WSMessage =
  | { id: string; type: 'text_delta'; delta: string }
  | { id?: string; type: 'transcription'; text: string }
  | { id: string; type: 'user_message'; text: string }
  | { type: 'control'; action: 'speech_started' | 'connected' | 'text_done' | 'function_call_output' | 'item_created'; functionCallParams?: string; id?: string }
  | { type: 'control'; action: 'session_created'; id?: string }
  | { type: 'control'; action: 'error'; error: OpenAIError; id?: string }
  | { type: 'control'; action: 'rate_limits_updated'; rateLimits: RateLimits; id?: string };

export type OpenAIError = {
  type: string;
  code?: string;
  message: string;
  event_id?: string;
}

export type RateLimits = {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

export type WebSocketMessage = {
  type: 'binary' | 'text' | 'init';
  data: ArrayBuffer | string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export type SystemMessageType = 'language-coach' | 'software-architecture-coach' | 'agile-scrum-coach';
