import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. roles
export const roles = pgTable(
  'roles',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(), // 'CUSTOMER' | 'RIDER'
    description: text('description').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('roles_name_idx').on(table.name)]
);

// 2. users (linked to Firebase Auth uid; strictly Customers & Riders in Mobile App)
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    phone: text('phone'),
    fullName: text('full_name').notNull().default('BodaLink Member'),
    avatarUrl: text('avatar_url'),
    roleId: integer('role_id').references(() => roles.id),
    roleName: text('role_name').notNull().default('CUSTOMER'), // 'CUSTOMER' | 'RIDER'
    otpVerified: boolean('otp_verified').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    preferredTheme: text('preferred_theme').notNull().default('light'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_uid_idx').on(table.uid),
    index('users_email_idx').on(table.email),
    index('users_role_name_idx').on(table.roleName),
  ]
);

// 3. customer_profiles
export const customerProfiles = pgTable(
  'customer_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    defaultCity: text('default_city').notNull().default('Nairobi'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    corporateAccountCode: text('corporate_account_code'),
    savedLocations: jsonb('saved_locations').$type<
      Array<{ label: string; address: string; lat: number; lng: number }>
    >().default([]),
    totalTrips: integer('total_trips').notNull().default(0),
    averageRating: numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('5.00'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('customer_profiles_user_idx').on(table.userId)]
);

// 4. rider_profiles
export const riderProfiles = pgTable(
  'rider_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    nationalIdNumber: text('national_id_number'),
    nationalIdDocUrl: text('national_id_doc_url'),
    drivingLicenseNumber: text('driving_license_number'),
    drivingLicenseDocUrl: text('driving_license_doc_url'),
    profilePhotoUrl: text('profile_photo_url'),
    verificationStatus: text('verification_status').notNull().default('PENDING_DOCUMENTS'), // PENDING_DOCUMENTS | PENDING_REVIEW | APPROVED | REJECTED | SUSPENDED
    verificationNotes: text('verification_notes'),
    approvedByAdminId: integer('approved_by_admin_id'),
    approvedAt: timestamp('approved_at'),
    isOnline: boolean('is_online').notNull().default(false),
    currentLat: doublePrecision('current_lat').default(-1.286389),
    currentLng: doublePrecision('current_lng').default(36.817223),
    operatingZone: text('operating_zone').notNull().default('Nairobi Central & Westlands'),
    completedTrips: integer('completed_trips').notNull().default(0),
    acceptanceRate: numeric('acceptance_rate', { precision: 5, scale: 2 }).notNull().default('98.50'),
    averageRating: numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('4.92'),
    subscriptionPlan: text('subscription_plan').notNull().default('STANDARD_COMMISSION'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('rider_profiles_status_online_idx').on(table.verificationStatus, table.isOnline),
    index('rider_profiles_coords_idx').on(table.currentLat, table.currentLng),
  ]
);

// 5. motorcycles
export const motorcycles = pgTable(
  'motorcycles',
  {
    id: serial('id').primaryKey(),
    riderProfileId: integer('rider_profile_id')
      .references(() => riderProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    registrationNumber: text('registration_number').notNull(), // e.g. KMF 482T
    registrationDocUrl: text('registration_doc_url'),
    make: text('make').notNull().default('Boxer'),
    model: text('model').notNull().default('BM 150 HD'),
    year: integer('year').notNull().default(2024),
    color: text('color').notNull().default('Emerald & Black'),
    engineCc: integer('engine_cc').notNull().default(150),
    isElectric: boolean('is_electric').notNull().default(false),
    hasInsulatedGroceryBox: boolean('has_insulated_grocery_box').notNull().default(true),
    insuranceExpiry: text('insurance_expiry'),
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('motorcycles_reg_idx').on(table.registrationNumber),
    index('motorcycles_rider_idx').on(table.riderProfileId),
  ]
);

// 6. trips (supports RIDE, GROCERY_DELIVERY, PARCEL_DELIVERY, PACKAGE_PICKUP, CORPORATE_RIDE)
export const trips = pgTable(
  'trips',
  {
    id: serial('id').primaryKey(),
    tripCode: text('trip_code').notNull().unique(),
    customerId: integer('customer_id')
      .references(() => users.id)
      .notNull(),
    riderId: integer('rider_id').references(() => users.id),
    serviceType: text('service_type').notNull().default('RIDE'), // RIDE | GROCERY_DELIVERY | PARCEL_DELIVERY | PACKAGE_PICKUP | CORPORATE
    status: text('status').notNull().default('REQUESTED'), // REQUESTED | ACCEPTED | ARRIVING_PICKUP | IN_PROGRESS | COMPLETED | CANCELLED | SOS_ALERT
    pickupAddress: text('pickup_address').notNull(),
    pickupLat: doublePrecision('pickup_lat').notNull(),
    pickupLng: doublePrecision('pickup_lng').notNull(),
    destinationAddress: text('destination_address').notNull(),
    destinationLat: doublePrecision('destination_lat').notNull(),
    destinationLng: doublePrecision('destination_lng').notNull(),
    distanceKm: numeric('distance_km', { precision: 8, scale: 2 }).notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    baseFareKes: numeric('base_fare_kes', { precision: 10, scale: 2 }).notNull(),
    distanceCostKes: numeric('distance_cost_kes', { precision: 10, scale: 2 }).notNull(),
    timeCostKes: numeric('time_cost_kes', { precision: 10, scale: 2 }).notNull(),
    peakHourFeeKes: numeric('peak_hour_fee_kes', { precision: 10, scale: 2 }).notNull().default('0.00'),
    nightFeeKes: numeric('night_fee_kes', { precision: 10, scale: 2 }).notNull().default('0.00'),
    weatherRiskFeeKes: numeric('weather_risk_fee_kes', { precision: 10, scale: 2 }).notNull().default('0.00'),
    discountKes: numeric('discount_kes', { precision: 10, scale: 2 }).notNull().default('0.00'),
    totalFareKes: numeric('total_fare_kes', { precision: 10, scale: 2 }).notNull(),
    commissionRatePct: numeric('commission_rate_pct', { precision: 5, scale: 2 }).notNull().default('15.00'),
    platformCommissionKes: numeric('platform_commission_kes', { precision: 10, scale: 2 }).notNull(),
    riderEarningsKes: numeric('rider_earnings_kes', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').notNull().default('MPESA'), // MPESA | WALLET | CASH
    paymentStatus: text('payment_status').notNull().default('PENDING'), // PENDING | PAID | REFUNDED
    promoCodeUsed: text('promo_code_used'),
    shareToken: text('share_token').notNull(),
    sosTriggered: boolean('sos_triggered').notNull().default(false),
    groceryStoreName: text('grocery_store_name'),
    groceryItemsManifest: jsonb('grocery_items_manifest').$type<
      Array<{ name: string; qty: number; priceKes: number }>
    >().default([]),
    acceptedAt: timestamp('accepted_at'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('trips_customer_idx').on(table.customerId),
    index('trips_rider_idx').on(table.riderId),
    index('trips_status_idx').on(table.status),
    index('trips_created_idx').on(table.createdAt),
  ]
);

// 7. trip_locations (Real-time GPS breadcrumb telemetry)
export const tripLocations = pgTable(
  'trip_locations',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id')
      .references(() => trips.id, { onDelete: 'cascade' })
      .notNull(),
    riderId: integer('rider_id').references(() => users.id),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    heading: doublePrecision('heading').default(0),
    speedKmh: doublePrecision('speed_kmh').default(32),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  },
  (table) => [index('trip_locations_trip_idx').on(table.tripId)]
);

// 8. parcel_deliveries (Parcel & Grocery Cargo Chain-of-Custody)
export const parcelDeliveries = pgTable(
  'parcel_deliveries',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id')
      .references(() => trips.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    recipientName: text('recipient_name').notNull(),
    recipientPhone: text('recipient_phone').notNull(),
    packageDescription: text('package_description').notNull(),
    packageCategory: text('package_category').notNull().default('GROCERY_BASKET'), // GROCERY_BASKET | DOCUMENTS | ELECTRONICS | RETAIL_PACKAGE
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }).notNull().default('3.50'),
    requiresInsulatedBox: boolean('requires_insulated_box').notNull().default(true),
    deliveryPinCode: text('delivery_pin_code').notNull(),
    proofOfDeliveryNote: text('proof_of_delivery_note'),
    proofOfDeliveryPhotoUrl: text('proof_of_delivery_photo_url'),
    collectedAt: timestamp('collected_at'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('parcel_deliveries_trip_idx').on(table.tripId)]
);

// 9. payments (M-Pesa Daraja STK Push, Wallet, Cash & Receipts)
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').references(() => trips.id),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    amountKes: numeric('amount_kes', { precision: 10, scale: 2 }).notNull(),
    method: text('method').notNull(), // MPESA | WALLET | CASH
    status: text('status').notNull().default('COMPLETED'), // STK_PUSH_SENT | COMPLETED | FAILED | REFUNDED
    mpesaPhone: text('mpesa_phone'),
    mpesaCheckoutRequestId: text('mpesa_checkout_request_id'),
    mpesaReceiptNumber: text('mpesa_receipt_number'),
    receiptCode: text('receipt_code').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('payments_user_idx').on(table.userId),
    index('payments_trip_idx').on(table.tripId),
    index('payments_mpesa_receipt_idx').on(table.mpesaReceiptNumber),
  ]
);

// 10. wallets
export const wallets = pgTable(
  'wallets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    balanceKes: numeric('balance_kes', { precision: 12, scale: 2 }).notNull().default('1500.00'),
    currency: text('currency').notNull().default('KES'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('wallets_user_idx').on(table.userId)]
);

// 11. wallet_transactions
export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: serial('id').primaryKey(),
    walletId: integer('wallet_id')
      .references(() => wallets.id, { onDelete: 'cascade' })
      .notNull(),
    tripId: integer('trip_id').references(() => trips.id),
    txType: text('tx_type').notNull(), // TOP_UP | RIDE_PAYMENT | RIDER_SETTLEMENT | COMMISSION_DEDUCTION | WITHDRAWAL | REFUND
    amountKes: numeric('amount_kes', { precision: 12, scale: 2 }).notNull(),
    balanceAfterKes: numeric('balance_after_kes', { precision: 12, scale: 2 }).notNull(),
    reference: text('reference').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('wallet_tx_wallet_idx').on(table.walletId)]
);

// 12. withdrawals (Rider M-Pesa B2C Payouts)
export const withdrawals = pgTable(
  'withdrawals',
  {
    id: serial('id').primaryKey(),
    riderUserId: integer('rider_user_id')
      .references(() => users.id)
      .notNull(),
    amountKes: numeric('amount_kes', { precision: 12, scale: 2 }).notNull(),
    mpesaPhone: text('mpesa_phone').notNull(),
    status: text('status').notNull().default('COMPLETED'), // PENDING | APPROVED | COMPLETED | REJECTED
    mpesaB2cReference: text('mpesa_b2c_reference').notNull(),
    processedAt: timestamp('processed_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('withdrawals_rider_idx').on(table.riderUserId)]
);

// 13. ratings
export const ratings = pgTable(
  'ratings',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id')
      .references(() => trips.id, { onDelete: 'cascade' })
      .notNull(),
    reviewerId: integer('reviewer_id')
      .references(() => users.id)
      .notNull(),
    revieweeId: integer('reviewee_id').references(() => users.id),
    score: integer('score').notNull(), // 1..5
    comment: text('comment'),
    safetyTags: jsonb('safety_tags').$type<string[]>().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('ratings_trip_idx').on(table.tripId)]
);

// 14. notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    channel: text('channel').notNull().default('FCM_AND_SOCKET'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

// 15. support_tickets (Real-time Support Chat & SOS Escalations)
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: serial('id').primaryKey(),
    ticketNumber: text('ticket_number').notNull().unique(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    tripId: integer('trip_id').references(() => trips.id),
    category: text('category').notNull().default('GENERAL_SUPPORT'), // EMERGENCY_SOS | PAYMENT | PARCEL_ISSUE | GENERAL_SUPPORT
    priority: text('priority').notNull().default('NORMAL'), // CRITICAL | HIGH | NORMAL
    subject: text('subject').notNull(),
    status: text('status').notNull().default('OPEN'), // OPEN | IN_PROGRESS | RESOLVED
    messages: jsonb('messages').$type<
      Array<{ senderRole: string; senderName: string; body: string; sentAt: string }>
    >().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('support_tickets_user_idx').on(table.userId)]
);

// 16. promo_codes
export const promoCodes = pgTable(
  'promo_codes',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    description: text('description').notNull(),
    discountPercent: integer('discount_percent').notNull().default(15),
    maxDiscountKes: numeric('max_discount_kes', { precision: 10, scale: 2 }).notNull().default('150.00'),
    isActive: boolean('is_active').notNull().default(true),
    usageCount: integer('usage_count').notNull().default(0),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('promo_codes_code_idx').on(table.code)]
);

// 17. audit_logs (Customer/Rider Security & Financial Audit Trail)
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    ipAddress: text('ip_address'),
    deviceFingerprint: text('device_fingerprint'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

// ============================================================================
// SEPARATE ADMIN PORTAL TABLES (Strictly isolated from Mobile Customer/Rider)
// ============================================================================

// 18. admin_roles (Super Admin, Operations Manager, Finance Manager, Customer Support, Compliance Officer)
export const adminRoles = pgTable(
  'admin_roles',
  {
    id: serial('id').primaryKey(),
    roleKey: text('role_key').notNull().unique(), // SUPER_ADMIN | OPERATIONS_MANAGER | FINANCE_MANAGER | CUSTOMER_SUPPORT | COMPLIANCE_OFFICER
    displayName: text('display_name').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('admin_roles_key_idx').on(table.roleKey)]
);

// 19. admin_permissions
export const adminPermissions = pgTable(
  'admin_permissions',
  {
    id: serial('id').primaryKey(),
    roleId: integer('role_id')
      .references(() => adminRoles.id, { onDelete: 'cascade' })
      .notNull(),
    permissionKey: text('permission_key').notNull(), // MANAGE_ADMINS | APPROVE_RIDERS | CONFIGURE_PRICING | VIEW_FINANCE | MANAGE_SUPPORT | VIEW_AUDIT
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('admin_permissions_role_idx').on(table.roleId)]
);

// 20. admin_users (Created exclusively by Super Admin; isolated from mobile login)
export const adminUsers = pgTable(
  'admin_users',
  {
    id: serial('id').primaryKey(),
    firebaseUid: text('firebase_uid').unique(),
    email: text('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    roleId: integer('role_id')
      .references(() => adminRoles.id)
      .notNull(),
    roleKey: text('role_key').notNull().default('SUPER_ADMIN'),
    mfaEnabled: boolean('mfa_enabled').notNull().default(true),
    mfaPasscode: text('mfa_passcode').notNull().default('246810'),
    emailVerified: boolean('email_verified').notNull().default(true),
    deviceVerified: boolean('device_verified').notNull().default(true),
    createdByAdminId: integer('created_by_admin_id'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginIp: text('last_login_ip'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('admin_users_email_idx').on(table.email)]
);

// 21. admin_sessions (Device & IP Monitoring + MFA Verification State)
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: serial('id').primaryKey(),
    adminUserId: integer('admin_user_id')
      .references(() => adminUsers.id, { onDelete: 'cascade' })
      .notNull(),
    sessionToken: text('session_token').notNull().unique(),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent').notNull(),
    deviceLabel: text('device_label').notNull(),
    mfaVerified: boolean('mfa_verified').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('admin_sessions_admin_idx').on(table.adminUserId)]
);

// 22. admin_audit_logs
export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: serial('id').primaryKey(),
    adminUserId: integer('admin_user_id').references(() => adminUsers.id),
    adminEmail: text('admin_email').notNull(),
    adminRole: text('admin_role').notNull(),
    action: text('action').notNull(),
    targetResource: text('target_resource').notNull(),
    ipAddress: text('ip_address').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('admin_audit_created_idx').on(table.createdAt)]
);

// Platform Dynamic Pricing & Commission Configuration Table
export const pricingConfigs = pgTable('pricing_configs', {
  id: serial('id').primaryKey(),
  configKey: text('config_key').notNull().unique().default('DEFAULT_KENYA'),
  baseFareKes: numeric('base_fare_kes', { precision: 10, scale: 2 }).notNull().default('100.00'),
  distanceRatePerKmKes: numeric('distance_rate_per_km_kes', { precision: 10, scale: 2 }).notNull().default('20.00'),
  timeRatePerMinKes: numeric('time_rate_per_min_kes', { precision: 10, scale: 2 }).notNull().default('2.00'),
  peakHourFeeKes: numeric('peak_hour_fee_kes', { precision: 10, scale: 2 }).notNull().default('40.00'),
  nightFeeKes: numeric('night_fee_kes', { precision: 10, scale: 2 }).notNull().default('50.00'),
  weatherRiskFeeKes: numeric('weather_risk_fee_kes', { precision: 10, scale: 2 }).notNull().default('30.00'),
  platformCommissionPct: numeric('platform_commission_pct', { precision: 5, scale: 2 }).notNull().default('15.00'),
  peakHourActive: boolean('peak_hour_active').notNull().default(false),
  nightFeeActive: boolean('night_fee_active').notNull().default(false),
  weatherRiskActive: boolean('weather_risk_active').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  customerProfile: one(customerProfiles, {
    fields: [users.id],
    references: [customerProfiles.userId],
  }),
  riderProfile: one(riderProfiles, {
    fields: [users.id],
    references: [riderProfiles.userId],
  }),
  wallet: one(wallets, { fields: [users.id], references: [wallets.userId] }),
  customerTrips: many(trips),
}));

export const riderProfilesRelations = relations(riderProfiles, ({ one, many }) => ({
  user: one(users, { fields: [riderProfiles.userId], references: [users.id] }),
  motorcycles: many(motorcycles),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  customer: one(users, { fields: [trips.customerId], references: [users.id] }),
  parcelDelivery: one(parcelDeliveries, {
    fields: [trips.id],
    references: [parcelDeliveries.tripId],
  }),
  locations: many(tripLocations),
  payments: many(payments),
  ratings: many(ratings),
}));
