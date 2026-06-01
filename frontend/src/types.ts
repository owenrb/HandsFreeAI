export type Message = {
  id: string;
  type: string;
  action?: string;
  content: string;
}

export type WSMessage = {
  type: string;
  id?: string;
  text?: string;
  delta?: string;
  action?: string;
  functionCallParams?: string;
  error?: OpenAIError;
  rateLimits?: RateLimits;
}

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
