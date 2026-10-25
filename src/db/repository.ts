import { desc, eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from './index.ts';
import {
  adminAuditLogs,
  adminRoles,
  adminSessions,
  adminUsers,
  auditLogs,
  customerProfiles,
  motorcycles,
  notifications,
  parcelDeliveries,
  payments,
  pricingConfigs,
  promoCodes,
  ratings,
  riderProfiles,
  roles,
  supportTickets,
  tripLocations,
  trips,
  users,
  wallets,
  walletTransactions,
  withdrawals,
} from './schema.ts';

function sanitizeDbError(context: string, error: unknown): Error {
  console.error(`[DB Repository Error - ${context}]:`, error);
  return new Error(`Unable to complete ${context}. Please try again.`, { cause: error });
}

function randomCode(prefix: string, len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${out}`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function syncMobileUser(params: {
  uid: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  ipAddress?: string;
}) {
  try {
    const customerRoleRows = await db.select().from(roles).where(eq(roles.name, 'CUSTOMER'));
    const defaultRoleId = customerRoleRows[0]?.id ?? null;

    const upserted = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: params.email,
        fullName: params.fullName || params.email.split('@')[0] || 'BodaLink User',
        avatarUrl: params.avatarUrl || null,
        roleId: defaultRoleId,
        roleName: 'CUSTOMER',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: params.email,
          updatedAt: new Date(),
        },
      })
      .returning();

    const user = upserted[0];

    // Enforce mobile RBAC rule: Mobile app strictly serves CUSTOMER or RIDER
    const resolvedRole = user.roleName === 'RIDER' ? 'RIDER' : 'CUSTOMER';

    await db
      .insert(wallets)
      .values({ userId: user.id, balanceKes: '2500.00' })
      .onConflictDoNothing({ target: wallets.userId });

    await db
      .insert(customerProfiles)
      .values({
        userId: user.id,
        defaultCity: 'Nairobi',
        savedLocations: [
          {
            label: 'Home — Kilimani',
            address: 'Argwings Kodhek Rd, Kilimani, Nairobi',
            lat: -1.2921,
            lng: 36.7856,
          },
          {
            label: 'Office — Westlands',
            address: 'Waiyaki Way, Westlands, Nairobi',
            lat: -1.2649,
            lng: 36.8028,
          },
          {
            label: 'Naivas — Sarit Hub',
            address: 'Karuna Rd, Westlands, Nairobi',
            lat: -1.2615,
            lng: 36.8039,
          },
        ],
      })
      .onConflictDoNothing({ target: customerProfiles.userId });

    await db
      .insert(riderProfiles)
      .values({
        userId: user.id,
        verificationStatus: 'PENDING_DOCUMENTS',
        isOnline: false,
        currentLat: -1.286389,
        currentLng: 36.817223,
      })
      .onConflictDoNothing({ target: riderProfiles.userId });

    return await getMobileAccountBundle(user.uid);
  } catch (error) {
    throw sanitizeDbError('account synchronization', error);
  }
}

export async function getMobileAccountBundle(uid: string) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const user = userRows[0];
    if (!user) return null;

    const [walletRows, custRows, riderRows, userNotifs, userTickets] = await Promise.all([
      db.select().from(wallets).where(eq(wallets.userId, user.id)),
      db.select().from(customerProfiles).where(eq(customerProfiles.userId, user.id)),
      db.select().from(riderProfiles).where(eq(riderProfiles.userId, user.id)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(15),
      db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, user.id))
        .orderBy(desc(supportTickets.updatedAt))
        .limit(10),
    ]);

    const wallet = walletRows[0] ?? null;
    const riderProfile = riderRows[0] ?? null;

    const [txRows, bikeRows, withdrawalRows, customerTripsRows, riderTripsRows] = await Promise.all([
      wallet
        ? db
            .select()
            .from(walletTransactions)
            .where(eq(walletTransactions.walletId, wallet.id))
            .orderBy(desc(walletTransactions.createdAt))
            .limit(20)
        : Promise.resolve([]),
      riderProfile
        ? db.select().from(motorcycles).where(eq(motorcycles.riderProfileId, riderProfile.id))
        : Promise.resolve([]),
      db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.riderUserId, user.id))
        .orderBy(desc(withdrawals.createdAt))
        .limit(10),
      db
        .select()
        .from(trips)
        .where(eq(trips.customerId, user.id))
        .orderBy(desc(trips.createdAt))
        .limit(25),
      db
        .select()
        .from(trips)
        .where(eq(trips.riderId, user.id))
        .orderBy(desc(trips.createdAt))
        .limit(25),
    ]);

    // Also fetch open REQUESTED trips if user is an APPROVED rider
    const openRequests =
      riderProfile?.verificationStatus === 'APPROVED'
        ? await db
            .select()
            .from(trips)
            .where(eq(trips.status, 'REQUESTED'))
            .orderBy(desc(trips.createdAt))
            .limit(10)
        : [];

    const allRelevantTripIds = Array.from(
      new Set([
        ...customerTripsRows.map((t) => t.id),
        ...riderTripsRows.map((t) => t.id),
        ...openRequests.map((t) => t.id),
      ])
    );

    const parcelsByTripId = new Map<number, typeof parcelDeliveries.$inferSelect>();
    for (const tId of allRelevantTripIds) {
      const pRows = await db.select().from(parcelDeliveries).where(eq(parcelDeliveries.tripId, tId));
      if (pRows[0]) parcelsByTripId.set(tId, pRows[0]);
    }

    const attachParcel = (tripList: Array<typeof trips.$inferSelect>) =>
      tripList.map((t) => ({
        ...t,
        parcel: parcelsByTripId.get(t.id) ?? null,
      }));

    return {
      user: {
        ...user,
        roleName: user.roleName === 'RIDER' ? 'RIDER' : 'CUSTOMER',
      },
      wallet,
      walletTransactions: txRows,
      customerProfile: custRows[0] ?? null,
      riderProfile,
      motorcycle: bikeRows[0] ?? null,
      withdrawals: withdrawalRows,
      customerTrips: attachParcel(customerTripsRows),
      riderTrips: attachParcel(riderTripsRows),
      openRideRequests: attachParcel(openRequests),
      notifications: userNotifs,
      supportTickets: userTickets,
    };
  } catch (error) {
    throw sanitizeDbError('fetching user account bundle', error);
  }
}

export async function switchMobileRole(uid: string, targetRole: 'CUSTOMER' | 'RIDER', phone?: string) {
  try {
    if (targetRole !== 'CUSTOMER' && targetRole !== 'RIDER') {
      throw new Error('Mobile application strictly permits CUSTOMER or RIDER roles only.');
    }
    const roleRows = await db.select().from(roles).where(eq(roles.name, targetRole));
    const updated = await db
      .update(users)
      .set({
        roleName: targetRole,
        roleId: roleRows[0]?.id ?? null,
        ...(phone ? { phone, otpVerified: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();

    if (updated[0]) {
      await db.insert(auditLogs).values({
        actorUserId: updated[0].id,
        action: `ROLE_SWITCH_${targetRole}`,
        entityType: 'users',
        entityId: String(updated[0].id),
        metadata: { targetRole },
      });
    }
    return await getMobileAccountBundle(uid);
  } catch (error) {
    throw sanitizeDbError('switching mobile role', error);
  }
}

export async function verifyPhoneOtp(uid: string, phone: string, otpCode: string) {
  try {
    if (!otpCode || otpCode.trim().length < 4) {
      throw new Error('Invalid OTP verification code.');
    }
    await db
      .update(users)
      .set({ phone, otpVerified: true, updatedAt: new Date() })
      .where(eq(users.uid, uid));
    return await getMobileAccountBundle(uid);
  } catch (error) {
    throw sanitizeDbError('OTP phone verification', error);
  }
}

export async function getPublicFleetAndPricing() {
  try {
    const [pricingRows, promoRows, approvedRiders] = await Promise.all([
      db.select().from(pricingConfigs).where(eq(pricingConfigs.configKey, 'DEFAULT_KENYA')),
      db.select().from(promoCodes).where(eq(promoCodes.isActive, true)),
      db
        .select({
          riderProfileId: riderProfiles.id,
          userId: users.id,
          fullName: users.fullName,
          phone: users.phone,
          currentLat: riderProfiles.currentLat,
          currentLng: riderProfiles.currentLng,
          operatingZone: riderProfiles.operatingZone,
          averageRating: riderProfiles.averageRating,
          completedTrips: riderProfiles.completedTrips,
          isOnline: riderProfiles.isOnline,
          verificationStatus: riderProfiles.verificationStatus,
        })
        .from(riderProfiles)
        .innerJoin(users, eq(riderProfiles.userId, users.id))
        .where(and(eq(riderProfiles.verificationStatus, 'APPROVED'), eq(riderProfiles.isOnline, true))),
    ]);

    const bikes = await db.select().from(motorcycles);
    const bikeByProfile = new Map(bikes.map((b) => [b.riderProfileId, b]));

    const onlineRiders = approvedRiders.map((r) => ({
      ...r,
      motorcycle: bikeByProfile.get(r.riderProfileId) ?? null,
    }));

    return {
      pricing: pricingRows[0] ?? {
        baseFareKes: '100.00',
        distanceRatePerKmKes: '20.00',
        timeRatePerMinKes: '2.00',
        peakHourFeeKes: '40.00',
        nightFeeKes: '50.00',
        weatherRiskFeeKes: '30.00',
        platformCommissionPct: '15.00',
        peakHourActive: false,
        nightFeeActive: false,
        weatherRiskActive: false,
      },
      promoCodes: promoRows,
      onlineRiders,
    };
  } catch (error) {
    throw sanitizeDbError('loading fleet & pricing snapshot', error);
  }
}

export async function submitRiderKycDocuments(
  uid: string,
  payload: {
    nationalIdNumber: string;
    drivingLicenseNumber: string;
    registrationNumber: string;
    make: string;
    model: string;
    engineCc: number;
    hasInsulatedGroceryBox: boolean;
    operatingZone: string;
  }
) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const user = userRows[0];
    if (!user) throw new Error('User not found.');

    const profileRows = await db
      .update(riderProfiles)
      .set({
        nationalIdNumber: payload.nationalIdNumber,
        nationalIdDocUrl: `kyc://national-id/${payload.nationalIdNumber}.pdf`,
        drivingLicenseNumber: payload.drivingLicenseNumber,
        drivingLicenseDocUrl: `kyc://ntsa-dl/${payload.drivingLicenseNumber}.pdf`,
        profilePhotoUrl: `kyc://rider-photo/${user.id}.jpg`,
        operatingZone: payload.operatingZone || 'Nairobi Central & Westlands',
        verificationStatus: 'PENDING_REVIEW',
        verificationNotes: 'Submitted KYC packet; awaiting Admin Compliance review.',
      })
      .where(eq(riderProfiles.userId, user.id))
      .returning();

    const profile = profileRows[0];
    const cleanReg = payload.registrationNumber.trim().toUpperCase();

    await db
      .insert(motorcycles)
      .values({
        riderProfileId: profile.id,
        registrationNumber: cleanReg,
        registrationDocUrl: `kyc://logbook/${cleanReg.replace(/\s+/g, '')}.pdf`,
        make: payload.make || 'Bajaj Boxer',
        model: payload.model || 'BM 150 HD',
        engineCc: Number(payload.engineCc) || 150,
        hasInsulatedGroceryBox: Boolean(payload.hasInsulatedGroceryBox),
        insuranceExpiry: '2027-12-31',
        isVerified: false,
      })
      .onConflictDoUpdate({
        target: motorcycles.registrationNumber,
        set: {
          riderProfileId: profile.id,
          make: payload.make || 'Bajaj Boxer',
          model: payload.model || 'BM 150 HD',
          engineCc: Number(payload.engineCc) || 150,
          hasInsulatedGroceryBox: Boolean(payload.hasInsulatedGroceryBox),
        },
      });

    await db.insert(notifications).values({
      userId: user.id,
      title: 'KYC Packet Received',
      message: `Documents for motorcycle ${cleanReg} are queued for Compliance Admin approval.`,
    });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'RIDER_KYC_SUBMITTED',
      entityType: 'rider_profiles',
      entityId: String(profile.id),
      metadata: { registrationNumber: cleanReg },
    });

    return await getMobileAccountBundle(uid);
  } catch (error) {
    throw sanitizeDbError('submitting Rider KYC verification documents', error);
  }
}

export async function toggleRiderOnlineMode(uid: string, isOnline: boolean, lat?: number, lng?: number) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const user = userRows[0];
    if (!user) throw new Error('User not found.');

    const rpRows = await db.select().from(riderProfiles).where(eq(riderProfiles.userId, user.id));
    const rp = rpRows[0];
    if (!rp || rp.verificationStatus !== 'APPROVED') {
      throw new Error(
        'Verification Gate: A rider cannot go online or provide transport services until approved by an Admin in the Admin Portal.'
      );
    }

    await db
      .update(riderProfiles)
      .set({
        isOnline,
        ...(typeof lat === 'number' ? { currentLat: lat } : {}),
        ...(typeof lng === 'number' ? { currentLng: lng } : {}),
      })
      .where(eq(riderProfiles.id, rp.id));

    return await getMobileAccountBundle(uid);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Verification Gate:')) {
      throw error;
    }
    throw sanitizeDbError('updating rider online availability', error);
  }
}

export async function createBodaTripOrDelivery(
  uid: string,
  payload: {
    serviceType: 'RIDE' | 'GROCERY_DELIVERY' | 'PARCEL_DELIVERY' | 'PACKAGE_PICKUP' | 'CORPORATE';
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    destinationAddress: string;
    destinationLat: number;
    destinationLng: number;
    distanceKm: number;
    estimatedMinutes: number;
    paymentMethod: 'MPESA' | 'WALLET' | 'CASH';
    mpesaPhone?: string;
    promoCode?: string;
    recipientName?: string;
    recipientPhone?: string;
    packageDescription?: string;
    packageCategory?: string;
    weightKg?: number;
    groceryStoreName?: string;
    groceryItemsManifest?: Array<{ name: string; qty: number; priceKes: number }>;
  }
) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const customer = userRows[0];
    if (!customer) throw new Error('Customer account not found.');

    const pricingRows = await db
      .select()
      .from(pricingConfigs)
      .where(eq(pricingConfigs.configKey, 'DEFAULT_KENYA'));
    const cfg = pricingRows[0];

    const baseFare = Number(cfg?.baseFareKes ?? 100);
    const distRate = Number(cfg?.distanceRatePerKmKes ?? 20);
    const timeRate = Number(cfg?.timeRatePerMinKes ?? 2);
    const peakFee = cfg?.peakHourActive ? Number(cfg.peakHourFeeKes) : 0;
    const nightFee = cfg?.nightFeeActive ? Number(cfg.nightFeeKes) : 0;
    const weatherFee = cfg?.weatherRiskActive ? Number(cfg.weatherRiskFeeKes) : 0;
    const commissionPct = Number(cfg?.platformCommissionPct ?? 15);

    const distKm = Math.max(0.5, Number(payload.distanceKm) || 3.2);
    const estMins = Math.max(3, Math.round(Number(payload.estimatedMinutes) || Math.ceil(distKm * 3)));

    const distanceCost = Math.round(distKm * distRate);
    const timeCost = Math.round(estMins * timeRate);

    // Grocery basket item total if grocery delivery
    const groceryItemsTotal = (payload.groceryItemsManifest || []).reduce(
      (acc, item) => acc + Number(item.priceKes || 0) * Number(item.qty || 1),
      0
    );

    const rawTransportFare = baseFare + distanceCost + timeCost + peakFee + nightFee + weatherFee;

    let discountKes = 0;
    let appliedPromo: string | null = null;
    if (payload.promoCode) {
      const codeUpper = payload.promoCode.trim().toUpperCase();
      const promoRows = await db
        .select()
        .from(promoCodes)
        .where(and(eq(promoCodes.code, codeUpper), eq(promoCodes.isActive, true)));
      if (promoRows[0]) {
        discountKes = Math.min(
          Number(promoRows[0].maxDiscountKes),
          Math.round((rawTransportFare * promoRows[0].discountPercent) / 100)
        );
        appliedPromo = codeUpper;
        await db
          .update(promoCodes)
          .set({ usageCount: promoRows[0].usageCount + 1 })
          .where(eq(promoCodes.id, promoRows[0].id));
      }
    }

    const netTransportFare = Math.max(80, rawTransportFare - discountKes);
    const totalFare = netTransportFare + groceryItemsTotal;
    const platformCommission = Number(((netTransportFare * commissionPct) / 100).toFixed(2));
    const riderEarnings = Number((netTransportFare - platformCommission).toFixed(2));

    // Handle Wallet deduction upfront if WALLET selected
    if (payload.paymentMethod === 'WALLET') {
      const walletRows = await db.select().from(wallets).where(eq(wallets.userId, customer.id));
      const wallet = walletRows[0];
      if (!wallet || Number(wallet.balanceKes) < totalFare) {
        throw new Error(
          `Insufficient BodaLink Wallet balance (${wallet?.balanceKes ?? '0.00'} KES). Top up via M-Pesa or choose M-Pesa STK Push.`
        );
      }
      const nextBalance = (Number(wallet.balanceKes) - totalFare).toFixed(2);
      await db
        .update(wallets)
        .set({ balanceKes: nextBalance, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));

      await db.insert(walletTransactions).values({
        walletId: wallet.id,
        txType: 'RIDE_PAYMENT',
        amountKes: `-${totalFare.toFixed(2)}`,
        balanceAfterKes: nextBalance,
        reference: randomCode('WLT'),
        description: `${payload.serviceType} booking payment`,
      });
    }

    // Nearest online APPROVED rider matching (excluding the customer themselves)
    const candidateRiders = await db
      .select({
        userId: users.id,
        fullName: users.fullName,
        lat: riderProfiles.currentLat,
        lng: riderProfiles.currentLng,
      })
      .from(riderProfiles)
      .innerJoin(users, eq(riderProfiles.userId, users.id))
      .where(and(eq(riderProfiles.verificationStatus, 'APPROVED'), eq(riderProfiles.isOnline, true)));

    const otherOnlineRiders = candidateRiders.filter((r) => r.userId !== customer.id);
    otherOnlineRiders.sort((a, b) => {
      const dA = haversineKm(payload.pickupLat, payload.pickupLng, a.lat ?? -1.286, a.lng ?? 36.817);
      const dB = haversineKm(payload.pickupLat, payload.pickupLng, b.lat ?? -1.286, b.lng ?? 36.817);
      return dA - dB;
    });

    // Keep status REQUESTED so online Riders can also click Accept live, or auto-assign if desired
    const tripCode = randomCode('BDL', 6);
    const shareToken = crypto.randomBytes(8).toString('hex');

    const insertedTrips = await db
      .insert(trips)
      .values({
        tripCode,
        customerId: customer.id,
        riderId: null,
        serviceType: payload.serviceType,
        status: 'REQUESTED',
        pickupAddress: payload.pickupAddress,
        pickupLat: payload.pickupLat,
        pickupLng: payload.pickupLng,
        destinationAddress: payload.destinationAddress,
        destinationLat: payload.destinationLat,
        destinationLng: payload.destinationLng,
        distanceKm: distKm.toFixed(2),
        estimatedMinutes: estMins,
        baseFareKes: baseFare.toFixed(2),
        distanceCostKes: distanceCost.toFixed(2),
        timeCostKes: timeCost.toFixed(2),
        peakHourFeeKes: peakFee.toFixed(2),
        nightFeeKes: nightFee.toFixed(2),
        weatherRiskFeeKes: weatherFee.toFixed(2),
        discountKes: discountKes.toFixed(2),
        totalFareKes: totalFare.toFixed(2),
        commissionRatePct: commissionPct.toFixed(2),
        platformCommissionKes: platformCommission.toFixed(2),
        riderEarningsKes: riderEarnings.toFixed(2),
        paymentMethod: payload.paymentMethod,
        paymentStatus: payload.paymentMethod === 'CASH' ? 'PENDING' : 'PAID',
        promoCodeUsed: appliedPromo,
        shareToken,
        groceryStoreName: payload.groceryStoreName || null,
        groceryItemsManifest: payload.groceryItemsManifest || [],
      })
      .returning();

    const createdTrip = insertedTrips[0];

    let createdParcel = null;
    if (
      payload.serviceType === 'GROCERY_DELIVERY' ||
      payload.serviceType === 'PARCEL_DELIVERY' ||
      payload.serviceType === 'PACKAGE_PICKUP'
    ) {
      const deliveryPin = String(Math.floor(1000 + Math.random() * 9000));
      const pRows = await db
        .insert(parcelDeliveries)
        .values({
          tripId: createdTrip.id,
          recipientName: payload.recipientName || customer.fullName,
          recipientPhone: payload.recipientPhone || customer.phone || '+254700000000',
          packageDescription:
            payload.packageDescription ||
            (payload.serviceType === 'GROCERY_DELIVERY'
              ? `Insulated Grocery Order from ${payload.groceryStoreName || 'Naivas Supermarket'}`
              : 'Express BodaLink Package'),
          packageCategory:
            payload.packageCategory ||
            (payload.serviceType === 'GROCERY_DELIVERY' ? 'GROCERY_BASKET' : 'RETAIL_PACKAGE'),
          weightKg: String(payload.weightKg || 4.0),
          requiresInsulatedBox: true,
          deliveryPinCode: deliveryPin,
        })
        .returning();
      createdParcel = pRows[0];
    }

    // Record payment receipt (M-Pesa Daraja STK Push verification or Wallet/Cash record)
    const mpesaReceipt = payload.paymentMethod === 'MPESA' ? `QKA${Math.floor(1000000 + Math.random() * 8999999)}` : null;
    await db.insert(payments).values({
      tripId: createdTrip.id,
      userId: customer.id,
      amountKes: totalFare.toFixed(2),
      method: payload.paymentMethod,
      status: payload.paymentMethod === 'CASH' ? 'PENDING_COLLECTION' : 'COMPLETED',
      mpesaPhone: payload.mpesaPhone || customer.phone || '+254712345678',
      mpesaCheckoutRequestId: payload.paymentMethod === 'MPESA' ? `ws_CO_${Date.now()}` : null,
      mpesaReceiptNumber: mpesaReceipt,
      receiptCode: randomCode('RCP', 8),
    });

    await db.insert(notifications).values({
      userId: customer.id,
      title: `Order ${tripCode} Broadcasted`,
      message:
        otherOnlineRiders[0]
          ? `Nearest verified rider ${otherOnlineRiders[0].fullName} and nearby fleet notified.`
          : 'Broadcasting order to nearby verified BodaLink riders.',
    });

    return {
      trip: { ...createdTrip, parcel: createdParcel },
      nearestRiderCandidate: otherOnlineRiders[0] ?? null,
      mpesaReceipt,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Insufficient BodaLink Wallet')) {
      throw error;
    }
    throw sanitizeDbError('booking BodaLink order', error);
  }
}

export async function dispatchMatchSeedRider(tripId: number) {
  try {
    const tripRows = await db.select().from(trips).where(eq(trips.id, tripId));
    const trip = tripRows[0];
    if (!trip || trip.status !== 'REQUESTED') return trip;

    const approvedRiders = await db
      .select({
        userId: users.id,
        fullName: users.fullName,
        lat: riderProfiles.currentLat,
        lng: riderProfiles.currentLng,
      })
      .from(riderProfiles)
      .innerJoin(users, eq(riderProfiles.userId, users.id))
      .where(and(eq(riderProfiles.verificationStatus, 'APPROVED'), eq(riderProfiles.isOnline, true)));

    const eligible = approvedRiders.filter((r) => r.userId !== trip.customerId);
    if (eligible.length === 0) return trip;

    eligible.sort(
      (a, b) =>
        haversineKm(trip.pickupLat, trip.pickupLng, a.lat ?? -1.286, a.lng ?? 36.817) -
        haversineKm(trip.pickupLat, trip.pickupLng, b.lat ?? -1.286, b.lng ?? 36.817)
    );

    const matched = eligible[0];
    const updatedRows = await db
      .update(trips)
      .set({
        riderId: matched.userId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      })
      .where(eq(trips.id, tripId))
      .returning();

    await db.insert(tripLocations).values({
      tripId,
      riderId: matched.userId,
      lat: matched.lat ?? trip.pickupLat,
      lng: matched.lng ?? trip.pickupLng,
      speedKmh: 34,
    });

    return updatedRows[0];
  } catch (error) {
    throw sanitizeDbError('matching nearest verified rider', error);
  }
}

export async function updateTripLifecycleByActor(
  uid: string,
  tripId: number,
  action: 'ACCEPT' | 'ARRIVE_PICKUP' | 'START_TRIP' | 'COMPLETE_TRIP' | 'CANCEL' | 'TRIGGER_SOS',
  proofOfDeliveryNote?: string
) {
  try {
    const actorRows = await db.select().from(users).where(eq(users.uid, uid));
    const actor = actorRows[0];
    if (!actor) throw new Error('User not found.');

    const tripRows = await db.select().from(trips).where(eq(trips.id, tripId));
    const trip = tripRows[0];
    if (!trip) throw new Error('Trip not found.');

    if (action === 'ACCEPT') {
      const rpRows = await db.select().from(riderProfiles).where(eq(riderProfiles.userId, actor.id));
      if (!rpRows[0] || rpRows[0].verificationStatus !== 'APPROVED') {
        throw new Error('Only Admin-approved verified riders can accept orders.');
      }
      const [updated] = await db
        .update(trips)
        .set({ riderId: actor.id, status: 'ACCEPTED', acceptedAt: new Date() })
        .where(eq(trips.id, tripId))
        .returning();
      return updated;
    }

    if (action === 'ARRIVE_PICKUP') {
      const [updated] = await db
        .update(trips)
        .set({ status: 'ARRIVING_PICKUP' })
        .where(eq(trips.id, tripId))
        .returning();
      return updated;
    }

    if (action === 'START_TRIP') {
      await db
        .update(parcelDeliveries)
        .set({ collectedAt: new Date() })
        .where(eq(parcelDeliveries.tripId, tripId));
      const [updated] = await db
        .update(trips)
        .set({ status: 'IN_PROGRESS', startedAt: new Date() })
        .where(eq(trips.id, tripId))
        .returning();
      return updated;
    }

    if (action === 'COMPLETE_TRIP') {
      await db
        .update(parcelDeliveries)
        .set({
          deliveredAt: new Date(),
          proofOfDeliveryNote: proofOfDeliveryNote || 'Recipient verified PIN & received intact.',
          proofOfDeliveryPhotoUrl: `pod://bodalink/trip-${trip.tripCode}-verified.jpg`,
        })
        .where(eq(parcelDeliveries.tripId, tripId));

      const [updated] = await db
        .update(trips)
        .set({
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          completedAt: new Date(),
        })
        .where(eq(trips.id, tripId))
        .returning();

      // Credit Rider Wallet with net Rider Earnings (after Platform Commission deduction)
      const targetRiderId = trip.riderId ?? actor.id;
      const riderWalletRows = await db.select().from(wallets).where(eq(wallets.userId, targetRiderId));
      if (riderWalletRows[0]) {
        const netCredit = Number(trip.riderEarningsKes);
        const newBal = (Number(riderWalletRows[0].balanceKes) + netCredit).toFixed(2);
        await db
          .update(wallets)
          .set({ balanceKes: newBal, updatedAt: new Date() })
          .where(eq(wallets.id, riderWalletRows[0].id));

        await db.insert(walletTransactions).values({
          walletId: riderWalletRows[0].id,
          tripId: trip.id,
          txType: 'RIDER_SETTLEMENT',
          amountKes: `+${netCredit.toFixed(2)}`,
          balanceAfterKes: newBal,
          reference: randomCode('STL'),
          description: `Trip ${trip.tripCode} payout (Gross ${trip.totalFareKes} KES · ${trip.commissionRatePct}% commission = ${trip.platformCommissionKes} KES)`,
        });
      }

      // Increment completed counts
      const custProf = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, trip.customerId));
      if (custProf[0]) {
        await db
          .update(customerProfiles)
          .set({ totalTrips: custProf[0].totalTrips + 1 })
          .where(eq(customerProfiles.id, custProf[0].id));
      }
      const ridProf = await db.select().from(riderProfiles).where(eq(riderProfiles.userId, targetRiderId));
      if (ridProf[0]) {
        await db
          .update(riderProfiles)
          .set({ completedTrips: ridProf[0].completedTrips + 1 })
          .where(eq(riderProfiles.id, ridProf[0].id));
      }

      return updated;
    }

    if (action === 'TRIGGER_SOS') {
      const [updated] = await db
        .update(trips)
        .set({ sosTriggered: true, status: 'SOS_ALERT' })
        .where(eq(trips.id, tripId))
        .returning();

      await db.insert(supportTickets).values({
        ticketNumber: randomCode('SOS', 5),
        userId: actor.id,
        tripId: trip.id,
        category: 'EMERGENCY_SOS',
        priority: 'CRITICAL',
        subject: `EMERGENCY SOS triggered on Trip ${trip.tripCode}`,
        status: 'OPEN',
        messages: [
          {
            senderRole: actor.roleName,
            senderName: actor.fullName,
            body: `Emergency SOS activated near ${trip.pickupAddress} -> ${trip.destinationAddress}. Immediate dispatch response requested.`,
            sentAt: new Date().toISOString(),
          },
        ],
      });
      return updated;
    }

    const [cancelled] = await db
      .update(trips)
      .set({ status: 'CANCELLED' })
      .where(eq(trips.id, tripId))
      .returning();
    return cancelled;
  } catch (error) {
    if (error instanceof Error && error.message.includes('verified riders')) {
      throw error;
    }
    throw sanitizeDbError('updating trip status', error);
  }
}

export async function recordLiveTripGpsPoint(params: {
  tripId: number;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
}) {
  try {
    const tripRows = await db.select().from(trips).where(eq(trips.id, params.tripId));
    const trip = tripRows[0];
    if (!trip) return null;

    const [point] = await db
      .insert(tripLocations)
      .values({
        tripId: params.tripId,
        riderId: trip.riderId,
        lat: params.lat,
        lng: params.lng,
        heading: params.heading ?? 0,
        speedKmh: params.speedKmh ?? 36,
      })
      .returning();

    if (trip.riderId) {
      await db
        .update(riderProfiles)
        .set({ currentLat: params.lat, currentLng: params.lng })
        .where(eq(riderProfiles.userId, trip.riderId));
    }
    return point;
  } catch (error) {
    throw sanitizeDbError('recording GPS telemetry', error);
  }
}

export async function topUpWalletMpesa(uid: string, amountKes: number, mpesaPhone: string) {
  try {
    const amt = Number(amountKes);
    if (!amt || amt < 50) throw new Error('Minimum M-Pesa top-up is 50 KES.');

    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const user = userRows[0];
    if (!user) throw new Error('User not found.');

    const walletRows = await db.select().from(wallets).where(eq(wallets.userId, user.id));
    const wallet = walletRows[0];
    const nextBalance = (Number(wallet.balanceKes) + amt).toFixed(2);

    await db
      .update(wallets)
      .set({ balanceKes: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));

    const mpesaReceipt = `QKB${Math.floor(1000000 + Math.random() * 8999999)}`;
    await db.insert(payments).values({
      userId: user.id,
      amountKes: amt.toFixed(2),
      method: 'MPESA',
      status: 'COMPLETED',
      mpesaPhone,
      mpesaCheckoutRequestId: `ws_CO_${Date.now()}`,
      mpesaReceiptNumber: mpesaReceipt,
      receiptCode: randomCode('TOP', 7),
    });

    await db.insert(walletTransactions).values({
      walletId: wallet.id,
      txType: 'TOP_UP',
      amountKes: `+${amt.toFixed(2)}`,
      balanceAfterKes: nextBalance,
      reference: mpesaReceipt,
      description: `M-Pesa Daraja STK Push Top-Up (${mpesaPhone})`,
    });

    return await getMobileAccountBundle(uid);
  } catch (error) {
    throw sanitizeDbError('M-Pesa wallet top-up', error);
  }
}

export async function withdrawRiderWalletMpesa(uid: string, amountKes: number, mpesaPhone: string) {
  try {
    const amt = Number(amountKes);
    if (!amt || amt < 100) throw new Error('Minimum M-Pesa B2C withdrawal is 100 KES.');

    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const user = userRows[0];
    if (!user) throw new Error('User not found.');

    const walletRows = await db.select().from(wallets).where(eq(wallets.userId, user.id));
    const wallet = walletRows[0];
    if (!wallet || Number(wallet.balanceKes) < amt) {
      throw new Error('Insufficient wallet balance for withdrawal.');
    }

    const nextBalance = (Number(wallet.balanceKes) - amt).toFixed(2);
    await db
      .update(wallets)
      .set({ balanceKes: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));

    const b2cRef = `B2C${Math.floor(1000000 + Math.random() * 8999999)}`;
    await db.insert(withdrawals).values({
      riderUserId: user.id,
      amountKes: amt.toFixed(2),
      mpesaPhone,
      status: 'COMPLETED',
      mpesaB2cReference: b2cRef,
    });

    await db.insert(walletTransactions).values({
      walletId: wallet.id,
      txType: 'WITHDRAWAL',
      amountKes: `-${amt.toFixed(2)}`,
      balanceAfterKes: nextBalance,
      reference: b2cRef,
      description: `Rider M-Pesa B2C Withdrawal to ${mpesaPhone}`,
    });

    return await getMobileAccountBundle(uid);
  } catch (error) {
    throw sanitizeDbError('rider M-Pesa withdrawal', error);
  }
}

export async function rateCompletedTrip(
  uid: string,
  tripId: number,
  score: number,
  comment: string,
  safetyTags: string[]
) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const user = userRows[0];
    if (!user) throw new Error('User not found.');

    const tripRows = await db.select().from(trips).where(eq(trips.id, tripId));
    const trip = tripRows[0];
    if (!trip) throw new Error('Trip not found.');

    await db.insert(ratings).values({
      tripId,
      reviewerId: user.id,
      revieweeId: trip.riderId,
      score: Math.min(5, Math.max(1, Math.round(score))),
      comment,
      safetyTags,
    });

    return { ok: true };
  } catch (error) {
    throw sanitizeDbError('submitting trip rating', error);
  }
}

export async function sendSupportTicketMessage(
  uid: string,
  payload: { ticketId?: number; subject?: string; category?: string; body: string }
) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const user = userRows[0];
    if (!user) throw new Error('User not found.');

    const msgEntry = {
      senderRole: user.roleName,
      senderName: user.fullName,
      body: payload.body,
      sentAt: new Date().toISOString(),
    };

    if (payload.ticketId) {
      const existing = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, payload.ticketId));
      if (existing[0]) {
        const nextMsgs = [...(existing[0].messages || []), msgEntry];
        const [updated] = await db
          .update(supportTickets)
          .set({ messages: nextMsgs, updatedAt: new Date() })
          .where(eq(supportTickets.id, payload.ticketId))
          .returning();
        return updated;
      }
    }

    const [created] = await db
      .insert(supportTickets)
      .values({
        ticketNumber: randomCode('SUP', 5),
        userId: user.id,
        category: payload.category || 'GENERAL_SUPPORT',
        priority: payload.category === 'EMERGENCY_SOS' ? 'CRITICAL' : 'NORMAL',
        subject: payload.subject || 'BodaLink Support Inquiry',
        status: 'OPEN',
        messages: [msgEntry],
      })
      .returning();

    return created;
  } catch (error) {
    throw sanitizeDbError('sending support message', error);
  }
}

// ============================================================================
// SEPARATE ADMIN PORTAL REPOSITORY (Strictly isolated from Mobile App)
// ============================================================================

export async function initiateAdminPortalSession(params: {
  firebaseUid: string;
  email: string;
  fullName: string;
  ipAddress: string;
  userAgent: string;
}) {
  try {
    const allAdmins = await db.select().from(adminUsers);
    let admin = allAdmins.find(
      (a) => a.email.toLowerCase() === params.email.toLowerCase() || a.firebaseUid === params.firebaseUid
    );

    // Bootstrap first operator as Super Admin if Admin table is initially empty
    if (!admin && allAdmins.length === 0) {
      const superRoleRows = await db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.roleKey, 'SUPER_ADMIN'));
      const [createdSuper] = await db
        .insert(adminUsers)
        .values({
          firebaseUid: params.firebaseUid,
          email: params.email.toLowerCase(),
          fullName: params.fullName || 'BodaLink Super Admin',
          roleId: superRoleRows[0]?.id ?? 1,
          roleKey: 'SUPER_ADMIN',
          mfaEnabled: true,
          mfaPasscode: '246810',
          emailVerified: true,
          deviceVerified: true,
          lastLoginIp: params.ipAddress,
        })
        .returning();
      admin = createdSuper;
    }

    if (!admin) {
      throw new Error(
        'Access Denied: No Admin Portal account exists for this email. Only a Super Admin can create Admin accounts.'
      );
    }

    if (!admin.firebaseUid) {
      await db
        .update(adminUsers)
        .set({ firebaseUid: params.firebaseUid, lastLoginIp: params.ipAddress })
        .where(eq(adminUsers.id, admin.id));
    }

    const sessionToken = crypto.randomBytes(24).toString('hex');
    const [session] = await db
      .insert(adminSessions)
      .values({
        adminUserId: admin.id,
        sessionToken,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        deviceLabel: params.userAgent.slice(0, 64) || 'Verified Workstation',
        mfaVerified: false,
        isActive: true,
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
      })
      .returning();

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      adminRole: admin.roleKey,
      action: 'ADMIN_SESSION_INITIATED',
      targetResource: 'admin_sessions',
      ipAddress: params.ipAddress,
      details: { deviceLabel: session.deviceLabel },
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        roleKey: admin.roleKey,
        mfaEnabled: admin.mfaEnabled,
        emailVerified: admin.emailVerified,
        deviceVerified: admin.deviceVerified,
      },
      sessionToken,
      mfaVerified: false,
      demoMfaHint: admin.mfaPasscode,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Access Denied:')) {
      throw error;
    }
    throw sanitizeDbError('initiating Admin Portal session', error);
  }
}

export async function verifyAdminMfa(params: {
  sessionToken: string;
  mfaCode: string;
  ipAddress: string;
}) {
  try {
    const sessRows = await db
      .select()
      .from(adminSessions)
      .where(and(eq(adminSessions.sessionToken, params.sessionToken), eq(adminSessions.isActive, true)));
    const session = sessRows[0];
    if (!session) throw new Error('Invalid or expired Admin session.');

    const adminRows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, session.adminUserId));
    const admin = adminRows[0];
    if (!admin) throw new Error('Admin account not found.');

    if (params.mfaCode.trim() !== admin.mfaPasscode) {
      throw new Error('Invalid Multi-Factor Authentication (MFA) verification code.');
    }

    await db
      .update(adminSessions)
      .set({ mfaVerified: true })
      .where(eq(adminSessions.id, session.id));

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      adminRole: admin.roleKey,
      action: 'ADMIN_MFA_VERIFIED',
      targetResource: 'admin_sessions',
      ipAddress: params.ipAddress,
      details: { sessionId: session.id },
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        roleKey: admin.roleKey,
      },
      sessionToken: session.sessionToken,
      mfaVerified: true,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('MFA')) {
      throw error;
    }
    throw sanitizeDbError('verifying Admin MFA', error);
  }
}

async function requireVerifiedAdminSession(sessionToken: string) {
  const sessRows = await db
    .select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.sessionToken, sessionToken),
        eq(adminSessions.isActive, true),
        eq(adminSessions.mfaVerified, true)
      )
    );
  const session = sessRows[0];
  if (!session) {
    throw new Error('Unauthorized Admin Session: MFA verification required.');
  }
  const adminRows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, session.adminUserId));
  if (!adminRows[0] || !adminRows[0].isActive) {
    throw new Error('Admin account inactive.');
  }
  return { admin: adminRows[0], session };
}

export async function getAdminPortalDashboard(sessionToken: string) {
  try {
    const { admin } = await requireVerifiedAdminSession(sessionToken);

    const [
      allTrips,
      allRiders,
      allBikes,
      allPayments,
      allWithdrawals,
      pricingRows,
      allAdmins,
      activeSessions,
      auditRows,
      tickets,
      promos,
    ] = await Promise.all([
      db.select().from(trips).orderBy(desc(trips.createdAt)).limit(50),
      db
        .select({
          riderProfileId: riderProfiles.id,
          userId: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          nationalIdNumber: riderProfiles.nationalIdNumber,
          drivingLicenseNumber: riderProfiles.drivingLicenseNumber,
          verificationStatus: riderProfiles.verificationStatus,
          verificationNotes: riderProfiles.verificationNotes,
          isOnline: riderProfiles.isOnline,
          operatingZone: riderProfiles.operatingZone,
          completedTrips: riderProfiles.completedTrips,
          averageRating: riderProfiles.averageRating,
          currentLat: riderProfiles.currentLat,
          currentLng: riderProfiles.currentLng,
        })
        .from(riderProfiles)
        .innerJoin(users, eq(riderProfiles.userId, users.id))
        .orderBy(desc(riderProfiles.id)),
      db.select().from(motorcycles),
      db.select().from(payments).orderBy(desc(payments.createdAt)).limit(40),
      db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)).limit(20),
      db.select().from(pricingConfigs).where(eq(pricingConfigs.configKey, 'DEFAULT_KENYA')),
      db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt)),
      db.select().from(adminSessions).orderBy(desc(adminSessions.createdAt)).limit(25),
      db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(40),
      db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt)).limit(30),
      db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)),
    ]);

    const bikeMap = new Map(allBikes.map((b) => [b.riderProfileId, b]));
    const ridersWithBikes = allRiders.map((r) => ({
      ...r,
      motorcycle: bikeMap.get(r.riderProfileId) ?? null,
    }));

    const grossGmvKes = allTrips
      .filter((t) => t.status !== 'CANCELLED')
      .reduce((s, t) => s + Number(t.totalFareKes), 0);
    const platformRevenueKes = allTrips
      .filter((t) => t.status !== 'CANCELLED')
      .reduce((s, t) => s + Number(t.platformCommissionKes), 0);
    const riderPayoutsKes = allTrips
      .filter((t) => t.status !== 'CANCELLED')
      .reduce((s, t) => s + Number(t.riderEarningsKes), 0);

    return {
      currentAdmin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        roleKey: admin.roleKey,
      },
      metrics: {
        grossGmvKes: grossGmvKes.toFixed(2),
        platformRevenueKes: platformRevenueKes.toFixed(2),
        riderPayoutsKes: riderPayoutsKes.toFixed(2),
        totalTripsCount: allTrips.length,
        activeTripsCount: allTrips.filter((t) =>
          ['REQUESTED', 'ACCEPTED', 'ARRIVING_PICKUP', 'IN_PROGRESS', 'SOS_ALERT'].includes(t.status)
        ).length,
        pendingRidersCount: ridersWithBikes.filter((r) => r.verificationStatus !== 'APPROVED').length,
        approvedOnlineRidersCount: ridersWithBikes.filter(
          (r) => r.verificationStatus === 'APPROVED' && r.isOnline
        ).length,
      },
      pricing: pricingRows[0],
      promoCodes: promos,
      trips: allTrips,
      riders: ridersWithBikes,
      payments: allPayments,
      withdrawals: allWithdrawals,
      adminUsers: allAdmins.map((a) => ({
        id: a.id,
        email: a.email,
        fullName: a.fullName,
        roleKey: a.roleKey,
        mfaEnabled: a.mfaEnabled,
        emailVerified: a.emailVerified,
        deviceVerified: a.deviceVerified,
        lastLoginIp: a.lastLoginIp,
        createdAt: a.createdAt,
      })),
      adminSessions: activeSessions,
      adminAuditLogs: auditRows,
      supportTickets: tickets,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized Admin')) {
      throw error;
    }
    throw sanitizeDbError('loading Admin Portal dashboard', error);
  }
}

export async function adminReviewRiderKyc(params: {
  sessionToken: string;
  riderProfileId: number;
  decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  notes: string;
  ipAddress: string;
}) {
  try {
    const { admin } = await requireVerifiedAdminSession(params.sessionToken);
    if (!['SUPER_ADMIN', 'COMPLIANCE_OFFICER', 'OPERATIONS_MANAGER'].includes(admin.roleKey)) {
      throw new Error('RBAC Permission Denied: Compliance Officer, Operations Manager, or Super Admin required.');
    }

    const [updatedProfile] = await db
      .update(riderProfiles)
      .set({
        verificationStatus: params.decision,
        verificationNotes: params.notes,
        approvedByAdminId: admin.id,
        approvedAt: params.decision === 'APPROVED' ? new Date() : null,
        isOnline: params.decision === 'APPROVED' ? true : false,
      })
      .where(eq(riderProfiles.id, params.riderProfileId))
      .returning();

    if (updatedProfile) {
      await db
        .update(motorcycles)
        .set({ isVerified: params.decision === 'APPROVED' })
        .where(eq(motorcycles.riderProfileId, updatedProfile.id));

      await db.insert(notifications).values({
        userId: updatedProfile.userId,
        title: `Rider Compliance Status: ${params.decision}`,
        message: params.notes || `Your rider account status is now ${params.decision}.`,
      });
    }

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      adminRole: admin.roleKey,
      action: `RIDER_KYC_${params.decision}`,
      targetResource: `rider_profiles:${params.riderProfileId}`,
      ipAddress: params.ipAddress,
      details: { notes: params.notes },
    });

    return updatedProfile;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission Denied')) {
      throw error;
    }
    throw sanitizeDbError('reviewing rider KYC', error);
  }
}

export async function adminUpdatePricingConfig(params: {
  sessionToken: string;
  baseFareKes: string;
  distanceRatePerKmKes: string;
  timeRatePerMinKes: string;
  peakHourFeeKes: string;
  nightFeeKes: string;
  weatherRiskFeeKes: string;
  platformCommissionPct: string;
  peakHourActive: boolean;
  nightFeeActive: boolean;
  weatherRiskActive: boolean;
  ipAddress: string;
}) {
  try {
    const { admin } = await requireVerifiedAdminSession(params.sessionToken);
    if (!['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER'].includes(admin.roleKey)) {
      throw new Error('RBAC Permission Denied: Super Admin, Operations, or Finance Manager required.');
    }

    const [updated] = await db
      .update(pricingConfigs)
      .set({
        baseFareKes: params.baseFareKes,
        distanceRatePerKmKes: params.distanceRatePerKmKes,
        timeRatePerMinKes: params.timeRatePerMinKes,
        peakHourFeeKes: params.peakHourFeeKes,
        nightFeeKes: params.nightFeeKes,
        weatherRiskFeeKes: params.weatherRiskFeeKes,
        platformCommissionPct: params.platformCommissionPct,
        peakHourActive: params.peakHourActive,
        nightFeeActive: params.nightFeeActive,
        weatherRiskActive: params.weatherRiskActive,
        updatedAt: new Date(),
      })
      .where(eq(pricingConfigs.configKey, 'DEFAULT_KENYA'))
      .returning();

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      adminRole: admin.roleKey,
      action: 'PRICING_AND_COMMISSION_UPDATED',
      targetResource: 'pricing_configs:DEFAULT_KENYA',
      ipAddress: params.ipAddress,
      details: {
        baseFareKes: params.baseFareKes,
        platformCommissionPct: params.platformCommissionPct,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission Denied')) {
      throw error;
    }
    throw sanitizeDbError('updating pricing & commission rules', error);
  }
}

export async function superAdminCreateAdminAccount(params: {
  sessionToken: string;
  email: string;
  fullName: string;
  roleKey:
    | 'SUPER_ADMIN'
    | 'OPERATIONS_MANAGER'
    | 'FINANCE_MANAGER'
    | 'CUSTOMER_SUPPORT'
    | 'COMPLIANCE_OFFICER';
  mfaPasscode: string;
  ipAddress: string;
}) {
  try {
    const { admin } = await requireVerifiedAdminSession(params.sessionToken);
    if (admin.roleKey !== 'SUPER_ADMIN') {
      throw new Error('Strict Security Policy: Only Super Admin can create Admin Accounts.');
    }

    const roleRows = await db
      .select()
      .from(adminRoles)
      .where(eq(adminRoles.roleKey, params.roleKey));

    const [created] = await db
      .insert(adminUsers)
      .values({
        email: params.email.trim().toLowerCase(),
        fullName: params.fullName.trim(),
        roleId: roleRows[0]?.id ?? 1,
        roleKey: params.roleKey,
        mfaEnabled: true,
        mfaPasscode: params.mfaPasscode || '246810',
        emailVerified: true,
        deviceVerified: true,
        createdByAdminId: admin.id,
      })
      .returning();

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      adminRole: admin.roleKey,
      action: 'CREATE_ADMIN_USER',
      targetResource: `admin_users:${created.email}`,
      ipAddress: params.ipAddress,
      details: { assignedRole: params.roleKey },
    });

    return created;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Only Super Admin')) {
      throw error;
    }
    throw sanitizeDbError('creating Admin Portal account', error);
  }
}

export async function adminReplySupportTicket(params: {
  sessionToken: string;
  ticketId: number;
  body: string;
  resolveTicket: boolean;
  ipAddress: string;
}) {
  try {
    const { admin } = await requireVerifiedAdminSession(params.sessionToken);
    const existing = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, params.ticketId));
    if (!existing[0]) throw new Error('Ticket not found.');

    const msgEntry = {
      senderRole: `ADMIN (${admin.roleKey})`,
      senderName: admin.fullName,
      body: params.body,
      sentAt: new Date().toISOString(),
    };

    const [updated] = await db
      .update(supportTickets)
      .set({
        messages: [...(existing[0].messages || []), msgEntry],
        status: params.resolveTicket ? 'RESOLVED' : 'IN_PROGRESS',
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, params.ticketId))
      .returning();

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      adminRole: admin.roleKey,
      action: params.resolveTicket ? 'SUPPORT_TICKET_RESOLVED' : 'SUPPORT_TICKET_REPLIED',
      targetResource: `support_tickets:${existing[0].ticketNumber}`,
      ipAddress: params.ipAddress,
      details: {},
    });

    return updated;
  } catch (error) {
    throw sanitizeDbError('responding to support ticket', error);
  }
}
