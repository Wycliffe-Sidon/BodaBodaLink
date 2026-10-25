import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  adminReplySupportTicket,
  adminReviewRiderKyc,
  adminUpdatePricingConfig,
  createBodaTripOrDelivery,
  dispatchMatchSeedRider,
  getAdminPortalDashboard,
  getMobileAccountBundle,
  getPublicFleetAndPricing,
  initiateAdminPortalSession,
  rateCompletedTrip,
  recordLiveTripGpsPoint,
  sendSupportTicketMessage,
  submitRiderKycDocuments,
  superAdminCreateAdminAccount,
  switchMobileRole,
  syncMobileUser,
  toggleRiderOnlineMode,
  topUpWalletMpesa,
  updateTripLifecycleByActor,
  verifyAdminMfa,
  verifyPhoneOtp,
  withdrawRiderWalletMpesa,
} from './src/db/repository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json({ limit: '1mb' }));

  // OWASP Security Headers & Sliding-Window Rate Limiter
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  app.use('/api', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    } else {
      bucket.count += 1;
      if (bucket.count > 240) {
        res.status(429).json({ error: 'Too many requests. Rate limit exceeded.' });
        return;
      }
    }
    next();
  });

  // Real-Time Socket.IO Gateway
  io.on('connection', (socket) => {
    socket.on('join:trip', (tripId: number) => {
      if (tripId) {
        socket.join(`trip:${tripId}`);
      }
    });

    socket.on('join:role', (roleRoom: 'FLEET_RIDERS' | 'ADMIN_OPS') => {
      if (roleRoom === 'FLEET_RIDERS' || roleRoom === 'ADMIN_OPS') {
        socket.join(roleRoom);
      }
    });

    socket.on(
      'rider:gps:push',
      async (payload: { tripId: number; lat: number; lng: number; heading?: number; speedKmh?: number }) => {
        if (!payload?.tripId || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
          return;
        }
        try {
          const saved = await recordLiveTripGpsPoint(payload);
          if (saved) {
            io.to(`trip:${payload.tripId}`).emit('trip:gps:updated', saved);
            io.to('ADMIN_OPS').emit('trip:gps:updated', saved);
          }
        } catch (err) {
          console.error('Socket GPS persistence error:', err);
        }
      }
    );
  });

  const getClientIp = (req: express.Request) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  // --------------------------------------------------------------------------
  // PUBLIC FLEET & PRICING SNAPSHOT
  // --------------------------------------------------------------------------
  app.get('/api/public/fleet-pricing', async (_req, res) => {
    try {
      const data = await getPublicFleetAndPricing();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Unable to load pricing configuration.' });
    }
  });

  // --------------------------------------------------------------------------
  // MOBILE APP ENDPOINTS (STRICTLY CUSTOMERS & RIDERS ONLY — ZERO ADMIN)
  // --------------------------------------------------------------------------
  app.post('/api/mobile/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const u = req.user!;
      const bundle = await syncMobileUser({
        uid: u.uid,
        email: u.email || `${u.uid}@bodalink.co.ke`,
        fullName: u.name || req.body?.fullName,
        avatarUrl: u.picture,
        ipAddress: getClientIp(req),
      });
      res.json(bundle);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to synchronize account.' });
    }
  });

  app.get('/api/mobile/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const bundle = await getMobileAccountBundle(req.user!.uid);
      res.json(bundle);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch account.' });
    }
  });

  app.post('/api/mobile/role', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { roleName, phone } = req.body;
      if (roleName !== 'CUSTOMER' && roleName !== 'RIDER') {
        res.status(400).json({ error: 'Mobile app supports CUSTOMER and RIDER roles only.' });
        return;
      }
      const bundle = await switchMobileRole(req.user!.uid, roleName, phone);
      res.json(bundle);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Unable to switch role.' });
    }
  });

  app.post('/api/mobile/verify-otp', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone, otpCode } = req.body;
      const bundle = await verifyPhoneOtp(req.user!.uid, phone, otpCode);
      res.json(bundle);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'OTP verification failed.' });
    }
  });

  app.post('/api/rider/kyc', requireAuth, async (req: AuthRequest, res) => {
    try {
      const bundle = await submitRiderKycDocuments(req.user!.uid, req.body);
      io.to('ADMIN_OPS').emit('admin:kyc:submitted', {
        riderUserId: bundle?.user.id,
        fullName: bundle?.user.fullName,
      });
      res.json(bundle);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Unable to submit KYC documents.' });
    }
  });

  app.post('/api/rider/online', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { isOnline, lat, lng } = req.body;
      const bundle = await toggleRiderOnlineMode(req.user!.uid, Boolean(isOnline), lat, lng);
      const snapshot = await getPublicFleetAndPricing();
      io.emit('fleet:updated', snapshot.onlineRiders);
      res.json(bundle);
    } catch (error: any) {
      res.status(403).json({ error: error.message || 'Unable to change online status.' });
    }
  });

  app.post('/api/trips', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await createBodaTripOrDelivery(req.user!.uid, req.body);
      io.emit('trip:requested', result.trip);
      io.to('ADMIN_OPS').emit('trip:updated', result.trip);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Unable to create booking.' });
    }
  });

  app.post('/api/trips/:id/match-nearest', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tripId = Number(req.params.id);
      const updated = await dispatchMatchSeedRider(tripId);
      io.emit('trip:updated', updated);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Unable to match nearest rider.' });
    }
  });

  app.post('/api/trips/:id/lifecycle', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tripId = Number(req.params.id);
      const { action, proofOfDeliveryNote } = req.body;
      const updated = await updateTripLifecycleByActor(
        req.user!.uid,
        tripId,
        action,
        proofOfDeliveryNote
      );
      io.emit('trip:updated', updated);
      if (action === 'TRIGGER_SOS') {
        io.to('ADMIN_OPS').emit('sos:triggered', updated);
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Unable to update trip lifecycle.' });
    }
  });

  app.post('/api/trips/:id/gps', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tripId = Number(req.params.id);
      const { lat, lng, heading, speedKmh } = req.body;
      const point = await recordLiveTripGpsPoint({ tripId, lat, lng, heading, speedKmh });
      if (point) {
        io.emit('trip:gps:updated', point);
      }
      res.json(point);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Unable to record GPS update.' });
    }
  });

  app.post('/api/trips/:id/rate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tripId = Number(req.params.id);
      const { score, comment, safetyTags } = req.body;
      const result = await rateCompletedTrip(
        req.user!.uid,
        tripId,
        Number(score),
        comment || '',
        Array.isArray(safetyTags) ? safetyTags : []
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Unable to submit rating.' });
    }
  });

  app.post('/api/wallet/topup', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { amountKes, mpesaPhone } = req.body;
      const bundle = await topUpWalletMpesa(req.user!.uid, Number(amountKes), mpesaPhone);
      res.json(bundle);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Top-up failed.' });
    }
  });

  app.post('/api/wallet/withdraw', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { amountKes, mpesaPhone } = req.body;
      const bundle = await withdrawRiderWalletMpesa(req.user!.uid, Number(amountKes), mpesaPhone);
      res.json(bundle);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Withdrawal failed.' });
    }
  });

  app.post('/api/support/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ticket = await sendSupportTicketMessage(req.user!.uid, req.body);
      io.emit('support:updated', ticket);
      res.json(ticket);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Support message failed.' });
    }
  });

  // --------------------------------------------------------------------------
  // COMPLETELY SEPARATE ADMIN PORTAL API (admin.bodalink.com Architecture)
  // --------------------------------------------------------------------------
  app.post('/api/admin/session/init', requireAuth, async (req: AuthRequest, res) => {
    try {
      const u = req.user!;
      const result = await initiateAdminPortalSession({
        firebaseUid: u.uid,
        email: u.email || '',
        fullName: u.name || 'Admin Operator',
        ipAddress: getClientIp(req),
        userAgent: String(req.headers['user-agent'] || 'Workstation Browser'),
      });
      res.json(result);
    } catch (error: any) {
      res.status(403).json({ error: error.message || 'Admin Portal login denied.' });
    }
  });

  app.post('/api/admin/session/verify-mfa', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionToken, mfaCode } = req.body;
      const verified = await verifyAdminMfa({
        sessionToken,
        mfaCode,
        ipAddress: getClientIp(req),
      });
      res.json(verified);
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'MFA verification failed.' });
    }
  });

  app.get('/api/admin/dashboard', requireAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = String(req.headers['x-admin-session'] || '');
      const data = await getAdminPortalDashboard(sessionToken);
      res.json(data);
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Admin session unauthorized.' });
    }
  });

  app.post('/api/admin/riders/:id/review', requireAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = String(req.headers['x-admin-session'] || '');
      const riderProfileId = Number(req.params.id);
      const { decision, notes } = req.body;
      const updated = await adminReviewRiderKyc({
        sessionToken,
        riderProfileId,
        decision,
        notes,
        ipAddress: getClientIp(req),
      });
      const snapshot = await getPublicFleetAndPricing();
      io.emit('rider:kyc:reviewed', updated);
      io.emit('fleet:updated', snapshot.onlineRiders);
      res.json(updated);
    } catch (error: any) {
      res.status(403).json({ error: error.message || 'Rider KYC review failed.' });
    }
  });

  app.post('/api/admin/pricing', requireAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = String(req.headers['x-admin-session'] || '');
      const updated = await adminUpdatePricingConfig({
        sessionToken,
        ...req.body,
        ipAddress: getClientIp(req),
      });
      io.emit('pricing:updated', updated);
      res.json(updated);
    } catch (error: any) {
      res.status(403).json({ error: error.message || 'Pricing update failed.' });
    }
  });

  app.post('/api/admin/accounts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = String(req.headers['x-admin-session'] || '');
      const created = await superAdminCreateAdminAccount({
        sessionToken,
        ...req.body,
        ipAddress: getClientIp(req),
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(403).json({ error: error.message || 'Admin account creation failed.' });
    }
  });

  app.post('/api/admin/support/:id/reply', requireAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = String(req.headers['x-admin-session'] || '');
      const ticketId = Number(req.params.id);
      const { body, resolveTicket } = req.body;
      const updated = await adminReplySupportTicket({
        sessionToken,
        ticketId,
        body,
        resolveTicket: Boolean(resolveTicket),
        ipAddress: getClientIp(req),
      });
      io.emit('support:updated', updated);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Reply failed.' });
    }
  });

  // --------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE / PRODUCTION STATIC BUNDLE
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`BodaLink Full-Stack Platform listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
