import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { pino } from 'pino';
import cors from 'cors';
import cookieSession from 'cookie-session';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';
import { RTSession } from './session.js';
import { getSystemMessage } from './systemMessages.js';

// Load .env from current directory or project root
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

const PORT = process.env.PORT || 8080;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ALLOWED_GMAIL_ACCOUNTS = process.env.ALLOWED_GMAIL_ACCOUNTS
  ? process.env.ALLOWED_GMAIL_ACCOUNTS.split(',').map(email => email.trim().toLowerCase())
  : [];

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const logger = pino({
  level: process.env.LOG_LEVEL || 'debug',
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

const app = express();

// Trust proxy is required when running behind a proxy (like our frontend server)
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const sessionMiddleware = cookieSession({
  name: 'session',
  keys: [process.env.SESSION_KEY || 'default-session-key'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  // Only use secure cookies if we are actually on HTTPS
  secure: process.env.NODE_ENV === 'production' && process.env.USE_SECURE_COOKIES === 'true',
  sameSite: 'lax'
});

app.use(sessionMiddleware);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(express.json()); // Middleware to parse JSON bodies

app.post('/auth/google', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    const email = payload.email.toLowerCase();
    if (ALLOWED_GMAIL_ACCOUNTS.length > 0 && !ALLOWED_GMAIL_ACCOUNTS.includes(email)) {
      logger.warn({ email }, 'Unauthorized email attempted login');
      res.status(403).json({ error: 'Email not authorized' });
      return;
    }

    // Set session
    if (req.session) {
      req.session.userId = payload.sub;
      req.session.email = email;
    }
    
    logger.info({ email }, 'User authenticated');
    res.json({ user: { email, name: payload.name, picture: payload.picture } });
  } catch (error) {
    logger.error({ error }, 'Google auth failed');
    res.status(401).json({ error: 'Authentication failed' });
  }
});

app.get('/auth/me', (req: Request, res: Response) => {
  if (req.session && req.session.email) {
    res.json({ authenticated: true, user: { email: req.session.email } });
  } else {
    res.json({ authenticated: false });
  }
});

app.post('/auth/logout', (req: Request, res: Response) => {
  req.session = null;
  res.json({ success: true });
});

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
  if (pathname === '/realtime') {
    logger.debug({ pathname }, 'Handling WebSocket upgrade request');
    
    // Run session middleware manually to check auth
    sessionMiddleware(request as any, {} as any, () => {
      const session = (request as any).session;
      if (!session || !session.email) {
        logger.warn({ 
          hasSession: !!session, 
          hasEmail: !!session?.email,
          cookieHeader: !!request.headers.cookie 
        }, 'Unauthorized WebSocket upgrade attempt');
        
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        logger.debug('WebSocket upgrade successful');
        wss.emit('connection', ws, request);
      });
    });
  } else {
    logger.warn({ pathname }, 'Invalid WebSocket path - destroying connection');
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket) => {
  logger.info('🟢 New Client websocket connection opened');
  let rtSession: RTSession | null = null;

  const handleSocketEvent = (eventType: string, data?: any) => {
    switch (eventType) {
      case 'message':
        if (!data) {
          logger.warn('Received empty message');
          return;
        }

        try {
          const messageText = data.toString();
          const initSystemMessage = JSON.parse(messageText);

          if (initSystemMessage.type === 'init') {
            if (rtSession) {
              logger.warn('🟠 RTSession already exists - ignoring duplicate init');
              return;
            }

            logger.info('🔄 Initializing RTSession');
            const systemMessage = getSystemMessage(initSystemMessage.systemMessageType);
            logger.info( { systemMessage }, '✅ System message retrieved');
            
            rtSession = new RTSession(ws, logger, systemMessage);
            // Remove message handler once session is created
            ws.off('message', messageHandler);
          }
        } catch (error) {
          logger.error({ error, message: data.toString() }, '🔥 Failed to process message');
        }
        break;

      case 'error':
        logger.error({ error: data }, '🔥 WebSocket error occurred');
        rtSession?.dispose();
        rtSession = null;
        break;

      case 'close':
        logger.info('🔴 WebSocket connection closed');
        rtSession?.dispose();
        rtSession = null;
        break;
    }
  };

  const messageHandler = (message: any) => handleSocketEvent('message', message);

  ws.on('message', messageHandler);
  ws.on('error', (error: Error) => handleSocketEvent('error', error));
  ws.on('close', () => handleSocketEvent('close'));
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err, '🔥 Unhandled error');
  res.status(500).json({ error: '🔥 Internal server error' });
});

server.listen(PORT, () => logger.info(`🟢 WebSocket server started on http://localhost:${PORT}`));

server.on('close', () => {
  logger.info('🔴 WebSocket server stopped');
});