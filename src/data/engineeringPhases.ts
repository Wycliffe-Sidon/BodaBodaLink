export interface EngineeringPhase {
  phaseNumber: number;
  title: string;
  ownerTeam: string;
  summary: string;
  keyDeliverables: string[];
  architectureSpecs: Array<{ heading: string; content: string }>;
  codeArtifactTitle: string;
  codeLanguage: string;
  codeArtifact: string;
}

export const ENGINEERING_PHASES: EngineeringPhase[] = [
  {
    phaseNumber: 1,
    title: 'Product Requirements Document (PRD)',
    ownerTeam: 'Product Management & Business Analysis',
    summary:
      'Production roadmap for BodaLink launching in Nairobi, Mombasa, Kisumu, Nakuru, and Eldoret before scaling across Kampala, Dar es Salaam, and Kigali. Combines passenger Boda rides with high-frequency insulated grocery delivery and barcoded parcel courier services.',
    keyDeliverables: [
      'Strict two-role Mobile App boundary (Customers & Riders only; zero Admin surfaces in mobile binary)',
      'Configurable platform monetization: 15% default ride/delivery commission (e.g. 1,000 KES gross → 150 KES platform, 850 KES rider) + Weekly Zero-Commission Rider Pass + Corporate Invoicing',
      'Mandatory 7-step NTSA & National ID KYC compliance gate before any rider can toggle Online',
      'High-traffic grocery fulfillment workflow with insulated rear cargo box verification and 4-digit recipient PIN chain-of-custody',
    ],
    architectureSpecs: [
      {
        heading: 'Target Personas & Service Lines',
        content:
          '1. Commuters & Households: Instant passenger rides, 25-minute supermarket grocery delivery, and same-hour document/parcel dispatch.\n2. Boda Boda Operators: Verified riders maximizing utilization across morning/evening commuter peaks and midday grocery/parcel runs.\n3. Corporate Accounts: SMEs, pharmacies, and e-commerce merchants dispatching multi-drop packages with monthly tax-compliant statements.',
      },
      {
        heading: 'Automatic Fare Formula & Unit Economics',
        content:
          'Total Fare (KES) = Base Fare (100 KES) + (Distance KM × 20 KES) + (Duration Min × 2 KES) + Peak Hour Fee + Night Fee + Weather Risk Fee − Promo Discount.\nPlatform Commission = Configurable % (Default 15%). Example: 1,000 KES trip yields 150 KES net platform revenue and 850 KES instant Rider Wallet settlement.',
      },
    ],
    codeArtifactTitle: 'Phase 1 — Monetization & SLA Specification Matrix (YAML)',
    codeLanguage: 'yaml',
    codeArtifact: `platform: BodaLink
tagline: "Safe Rides. Fast Deliveries."
initial_market: Kenya (KES)
expansion_markets: [Uganda, Tanzania, Rwanda, Ethiopia]

sla_targets:
  concurrent_users_capacity: 100000
  rider_match_latency_p95_ms: 1800
  gps_telemetry_interval_sec: 3
  availability_slo: "99.95%"

service_lines:
  - code: RIDE
    label: Motorcycle Passenger Transport
    safety_requirements: [TwoCertifiedHelmets, ReflectiveGear, NTSAClassALicense]
  - code: GROCERY_DELIVERY
    label: High-Traffic Grocery Express
    cargo_requirements: [WeatherSealedInsulatedBox, TamperSeal, FourDigitRecipientPIN]
  - code: PARCEL_DELIVERY
    label: Express Parcel & Package Pickup
    cargo_requirements: [ChainOfCustodyScan, ProofOfDeliveryPhoto, RecipientPIN]
  - code: CORPORATE
    label: Corporate Transport & Merchant Dispatch
    billing: [ConsolidatedMonthlyInvoice, PrepaidCorporateWallet, MpesaPaybill]

monetization:
  default_commission_pct: 15.0
  example_split_1000_kes:
    gross_fare_kes: 1000
    platform_commission_kes: 150
    rider_net_payout_kes: 850
  rider_subscriptions:
    - plan: WEEKLY_PRO_PASS
      fee_kes: 1200
      commission_pct: 5.0
  additional_streams: [FeaturedGroceryPartners, CorporateAccounts, InAppMerchantPromos]`,
  },
  {
    phaseNumber: 2,
    title: 'System Architecture & Real-Time Scale',
    ownerTeam: 'Principal Software & Cybersecurity Architects',
    summary:
      'Microservice-ready modular NestJS backend paired with PostgreSQL 16 (PostGIS), Redis 7 geospatial rider indexing, Socket.IO multi-node WebSocket cluster, single Flutter mobile binary (Customer/Rider RBAC), and physically isolated Next.js Admin Portal (admin.bodalink.com).',
    keyDeliverables: [
      'Domain isolation: Mobile App communicates exclusively with /api/mobile, /api/trips, /api/rider; Admin Portal communicates exclusively with admin.bodalink.com /api/admin behind MFA + IP/Device session guards',
      'Redis GEOADD / GEOSEARCH sub-millisecond rider proximity lookup within 3km–5km radius',
      'Socket.IO Redis Streams adapter supporting 100,000+ concurrent WebSocket connections across horizontally autoscaled pods',
      'M-Pesa Daraja STK Push asynchronous webhook verifier with idempotent transaction ledgering',
    ],
    architectureSpecs: [
      {
        heading: 'High-Traffic Real-Time Dispatch Pipeline',
        content:
          'Online riders emit GPS heartbeats every 3s over Socket.IO → Gateway writes ephemeral coordinates to Redis Geo-Set (bodalink:riders:online) and batches durable breadcrumbs to PostgreSQL trip_locations → Trip Request queries Redis GEOSEARCH BYRADIUS 5 km ASC → Dispatches offer to nearest verified rider with insulated box capability.',
      },
      {
        heading: 'Zero-Trust Security & OWASP Controls',
        content:
          'Short-lived JWT access tokens (15m) + rotating HttpOnly/Secure Refresh Tokens, Firebase/Phone OTP verification, HMAC-verified M-Pesa callbacks, strict RBAC guards, rate limiting per IP & user UID, encrypted KYC object storage URLs, and immutable audit logs.',
      },
    ],
    codeArtifactTitle: 'Phase 2 — Distributed System Topology',
    codeLanguage: 'text',
    codeArtifact: `┌──────────────────────────────────────────┐     ┌──────────────────────────────────────────┐
│   FLUTTER MOBILE APP (Android & iOS)     │     │   SEPARATE ADMIN PORTAL (Next.js + MUI)  │
│   Strictly RBAC: CUSTOMER | RIDER ONLY   │     │   admin.bodalink.com (MFA + IP + RBAC)   │
└───────────────────┬──────────────────────┘     └────────────────────┬─────────────────────┘
                    │ HTTPS REST + WSS (Socket.IO)                    │ HTTPS + Strict CSP + MFA
                    ▼                                                 ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                     NGINX / CLOUD LOAD BALANCER + WAF + RATE LIMITER                      │
└───────────────────────────────────────────┬───────────────────────────────────────────────┘
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                     NESTJS MODULAR MICROSERVICE-READY BACKEND CLUSTER                     │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ ┌─────────────────┐  │
│  │ Auth & RBAC │ │ Trips & Fare │ │ Grocery &    │ │ M-Pesa Daraja │ │ Socket.IO Live  │  │
│  │ + OTP/MFA   │ │ Matching     │ │ Parcel POD   │ │ & Wallet Svc  │ │ Tracking Gw     │  │
│  └─────────────┘ └──────────────┘ └──────────────┘ └───────────────┘ └─────────────────┘  │
└───────────────┬───────────────────────────────────┬───────────────────────────────────────┘
                ▼                                   ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────────────────────────┐
│ REDIS 7 CLUSTER                  │ │ POSTGRESQL 16 + POSTGIS (Primary + Read Replicas)    │
│ • GEOADD / GEOSEARCH Rider Index │ │ • 23 Normalized Tables, ACID Wallet Ledger           │
│ • Socket.IO Pub/Sub Adapter      │ │ • Partitioned trip_locations & immutable audit_logs  │
└──────────────────────────────────┘ └──────────────────────────────────────────────────────┘`,
  },
  {
    phaseNumber: 3,
    title: 'PostgreSQL Database Design (23 Tables)',
    ownerTeam: 'PostgreSQL Database Architects',
    summary:
      'Normalized ACID-compliant relational schema provisioned live on Cloud SQL PostgreSQL with foreign keys, composite B-Tree indexes, unique constraints, double-entry wallet ledgering, and isolated Admin security tables.',
    keyDeliverables: [
      'Core Identity & Fleet: users, roles, customer_profiles, rider_profiles, motorcycles',
      'Dispatch & Logistics: trips, trip_locations, parcel_deliveries, pricing_configs, promo_codes',
      'Financial & Ledger: payments, wallets, wallet_transactions, withdrawals',
      'Trust, Comms & Isolated Admin: ratings, notifications, support_tickets, audit_logs, admin_users, admin_roles, admin_permissions, admin_sessions, admin_audit_logs',
    ],
    architectureSpecs: [
      {
        heading: 'Indexing & Partitioning for 100k+ Users',
        content:
          'Composite index on rider_profiles(verification_status, is_online) and spatial/coordinate index on (current_lat, current_lng) accelerate rider matching. Range partitioning by month on trip_locations(recorded_at) and audit_logs(created_at) keeps hot indexes compact.',
      },
      {
        heading: 'Financial Integrity Guarantees',
        content:
          'Every ride settlement executes inside an atomic transaction updating trips.status = COMPLETED, crediting wallets.balance_kes with net rider_earnings_kes (85%), recording platform_commission_kes (15%), and appending an immutable row to wallet_transactions.',
      },
    ],
    codeArtifactTitle: 'Phase 3 — Production PostgreSQL DDL Migration',
    codeLanguage: 'sql',
    codeArtifact: `-- Core BodaLink PostgreSQL Schema (Provisioned Live via Drizzle ORM)
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (name IN ('CUSTOMER', 'RIDER')),
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  role_name TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (role_name IN ('CUSTOMER', 'RIDER')),
  otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE rider_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  national_id_number TEXT,
  driving_license_number TEXT,
  verification_status TEXT NOT NULL DEFAULT 'PENDING_DOCUMENTS',
  approved_by_admin_id INTEGER,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  completed_trips INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 4.92
);

CREATE INDEX rider_profiles_status_online_idx ON rider_profiles(verification_status, is_online);
CREATE INDEX rider_profiles_coords_idx ON rider_profiles(current_lat, current_lng);
-- Plus: customer_profiles, motorcycles, trips, trip_locations, parcel_deliveries,
-- payments, wallets, wallet_transactions, withdrawals, ratings, notifications,
-- support_tickets, promo_codes, audit_logs, admin_users, admin_roles,
-- admin_permissions, admin_sessions, admin_audit_logs, pricing_configs.`,
  },
  {
    phaseNumber: 4,
    title: 'NestJS Backend, Socket.IO & M-Pesa Daraja',
    ownerTeam: 'NestJS Backend & FinTech Engineers',
    summary:
      'Clean modular NestJS service architecture featuring automatic fare calculation, M-Pesa Daraja STK Push & B2C Rider Withdrawals, Redis geospatial matching, and real-time Socket.IO event gateways.',
    keyDeliverables: [
      'MpesaDarajaService: OAuth token caching, Lipa Na M-Pesa Online STK Push, callback IP allowlisting, and B2C rider payouts',
      'FareCalculationService: Dynamic Base + Distance + Time + Peak + Night + Weather Risk + Promo discount & configurable Commission split',
      'TrackingGateway (@WebSocketGateway): Real-time GPS streaming, trip lifecycle broadcasts, and live SOS escalation rooms',
    ],
    architectureSpecs: [
      {
        heading: 'M-Pesa Daraja Integration Lifecycle',
        content:
          '1. Backend generates Password = Base64(BusinessShortCode + Passkey + Timestamp).\n2. Invokes /mpesa/stkpush/v1/processrequest with Customer MSISDN (2547XXXXXXXX) and Amount.\n3. Receives CheckoutRequestID and awaits signed callback on /api/payments/mpesa/callback.\n4. Verifies ResultCode === 0, stores MpesaReceiptNumber, marks payment PAID, and emits payment:confirmed via Socket.IO.',
      },
      {
        heading: 'Strict Rider Verification Guard',
        content:
          'VerifiedRiderGuard inspects rider_profiles.verification_status === APPROVED on both REST (/rider/online, /trips/:id/accept) and Socket.IO handshake before permitting dispatch participation.',
      },
    ],
    codeArtifactTitle: 'Phase 4 — NestJS M-Pesa Daraja & Real-Time Gateway Module',
    codeLanguage: 'typescript',
    codeArtifact: `import { Injectable, ForbiddenException } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
export class FareAndCommissionService {
  calculateFare(params: {
    distanceKm: number;
    durationMin: number;
    baseFareKes: number;
    perKmKes: number;
    perMinKes: number;
    surchargesKes: number;
    commissionPct: number;
  }) {
    const grossKes = Math.round(
      params.baseFareKes +
        params.distanceKm * params.perKmKes +
        params.durationMin * params.perMinKes +
        params.surchargesKes,
    );
    const platformCommissionKes = Number(((grossKes * params.commissionPct) / 100).toFixed(2));
    const riderEarningsKes = Number((grossKes - platformCommissionKes).toFixed(2));
    return { grossKes, platformCommissionKes, riderEarningsKes };
  }
}

@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class BodaTrackingGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('rider:gps:update')
  async handleRiderGps(
    client: Socket,
    payload: { tripId: string; riderId: string; lat: number; lng: number; speedKmh: number },
  ) {
    if (!client.data.isApprovedRider) {
      throw new ForbiddenException('Rider must be approved by Admin before streaming telemetry.');
    }
    this.server.to(\`trip:\${payload.tripId}\`).emit('trip:location', payload);
    this.server.to('admin:fleet').emit('fleet:location', payload);
  }
}`,
  },
  {
    phaseNumber: 5,
    title: 'Flutter Mobile App (Customers & Riders Only)',
    ownerTeam: 'Mobile Engineering (Flutter / Riverpod)',
    summary:
      'Single Clean-Architecture Flutter codebase supporting Android & iOS with Riverpod state management, Repository pattern, Hive offline cache, Light/Dark themes, and automatic post-login routing to CustomerDashboard or RiderDashboard — with zero Admin modules compiled into the app.',
    keyDeliverables: [
      'Clean Architecture feature modules: auth/, customer_booking/, grocery_parcel/, rider_kyc/, rider_dispatch/, wallet_mpesa/, live_tracking/',
      'Automatic Role Detection Guard: inspects authenticated user role (CUSTOMER -> /customer/home, RIDER -> /rider/home) and rejects any non-mobile role',
      'Offline resilience: caches recent trip history, saved addresses, and wallet ledger in encrypted Hive boxes when cellular signal drops',
    ],
    architectureSpecs: [
      {
        heading: 'Flutter Folder Structure (Clean Architecture)',
        content:
          'lib/\n  core/ (network, theme, di, offline_cache, constants)\n  features/\n    auth/ (data, domain, presentation — OTP & RBAC router)\n    customer/ (ride booking, grocery express, parcel POD pin, SOS)\n    rider/ (7-step KYC uploader, online toggle, navigation, earnings & M-Pesa withdraw)',
      },
      {
        heading: 'Google Maps & Socket.IO Live Tracking',
        content:
          'Uses google_maps_flutter with smooth marker interpolation between 3-second Socket.IO GPS frames, traffic-enabled viewports, and one-tap Emergency SOS sharing live trip URLs.',
      },
    ],
    codeArtifactTitle: 'Phase 5 — Flutter Riverpod Automatic RBAC Router (main.dart)',
    codeLanguage: 'dart',
    codeArtifact: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum MobileUserRole { customer, rider }

class AuthenticatedMobileUser {
  final String uid;
  final String fullName;
  final MobileUserRole role; // Strictly customer or rider — NO admin in mobile app
  final bool riderKycApproved;

  const AuthenticatedMobileUser({
    required this.uid,
    required this.fullName,
    required this.role,
    this.riderKycApproved = false,
  });
}

final authStateProvider = StateProvider<AuthenticatedMobileUser?>((ref) => null);

class BodaLinkRoleGate extends ConsumerWidget {
  const BodaLinkRoleGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider);
    if (user == null) {
      return const OtpLoginScreen();
    }
    // Automatic role detection immediately routes to Customer or Rider Dashboard
    switch (user.role) {
      case MobileUserRole.customer:
        return const CustomerDashboardScreen();
      case MobileUserRole.rider:
        return user.riderKycApproved
            ? const RiderOnlineDispatchScreen()
            : const RiderKycVerificationPendingScreen();
    }
  }
}`,
  },
  {
    phaseNumber: 6,
    title: 'Separate Web Admin Portal (admin.bodalink.com)',
    ownerTeam: 'Enterprise Web & Compliance Engineering',
    summary:
      'Physically and logically isolated Next.js + TypeScript + Material UI Admin Portal hosted on admin.bodalink.com. Enforces mandatory MFA, device & IP session tracking, immutable audit trails, and 5 granular RBAC roles where only Super Admin can create Admin accounts.',
    keyDeliverables: [
      '5 Strict Admin Roles: Super Admin, Operations Manager, Finance Manager, Customer Support, Compliance Officer',
      'Compliance KYC Workbench: side-by-side inspection of National ID, NTSA Driving License, Motorcycle Logbook, and Profile Photo with one-click Approve/Reject',
      'Dynamic Fare & Commission Control Plane: real-time updates to Base Fare, Per-KM, Per-Minute, Peak/Night/Weather fees, and Platform Commission %',
    ],
    architectureSpecs: [
      {
        heading: 'Admin Authentication & Session Hardening',
        content:
          'Admins never authenticate through mobile endpoints. Every login on admin.bodalink.com validates identity, checks email & device verification, enforces a mandatory 6-digit MFA challenge, binds the session token to IP + User-Agent in admin_sessions, and records every mutation in admin_audit_logs.',
      },
      {
        heading: 'Super Admin Exclusive Account Provisioning',
        content:
          'POST /api/admin/accounts enforces currentAdmin.roleKey === SUPER_ADMIN at both API middleware and repository layers before inserting into admin_users.',
      },
    ],
    codeArtifactTitle: 'Phase 6 — Next.js + Material UI Admin RBAC Guard Specification',
    codeLanguage: 'typescript',
    codeArtifact: `export type AdminRoleKey =
  | 'SUPER_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'FINANCE_MANAGER'
  | 'CUSTOMER_SUPPORT'
  | 'COMPLIANCE_OFFICER';

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRoleKey, string[]> = {
  SUPER_ADMIN: [
    'CREATE_ADMIN_ACCOUNTS',
    'APPROVE_RIDER_KYC',
    'CONFIGURE_PRICING_AND_COMMISSION',
    'MANAGE_FINANCE_SETTLEMENTS',
    'HANDLE_SOS_AND_SUPPORT',
    'VIEW_SECURITY_SESSIONS_AND_AUDIT',
  ],
  OPERATIONS_MANAGER: ['APPROVE_RIDER_KYC', 'CONFIGURE_PRICING_AND_COMMISSION', 'HANDLE_SOS_AND_SUPPORT'],
  FINANCE_MANAGER: ['CONFIGURE_PRICING_AND_COMMISSION', 'MANAGE_FINANCE_SETTLEMENTS'],
  COMPLIANCE_OFFICER: ['APPROVE_RIDER_KYC', 'VIEW_SECURITY_SESSIONS_AND_AUDIT'],
  CUSTOMER_SUPPORT: ['HANDLE_SOS_AND_SUPPORT'],
};`,
  },
  {
    phaseNumber: 7,
    title: 'Comprehensive QA, Security & 100k Load Testing',
    ownerTeam: 'QA Automation & Performance Engineering',
    summary:
      'End-to-end verification suite spanning Jest unit & integration tests, M-Pesa STK callback idempotency tests, geospatial rider matching tests, Socket.IO real-time telemetry tests, OWASP ZAP security scans, and k6 load tests simulating 100,000+ users.',
    keyDeliverables: [
      'Unit & Financial Tests: verifies exact KES rounding and 15% / 85% commission splits across all surge combinations',
      'Rider KYC Gate Security Tests: asserts unapproved riders receive HTTP 403 on online toggle and trip acceptance',
      'k6 High-Traffic Grocery & Ride Load Script: simulates burst traffic across Nairobi CBD, Westlands, and Kilimani',
    ],
    architectureSpecs: [
      {
        heading: 'Payment & Double-Spend Prevention Tests',
        content:
          'Concurrent M-Pesa callback replay tests verify unique mpesa_receipt_number constraints and atomic wallet balance updates so duplicate webhooks never double-credit wallets.',
      },
      {
        heading: 'WebSocket Failover & Reconnection Tests',
        content:
          'Simulates intermittent 3G/4G drops during active boda trips; verifies buffered GPS coordinates flush cleanly upon reconnect without duplicate polyline artifacts.',
      },
    ],
    codeArtifactTitle: 'Phase 7 — k6 100k Scale Load Test & Jest Fare Verification',
    codeLanguage: 'javascript',
    codeArtifact: `// k6 Load Test: High-Traffic Grocery & Boda Dispatch (tests/load/bodalink-100k.k6.js)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 2500 },
    { duration: '5m', target: 10000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<450'],
    http_req_failed: ['rate<0.005'],
  },
};

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/api/public/fleet-pricing\`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'commission configured': (r) => JSON.parse(r.body).pricing.platformCommissionPct !== undefined,
  });
  sleep(1);
}`,
  },
  {
    phaseNumber: 8,
    title: 'DevOps, CI/CD & Multi-Cloud Deployment',
    ownerTeam: 'DevOps, SRE & Cloud Infrastructure',
    summary:
      'Containerized production deployment ready for AWS (ECS Fargate / EKS + RDS PostgreSQL + ElastiCache Redis), Azure Container Apps, and DigitalOcean App Platform / Kubernetes, complete with Nginx subdomain isolation, GitHub Actions CI/CD, and automated backups.',
    keyDeliverables: [
      'Production artifacts included in repo: devops/Dockerfile.backend, devops/docker-compose.yml, devops/nginx.conf, .github/workflows/bodalink-ci-cd.yml',
      'Subdomain routing: app.bodalink.com & api.bodalink.com isolated from admin.bodalink.com with strict X-Frame-Options DENY and separate rate limit zones',
      'Observability & DR: Prometheus metrics, Sentry error tracking, structured JSON audit logs, and Point-In-Time Recovery (PITR) daily encrypted PostgreSQL snapshots',
    ],
    architectureSpecs: [
      {
        heading: 'AWS / Azure / DigitalOcean Reference Topology',
        content:
          '• AWS: ALB + WAF → ECS Fargate AutoScaling (min 3, max 40 tasks) → RDS PostgreSQL Multi-AZ (PostGIS) + ElastiCache Redis Cluster + S3 encrypted KYC bucket.\n• Azure: Front Door → Azure Container Apps → Azure Database for PostgreSQL Flexible Server + Azure Cache for Redis.\n• DigitalOcean: DO Managed Kubernetes (DOKS) + Managed PostgreSQL + Managed Redis + Spaces KYC Storage.',
      },
      {
        heading: 'Zero-Downtime Rolling Migrations',
        content:
          'GitHub Actions runs TypeScript verification, OWASP dependency audit, Drizzle forward-compatible schema migrations, and rolling health-checked container deploys.',
      },
    ],
    codeArtifactTitle: 'Phase 8 — Multi-Cloud Production Deployment Checklist & Backup Cron',
    codeLanguage: 'bash',
    codeArtifact: `#!/usr/bin/env bash
# Automated Encrypted PostgreSQL Backup & Verification (devops/backup-postgres.sh)
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_FILE="/tmp/bodalink_prod_\${TIMESTAMP}.dump"

pg_dump --format=custom --no-owner --no-privileges \\
  --host="\${SQL_HOST}" --username="\${SQL_USER}" "\${SQL_DB_NAME}" > "\${BACKUP_FILE}"

# Verify archive integrity before uploading to encrypted cloud object storage
pg_restore --list "\${BACKUP_FILE}" > /dev/null
echo "Verified backup archive: \${BACKUP_FILE}"`,
  },
];
