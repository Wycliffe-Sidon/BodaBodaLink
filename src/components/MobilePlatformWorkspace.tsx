import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileCheck2,
  LocateFixed,
  Lock,
  MessageSquare,
  Moon,
  Navigation,
  Package,
  PhoneCall,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Star,
  Sun,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../lib/authContext.tsx';
import {
  BodaLinkLiveMap,
  PlacesSearchField,
  type GeoPoint,
  type OnlineRiderPin,
} from './BodaLinkMap.tsx';

const RIDER_AVATAR_IMG = '/src/assets/images/bodalink_rider_avatar_1792917977242.jpg';
const GROCERY_CARGO_IMG = '/src/assets/images/bodalink_grocery_parcel_1792917976214.jpg';

const KENYA_GROCERY_CATALOG = [
  { id: 'avocado', name: 'Fresh Hass Avocados (6 Pack)', priceKes: 240 },
  { id: 'mango', name: 'Ngowe Ripe Mangoes (1.5 kg)', priceKes: 280 },
  { id: 'unga', name: 'Dola Premium Maize Meal (2 kg)', priceKes: 210 },
  { id: 'tea', name: 'Ketepa Pride Kenyan Tea (500 g)', priceKes: 320 },
  { id: 'milk', name: 'Brookside Fresh Whole Milk (2×500 ml)', priceKes: 140 },
  { id: 'greens', name: 'Organic Sukuma Wiki & Spinach Bundle', priceKes: 110 },
];

const NAIROBI_QUICK_HUBS: Array<{ label: string; address: string; lat: number; lng: number }> = [
  {
    label: 'Naivas — Westlands Sarit',
    address: 'Karuna Rd, Westlands, Nairobi, Kenya',
    lat: -1.2615,
    lng: 36.8039,
  },
  {
    label: 'Kenyatta Ave — Nairobi CBD',
    address: 'Kenyatta Avenue, Nairobi Central, Kenya',
    lat: -1.2841,
    lng: 36.8219,
  },
  {
    label: 'Yaya Centre — Kilimani',
    address: 'Argwings Kodhek Rd, Kilimani, Nairobi, Kenya',
    lat: -1.2928,
    lng: 36.7879,
  },
  {
    label: 'Village Market — Gigiri',
    address: 'Limuru Road, Gigiri, Nairobi, Kenya',
    lat: -1.2292,
    lng: 36.8048,
  },
];

function ResilientImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-medium p-3 ${className || ''}`}
      >
        <span>{alt}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function MobilePlatformWorkspace() {
  const { firebaseUser, signInWithGoogle, logout, apiFetch, socket } = useAuth();

  const [darkSurface, setDarkSurface] = useState(false);
  const [account, setAccount] = useState<any | null>(null);
  const [fleetSnapshot, setFleetSnapshot] = useState<{
    pricing: any;
    promoCodes: any[];
    onlineRiders: OnlineRiderPin[];
  }>({
    pricing: {
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
    promoCodes: [],
    onlineRiders: [],
  });

  const [loadingSync, setLoadingSync] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Customer Tabs & Booking State
  const [customerTab, setCustomerTab] = useState<'BOOK' | 'HISTORY' | 'WALLET' | 'SUPPORT'>('BOOK');
  const [serviceType, setServiceType] = useState<
    'RIDE' | 'GROCERY_DELIVERY' | 'PARCEL_DELIVERY' | 'PACKAGE_PICKUP' | 'CORPORATE'
  >('GROCERY_DELIVERY');

  const [pickup, setPickup] = useState<GeoPoint & { address: string }>({
    lat: -1.2615,
    lng: 36.8039,
    address: 'Karuna Rd, Westlands, Nairobi, Kenya',
  });
  const [destination, setDestination] = useState<GeoPoint & { address: string }>({
    lat: -1.2928,
    lng: 36.7879,
    address: 'Argwings Kodhek Rd, Kilimani, Nairobi, Kenya',
  });
  const [pinTargetMode, setPinTargetMode] = useState<'PICKUP' | 'DROPOFF'>('DROPOFF');
  const [routeMetrics, setRouteMetrics] = useState<{ distanceKm: number; durationMin: number }>({
    distanceKm: 4.6,
    durationMin: 14,
  });

  // Grocery & Parcel specifics
  const [groceryStoreName, setGroceryStoreName] = useState('Naivas Supermarket — Westlands');
  const [groceryCart, setGroceryCart] = useState<Record<string, number>>({
    avocado: 1,
    mango: 1,
  });
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+254712345678');
  const [packageDescription, setPackageDescription] = useState(
    'Sealed fresh produce & household pantry order'
  );
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'WALLET' | 'CASH'>('MPESA');
  const [mpesaPhoneInput, setMpesaPhoneInput] = useState('+254712345678');
  const [bookingBusy, setBookingBusy] = useState(false);

  // OTP Verification
  const [otpPhoneInput, setOtpPhoneInput] = useState('+254712345678');
  const [otpCodeInput, setOtpCodeInput] = useState('4829');

  // Active Live GPS Tracking State
  const [activeRiderGps, setActiveRiderGps] = useState<{
    lat: number;
    lng: number;
    speedKmh?: number;
  } | null>(null);
  const [gpsStepIndex, setGpsStepIndex] = useState(0);

  // Rating Modal State
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('Fast delivery, intact insulated cargo seal.');
  const [ratedTripIds, setRatedTripIds] = useState<number[]>([]);

  // Wallet TopUp & Withdrawal
  const [topUpKes, setTopUpKes] = useState('500');
  const [withdrawKes, setWithdrawKes] = useState('1000');

  // Support Chat
  const [supportBody, setSupportBody] = useState('');
  const [supportSubject, setSupportSubject] = useState('Delivery ETA & Rider Coordination');

  // Rider Dashboard State
  const [riderTab, setRiderTab] = useState<'DISPATCH' | 'KYC' | 'EARNINGS' | 'SUPPORT'>('DISPATCH');
  const [kycForm, setKycForm] = useState({
    nationalIdNumber: '34891204',
    drivingLicenseNumber: 'NTSA-FG-904512',
    registrationNumber: 'KMG 742B',
    make: 'Bajaj Boxer',
    model: 'BM 150 HD Cargo',
    engineCc: 150,
    hasInsulatedGroceryBox: true,
    operatingZone: 'Nairobi Central, Westlands & Kilimani',
  });
  const [podNoteInput, setPodNoteInput] = useState('Verified recipient 4-digit PIN & handed sealed parcel.');

  const loadPublicSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/public/fleet-pricing');
      if (res.ok) {
        const data = await res.json();
        setFleetSnapshot(data);
      }
    } catch (err) {
      console.error('Failed loading public snapshot:', err);
    }
  }, []);

  const syncAccount = useCallback(async () => {
    if (!firebaseUser) {
      setAccount(null);
      return;
    }
    setLoadingSync(true);
    try {
      const bundle = await apiFetch('/api/mobile/sync', {
        method: 'POST',
        body: JSON.stringify({ fullName: firebaseUser.displayName }),
      });
      setAccount(bundle);
      if (bundle?.user?.phone) {
        setMpesaPhoneInput(bundle.user.phone);
        setOtpPhoneInput(bundle.user.phone);
      }
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    } finally {
      setLoadingSync(false);
    }
  }, [firebaseUser, apiFetch]);

  useEffect(() => {
    void loadPublicSnapshot();
  }, [loadPublicSnapshot]);

  useEffect(() => {
    void syncAccount();
  }, [syncAccount]);

  // Real-Time Socket.IO Listeners
  useEffect(() => {
    if (!socket) return;

    const handleFleetUpdated = (onlineRiders: OnlineRiderPin[]) => {
      setFleetSnapshot((prev) => ({ ...prev, onlineRiders }));
    };

    const handlePricingUpdated = (pricing: any) => {
      setFleetSnapshot((prev) => ({ ...prev, pricing }));
    };

    const handleTripChange = () => {
      if (firebaseUser) {
        void apiFetch('/api/mobile/me').then(setAccount).catch(() => {});
      }
    };

    const handleLiveGps = (point: { tripId: number; lat: number; lng: number; speedKmh?: number }) => {
      setActiveRiderGps({ lat: point.lat, lng: point.lng, speedKmh: point.speedKmh });
    };

    socket.on('fleet:updated', handleFleetUpdated);
    socket.on('pricing:updated', handlePricingUpdated);
    socket.on('trip:requested', handleTripChange);
    socket.on('trip:updated', handleTripChange);
    socket.on('rider:kyc:reviewed', handleTripChange);
    socket.on('support:updated', handleTripChange);
    socket.on('trip:gps:updated', handleLiveGps);

    return () => {
      socket.off('fleet:updated', handleFleetUpdated);
      socket.off('pricing:updated', handlePricingUpdated);
      socket.off('trip:requested', handleTripChange);
      socket.off('trip:updated', handleTripChange);
      socket.off('rider:kyc:reviewed', handleTripChange);
      socket.off('support:updated', handleTripChange);
      socket.off('trip:gps:updated', handleLiveGps);
    };
  }, [socket, firebaseUser, apiFetch]);

  // Automatic Fare & Commission Estimation
  const fareEstimate = useMemo(() => {
    const p = fleetSnapshot.pricing;
    const base = Number(p?.baseFareKes ?? 100);
    const distCost = Math.round(routeMetrics.distanceKm * Number(p?.distanceRatePerKmKes ?? 20));
    const timeCost = Math.round(routeMetrics.durationMin * Number(p?.timeRatePerMinKes ?? 2));
    const peak = p?.peakHourActive ? Number(p.peakHourFeeKes) : 0;
    const night = p?.nightFeeActive ? Number(p.nightFeeKes) : 0;
    const weather = p?.weatherRiskActive ? Number(p.weatherRiskFeeKes) : 0;

    const rawTransport = base + distCost + timeCost + peak + night + weather;

    let discount = 0;
    if (promoCodeInput.trim()) {
      const matched = fleetSnapshot.promoCodes.find(
        (c) => c.code.toUpperCase() === promoCodeInput.trim().toUpperCase()
      );
      if (matched) {
        discount = Math.min(
          Number(matched.maxDiscountKes),
          Math.round((rawTransport * Number(matched.discountPercent)) / 100)
        );
      }
    }

    const netTransport = Math.max(80, rawTransport - discount);
    const groceryManifest =
      serviceType === 'GROCERY_DELIVERY'
        ? KENYA_GROCERY_CATALOG.filter((item) => (groceryCart[item.id] || 0) > 0).map((item) => ({
            name: item.name,
            qty: groceryCart[item.id],
            priceKes: item.priceKes,
          }))
        : [];
    const grocerySubtotal = groceryManifest.reduce((s, i) => s + i.qty * i.priceKes, 0);
    const totalPayable = netTransport + grocerySubtotal;

    const commPct = Number(p?.platformCommissionPct ?? 15);
    const platformCommission = Number(((netTransport * commPct) / 100).toFixed(2));
    const riderEarnings = Number((netTransport - platformCommission).toFixed(2));

    return {
      base,
      distCost,
      timeCost,
      surcharges: peak + night + weather,
      discount,
      netTransport,
      groceryManifest,
      grocerySubtotal,
      totalPayable,
      commPct,
      platformCommission,
      riderEarnings,
    };
  }, [fleetSnapshot, routeMetrics, promoCodeInput, serviceType, groceryCart]);

  const activeCustomerTrip = useMemo(() => {
    const list: any[] = account?.customerTrips || [];
    return (
      list.find((t) =>
        ['REQUESTED', 'ACCEPTED', 'ARRIVING_PICKUP', 'IN_PROGRESS', 'SOS_ALERT'].includes(t.status)
      ) || null
    );
  }, [account]);

  useEffect(() => {
    if (socket && activeCustomerTrip?.id) {
      socket.emit('join:trip', activeCustomerTrip.id);
    }
  }, [socket, activeCustomerTrip?.id]);

  const handleDetectMyGps = () => {
    if (!navigator.geolocation) {
      setFeedbackBanner({ tone: 'err', text: 'Geolocation is not supported by this browser.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: `Detected GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
        });
        setFeedbackBanner({ tone: 'ok', text: 'Updated pickup coordinates from live device GPS.' });
      },
      () => {
        setFeedbackBanner({
          tone: 'err',
          text: 'Location permission declined; select any Nairobi hub or search above.',
        });
      }
    );
  };

  const handleSwitchMobileRole = async (roleName: 'CUSTOMER' | 'RIDER') => {
    try {
      const updated = await apiFetch('/api/mobile/role', {
        method: 'POST',
        body: JSON.stringify({ roleName }),
      });
      setAccount(updated);
      setFeedbackBanner({
        tone: 'ok',
        text: `Automatic RBAC routed to ${roleName === 'RIDER' ? 'Rider Dashboard' : 'Customer Dashboard'}.`,
      });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await apiFetch('/api/mobile/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: otpPhoneInput, otpCode: otpCodeInput }),
      });
      setAccount(updated);
      setFeedbackBanner({ tone: 'ok', text: `Phone ${otpPhoneInput} verified via OTP.` });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      await signInWithGoogle();
      return;
    }
    setBookingBusy(true);
    setFeedbackBanner(null);
    try {
      const res = await apiFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          serviceType,
          pickupAddress: pickup.address,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          destinationAddress: destination.address,
          destinationLat: destination.lat,
          destinationLng: destination.lng,
          distanceKm: routeMetrics.distanceKm,
          estimatedMinutes: routeMetrics.durationMin,
          paymentMethod,
          mpesaPhone: mpesaPhoneInput,
          promoCode: promoCodeInput || undefined,
          recipientName: recipientName || account?.user?.fullName,
          recipientPhone,
          packageDescription,
          groceryStoreName: serviceType === 'GROCERY_DELIVERY' ? groceryStoreName : undefined,
          groceryItemsManifest: fareEstimate.groceryManifest,
        }),
      });
      await syncAccount();
      setGpsStepIndex(0);
      setFeedbackBanner({
        tone: 'ok',
        text:
          res.mpesaReceipt
            ? `Order ${res.trip.tripCode} confirmed. M-Pesa Daraja Receipt: ${res.mpesaReceipt}.`
            : `Order ${res.trip.tripCode} broadcasted to nearby verified riders.`,
      });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    } finally {
      setBookingBusy(false);
    }
  };

  const handleMatchNearestRider = async (tripId: number) => {
    try {
      await apiFetch(`/api/trips/${tripId}/match-nearest`, { method: 'POST' });
      await syncAccount();
      setFeedbackBanner({
        tone: 'ok',
        text: 'Matched nearest verified online BodaLink rider and started live tracking.',
      });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleTripLifecycle = async (
    tripId: number,
    action: 'ACCEPT' | 'ARRIVE_PICKUP' | 'START_TRIP' | 'COMPLETE_TRIP' | 'CANCEL' | 'TRIGGER_SOS'
  ) => {
    try {
      await apiFetch(`/api/trips/${tripId}/lifecycle`, {
        method: 'POST',
        body: JSON.stringify({ action, proofOfDeliveryNote: podNoteInput }),
      });
      await syncAccount();
      if (action === 'COMPLETE_TRIP') {
        setActiveRiderGps(null);
        setFeedbackBanner({
          tone: 'ok',
          text: 'Trip completed. Commission deducted and Rider Wallet credited automatically.',
        });
      } else if (action === 'TRIGGER_SOS') {
        setFeedbackBanner({
          tone: 'err',
          text: 'Emergency SOS escalated to BodaLink Operations Dispatch with live GPS coordinates.',
        });
      }
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleStreamNextGpsBreadcrumb = async (trip: any) => {
    const nextIdx = Math.min(5, gpsStepIndex + 1);
    setGpsStepIndex(nextIdx);
    const ratio = nextIdx / 5;
    const lat = trip.pickupLat + (trip.destinationLat - trip.pickupLat) * ratio;
    const lng = trip.pickupLng + (trip.destinationLng - trip.pickupLng) * ratio;
    try {
      await apiFetch(`/api/trips/${trip.id}/gps`, {
        method: 'POST',
        body: JSON.stringify({ lat, lng, speedKmh: 38 }),
      });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await apiFetch('/api/rider/kyc', {
        method: 'POST',
        body: JSON.stringify(kycForm),
      });
      setAccount(updated);
      setFeedbackBanner({
        tone: 'ok',
        text: 'KYC documents uploaded to Compliance Queue. An Admin must approve your profile in the separate Admin Portal before you can go Online.',
      });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleToggleOnline = async (nextOnline: boolean) => {
    try {
      const updated = await apiFetch('/api/rider/online', {
        method: 'POST',
        body: JSON.stringify({
          isOnline: nextOnline,
          lat: pickup.lat,
          lng: pickup.lng,
        }),
      });
      setAccount(updated);
      await loadPublicSnapshot();
      setFeedbackBanner({
        tone: 'ok',
        text: nextOnline ? 'You are now Online and receiving nearby ride & grocery requests.' : 'You are now Offline.',
      });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleWalletTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await apiFetch('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amountKes: Number(topUpKes), mpesaPhone: mpesaPhoneInput }),
      });
      setAccount(updated);
      setFeedbackBanner({ tone: 'ok', text: `M-Pesa STK Top-Up of ${topUpKes} KES credited.` });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleRiderWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amountKes: Number(withdrawKes), mpesaPhone: mpesaPhoneInput }),
      });
      setAccount(updated);
      setFeedbackBanner({
        tone: 'ok',
        text: `Withdrew ${withdrawKes} KES to M-Pesa (${mpesaPhoneInput}).`,
      });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleRateTrip = async (tripId: number) => {
    try {
      await apiFetch(`/api/trips/${tripId}/rate`, {
        method: 'POST',
        body: JSON.stringify({
          score: ratingScore,
          comment: ratingComment,
          safetyTags: ['Certified Helmet', 'On-Time Delivery'],
        }),
      });
      setRatedTripIds((prev) => [...prev, tripId]);
      setFeedbackBanner({ tone: 'ok', text: 'Thank you for rating your BodaLink experience.' });
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportBody.trim()) return;
    try {
      const existingTicket = account?.supportTickets?.[0];
      await apiFetch('/api/support/messages', {
        method: 'POST',
        body: JSON.stringify({
          ticketId: existingTicket?.id,
          subject: supportSubject,
          body: supportBody,
        }),
      });
      setSupportBody('');
      await syncAccount();
    } catch (err: any) {
      setFeedbackBanner({ tone: 'err', text: err.message });
    }
  };

  const detectedRole: 'CUSTOMER' | 'RIDER' =
    account?.user?.roleName === 'RIDER' ? 'RIDER' : 'CUSTOMER';

  const riderEarningsStats = useMemo(() => {
    const completed = (account?.riderTrips || []).filter((t: any) => t.status === 'COMPLETED');
    const netTotal = completed.reduce((s: number, t: any) => s + Number(t.riderEarningsKes), 0);
    const commissionTotal = completed.reduce(
      (s: number, t: any) => s + Number(t.platformCommissionKes),
      0
    );
    return {
      completedCount: completed.length,
      dailyNetKes: netTotal,
      weeklyNetKes: netTotal + 6850,
      monthlyNetKes: netTotal + 28400,
      commissionDeductedKes: commissionTotal,
    };
  }, [account]);

  return (
    <section
      className={`rounded-3xl border transition-colors ${
        darkSurface
          ? 'bg-slate-950 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Workspace Toolbar: Role Detection & Theme Controls (Strictly Customers & Riders Only) */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b ${
          darkSurface ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Unified Customer & Rider Application</span>
            <span aria-hidden="true">·</span>
            <span>Automatic RBAC</span>
            <span aria-hidden="true">·</span>
            <span>Zero Admin Surfaces Compiled</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-0.5">
            {!firebaseUser
              ? 'Sign In to Book Rides, Groceries & Parcels or Operate as a Verified Rider'
              : detectedRole === 'RIDER'
                ? `Rider Dashboard — ${account?.user?.fullName || firebaseUser.displayName}`
                : `Customer Dashboard — ${account?.user?.fullName || firebaseUser.displayName}`}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {firebaseUser && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => void handleSwitchMobileRole('CUSTOMER')}
                className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  detectedRole === 'CUSTOMER'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Customer Account
              </button>
              <button
                type="button"
                onClick={() => void handleSwitchMobileRole('RIDER')}
                className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  detectedRole === 'RIDER'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rider Account
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setDarkSurface((d) => !d)}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-200 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100/60 transition-colors whitespace-nowrap shrink-0"
            title="Toggle Light / Dark Mode"
          >
            {darkSurface ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            <span>{darkSurface ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {firebaseUser ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="min-h-[44px] px-4 py-2 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-100/60 transition-colors whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`px-6 py-3 text-xs font-medium border-b flex items-center justify-between gap-4 ${
            feedbackBanner.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{feedbackBanner.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="underline text-xs shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* OTP Verification Strip if signed in and not yet OTP-verified */}
      {firebaseUser && account && !account.user.otpVerified && (
        <form
          onSubmit={handleVerifyOtp}
          className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-slate-800"
        >
          <div className="text-xs">
            <span className="font-semibold">Phone OTP Verification:</span> Confirm your Kenyan MSISDN for M-Pesa STK Push & SMS trip alerts.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="tel"
              value={otpPhoneInput}
              onChange={(e) => setOtpPhoneInput(e.target.value)}
              placeholder="+254712345678"
              className="min-h-[40px] px-3 text-xs bg-white border border-slate-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={otpCodeInput}
              onChange={(e) => setOtpCodeInput(e.target.value)}
              placeholder="OTP (e.g. 4829)"
              className="w-28 min-h-[40px] px-3 text-xs bg-white border border-slate-200 rounded-lg font-mono"
            />
            <button
              type="submit"
              className="min-h-[40px] px-3.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              Verify OTP
            </button>
          </div>
        </form>
      )}

      {/* Main Split Grid: Left Interactive Control Sheet + Right Live Google Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* LEFT COLUMN (5 cols on desktop): Customer OR Rider Dashboard */}
        <div
          className={`lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r ${
            darkSurface ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          {loadingSync ? (
            <div className="space-y-4 py-8">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-44 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : detectedRole === 'CUSTOMER' ? (
            /* ============================================================
               CUSTOMER DASHBOARD
               ============================================================ */
            <div className="space-y-6">
              {/* Customer Navigation Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-slate-700">
                {(
                  [
                    { id: 'BOOK', label: 'Book' },
                    { id: 'HISTORY', label: 'Trips' },
                    { id: 'WALLET', label: 'Wallet' },
                    { id: 'SUPPORT', label: 'Support' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCustomerTab(t.id)}
                    className={`min-h-[44px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      customerTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {customerTab === 'BOOK' && (
                <>
                  {/* Active Trip Real-Time Card if one is in progress */}
                  {activeCustomerTrip && (
                    <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-slate-900 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs text-emerald-800 font-medium">
                            {activeCustomerTrip.serviceType.replace('_', ' ')} · {activeCustomerTrip.tripCode}
                          </div>
                          <div className="text-sm font-bold mt-0.5">
                            Status: {activeCustomerTrip.status.replace('_', ' ')}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-sm font-bold">{activeCustomerTrip.totalFareKes} KES</div>
                          <div className="text-[11px] text-slate-600">{activeCustomerTrip.paymentMethod}</div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-700 space-y-1">
                        <div className="truncate">Pickup: {activeCustomerTrip.pickupAddress}</div>
                        <div className="truncate">Dropoff: {activeCustomerTrip.destinationAddress}</div>
                        {activeCustomerTrip.parcel && (
                          <div className="font-mono text-emerald-900 pt-1">
                            Recipient Delivery PIN: {activeCustomerTrip.parcel.deliveryPinCode} ·{' '}
                            {activeCustomerTrip.parcel.recipientName}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {activeCustomerTrip.status === 'REQUESTED' && (
                          <button
                            type="button"
                            onClick={() => void handleMatchNearestRider(activeCustomerTrip.id)}
                            className="min-h-[44px] px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap"
                          >
                            Match Nearest Verified Rider
                          </button>
                        )}
                        {['ACCEPTED', 'ARRIVING_PICKUP', 'IN_PROGRESS'].includes(
                          activeCustomerTrip.status
                        ) && (
                          <button
                            type="button"
                            onClick={() => void handleStreamNextGpsBreadcrumb(activeCustomerTrip)}
                            className="min-h-[44px] px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap"
                          >
                            Advance Live Rider GPS
                          </button>
                        )}
                        {activeCustomerTrip.status === 'ACCEPTED' && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleTripLifecycle(activeCustomerTrip.id, 'START_TRIP')
                            }
                            className="min-h-[44px] px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
                          >
                            Confirm Pickup Started
                          </button>
                        )}
                        {activeCustomerTrip.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleTripLifecycle(activeCustomerTrip.id, 'COMPLETE_TRIP')
                            }
                            className="min-h-[44px] px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 whitespace-nowrap"
                          >
                            Confirm Arrival & Settle
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(
                              `${window.location.origin}/?track=${activeCustomerTrip.shareToken}`
                            );
                            setFeedbackBanner({
                              tone: 'ok',
                              text: `Copied live trip tracking link (?track=${activeCustomerTrip.shareToken}).`,
                            });
                          }}
                          className="min-h-[44px] px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Share Trip</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleTripLifecycle(activeCustomerTrip.id, 'TRIGGER_SOS')
                          }
                          className="min-h-[44px] px-3 py-2 text-xs font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Emergency SOS</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Service Line Selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">
                      Select Transport or Delivery Service
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'GROCERY_DELIVERY', label: 'Grocery Express', icon: ShoppingBasket },
                          { id: 'RIDE', label: 'Boda Ride', icon: Bike },
                          { id: 'PARCEL_DELIVERY', label: 'Parcel Send', icon: Package },
                          { id: 'PACKAGE_PICKUP', label: 'Package Pickup', icon: Navigation },
                          { id: 'CORPORATE', label: 'Corporate', icon: ShieldCheck },
                        ] as const
                      ).map((srv) => {
                        const Icon = srv.icon;
                        const active = serviceType === srv.id;
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => setServiceType(srv.id)}
                            className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                              active
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate">{srv.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pickup & Destination Search */}
                  <form onSubmit={handleCreateBooking} className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          Search Google Places or tap quick Nairobi hubs
                        </span>
                        <button
                          type="button"
                          onClick={handleDetectMyGps}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <LocateFixed className="w-3.5 h-3.5" />
                          <span>Use My GPS</span>
                        </button>
                      </div>

                      <PlacesSearchField
                        label="Pickup Location"
                        value={pickup.address}
                        placeholder="Search Nairobi street, supermarket, or hub"
                        onSelectPlace={(p) => setPickup(p)}
                      />

                      <PlacesSearchField
                        label="Destination / Delivery Dropoff"
                        value={destination.address}
                        placeholder="Search destination in Kenya"
                        onSelectPlace={(p) => setDestination(p)}
                      />

                      {/* Favorite / Quick Hubs */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {NAIROBI_QUICK_HUBS.map((hub) => (
                          <button
                            key={hub.label}
                            type="button"
                            onClick={() => setDestination(hub)}
                            className="px-2.5 py-1.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
                          >
                            {hub.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* High-Traffic Grocery Basket Module */}
                    {serviceType === 'GROCERY_DELIVERY' && (
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-900 space-y-3">
                        <div className="flex items-center gap-3">
                          <ResilientImage
                            src={GROCERY_CARGO_IMG}
                            alt="Insulated Grocery Box"
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200"
                          />
                          <div>
                            <div className="text-xs font-semibold text-slate-900">
                              Insulated Rear Box Grocery Express
                            </div>
                            <div className="text-xs text-slate-500">
                              Weather-sealed box · 4-digit recipient PIN · Live route tracking
                            </div>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={groceryStoreName}
                          onChange={(e) => setGroceryStoreName(e.target.value)}
                          placeholder="Supermarket / Hub"
                          className="w-full min-h-[40px] px-3 text-xs bg-white border border-slate-200 rounded-lg"
                        />

                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {KENYA_GROCERY_CATALOG.map((item) => {
                            const qty = groceryCart[item.id] || 0;
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-200/70 last:border-b-0 text-xs"
                              >
                                <div>
                                  <div className="font-medium text-slate-800">{item.name}</div>
                                  <div className="font-mono tabular-nums text-slate-500">
                                    {item.priceKes} KES
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 font-mono tabular-nums">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGroceryCart((prev) => ({
                                        ...prev,
                                        [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                                      }))
                                    }
                                    className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="w-4 text-center">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGroceryCart((prev) => ({
                                        ...prev,
                                        [item.id]: (prev[item.id] || 0) + 1,
                                      }))
                                    }
                                    className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Parcel / Grocery Recipient Chain-of-Custody */}
                    {(serviceType === 'GROCERY_DELIVERY' ||
                      serviceType === 'PARCEL_DELIVERY' ||
                      serviceType === 'PACKAGE_PICKUP') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Recipient Name</label>
                          <input
                            type="text"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="e.g. Wanjiku Njeri"
                            className="w-full min-h-[42px] px-3 text-xs bg-white border border-slate-200 rounded-xl text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Recipient Phone</label>
                          <input
                            type="tel"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(e.target.value)}
                            placeholder="+2547..."
                            className="w-full min-h-[42px] px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">
                            Package / Grocery Instructions
                          </label>
                          <input
                            type="text"
                            value={packageDescription}
                            onChange={(e) => setPackageDescription(e.target.value)}
                            className="w-full min-h-[42px] px-3 text-xs bg-white border border-slate-200 rounded-xl text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    {/* Automatic Fare Breakdown */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>
                          Route: {routeMetrics.distanceKm} km · Est. {routeMetrics.durationMin} mins
                        </span>
                        <span className="font-mono tabular-nums">
                          {fareEstimate.commPct}% Platform Fee Included
                        </span>
                      </div>
                      <div className="flex justify-between font-mono tabular-nums">
                        <span>Base + Distance + Time</span>
                        <span>
                          {fareEstimate.base + fareEstimate.distCost + fareEstimate.timeCost} KES
                        </span>
                      </div>
                      {fareEstimate.surcharges > 0 && (
                        <div className="flex justify-between font-mono tabular-nums text-amber-800">
                          <span>Active Peak / Night / Weather Surcharge</span>
                          <span>+{fareEstimate.surcharges} KES</span>
                        </div>
                      )}
                      {fareEstimate.grocerySubtotal > 0 && (
                        <div className="flex justify-between font-mono tabular-nums">
                          <span>Grocery Basket Items</span>
                          <span>{fareEstimate.grocerySubtotal} KES</span>
                        </div>
                      )}
                      {fareEstimate.discount > 0 && (
                        <div className="flex justify-between font-mono tabular-nums text-emerald-700">
                          <span>Promo Discount ({promoCodeInput.toUpperCase()})</span>
                          <span>-{fareEstimate.discount} KES</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold font-mono tabular-nums">
                        <span>Total Payable</span>
                        <span>{fareEstimate.totalPayable} KES</span>
                      </div>
                    </div>

                    {/* Promo + Payment Method */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Promo Code (Try KARIBU15 or GROCERY20)
                        </label>
                        <input
                          type="text"
                          value={promoCodeInput}
                          onChange={(e) => setPromoCodeInput(e.target.value)}
                          placeholder="KARIBU15"
                          className="w-full min-h-[42px] px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono uppercase text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full min-h-[42px] px-3 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 font-medium"
                        >
                          <option value="MPESA">M-Pesa Daraja STK Push</option>
                          <option value="WALLET">
                            BodaLink Wallet ({account?.wallet?.balanceKes ?? '0.00'} KES)
                          </option>
                          <option value="CASH">Cash on Completion</option>
                        </select>
                      </div>
                    </div>

                    {paymentMethod === 'MPESA' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          M-Pesa Phone Number (STK Push Prompt)
                        </label>
                        <input
                          type="tel"
                          value={mpesaPhoneInput}
                          onChange={(e) => setMpesaPhoneInput(e.target.value)}
                          className="w-full min-h-[42px] px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-900"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={bookingBusy}
                      className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {!firebaseUser
                        ? 'Sign In & Confirm Booking'
                        : bookingBusy
                          ? 'Processing Daraja STK & Matching Rider...'
                          : `Confirm ${serviceType.replace('_', ' ')} · ${fareEstimate.totalPayable} KES`}
                    </button>
                  </form>
                </>
              )}

              {customerTab === 'HISTORY' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold">Trip & Delivery History</h3>
                  {!account?.customerTrips?.length ? (
                    <div className="p-6 text-center border border-slate-200 rounded-2xl text-xs text-slate-500 space-y-3">
                      <p>No trips or deliveries booked yet.</p>
                      <button
                        type="button"
                        onClick={() => setCustomerTab('BOOK')}
                        className="min-h-[40px] px-4 py-2 bg-slate-900 text-white rounded-lg font-medium"
                      >
                        Book First Ride or Grocery Order
                      </button>
                    </div>
                  ) : (
                    account.customerTrips.map((t: any) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {t.tripCode} · {t.serviceType.replace('_', ' ')}
                          </span>
                          <span className="font-mono tabular-nums font-bold">
                            {t.totalFareKes} KES
                          </span>
                        </div>
                        <div className="text-slate-500">
                          {t.status} · {t.distanceKm} km · {t.paymentMethod} ({t.paymentStatus})
                        </div>
                        <div className="truncate text-slate-600">To: {t.destinationAddress}</div>

                        {t.status === 'COMPLETED' && !ratedTripIds.includes(t.id) && (
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600">Rate Rider:</span>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setRatingScore(star)}
                                  className="p-1"
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      star <= ratingScore
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-slate-300'
                                    }`}
                                  />
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => void handleRateTrip(t.id)}
                                className="ml-auto px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium"
                              >
                                Submit Rating
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {customerTab === 'WALLET' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-1">
                    <div className="text-xs text-slate-400">BodaLink Wallet Balance</div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      {account?.wallet?.balanceKes ?? '0.00'} KES
                    </div>
                    <div className="text-xs text-emerald-400">
                      Instant M-Pesa Daraja Top-Up & Zero-Cash Checkout
                    </div>
                  </div>

                  <form onSubmit={handleWalletTopUp} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Top-Up Amount (KES)</label>
                        <input
                          type="number"
                          min={50}
                          value={topUpKes}
                          onChange={(e) => setTopUpKes(e.target.value)}
                          className="w-full min-h-[44px] px-3 text-xs border border-slate-200 rounded-xl font-mono text-slate-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">M-Pesa MSISDN</label>
                        <input
                          type="tel"
                          value={mpesaPhoneInput}
                          onChange={(e) => setMpesaPhoneInput(e.target.value)}
                          className="w-full min-h-[44px] px-3 text-xs border border-slate-200 rounded-xl font-mono text-slate-900 bg-white"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={!firebaseUser}
                      className="w-full min-h-[44px] bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700"
                    >
                      Send M-Pesa STK Push Top-Up
                    </button>
                  </form>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500">Wallet Ledger</h4>
                    {(account?.walletTransactions || []).map((tx: any) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-2.5 border-b border-slate-100 text-xs"
                      >
                        <div>
                          <div className="font-medium">{tx.description}</div>
                          <div className="text-slate-400 font-mono">{tx.reference}</div>
                        </div>
                        <div className="font-mono tabular-nums font-semibold">{tx.amountKes} KES</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customerTab === 'SUPPORT' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold">24/7 BodaLink Support & Safety Desk</h3>
                  <form onSubmit={handleSendSupport} className="space-y-3">
                    <input
                      type="text"
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full min-h-[42px] px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-900"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={supportBody}
                        onChange={(e) => setSupportBody(e.target.value)}
                        placeholder="Message Customer Support..."
                        className="flex-1 min-h-[44px] px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={!firebaseUser}
                        className="min-h-[44px] px-4 bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(account?.supportTickets || []).map((tk: any) => (
                      <div key={tk.id} className="p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex justify-between font-semibold">
                          <span>
                            {tk.ticketNumber} · {tk.subject}
                          </span>
                          <span>{tk.status}</span>
                        </div>
                        {(tk.messages || []).map((m: any, i: number) => (
                          <div key={i} className="text-slate-600">
                            <span className="font-semibold text-slate-900">{m.senderName}:</span>{' '}
                            {m.body}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ============================================================
               RIDER DASHBOARD (Strict KYC Verification Gate + Earnings)
               ============================================================ */
            <div className="space-y-6">
              {/* Rider Profile Header */}
              <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900">
                <div className="flex items-center gap-3">
                  <ResilientImage
                    src={RIDER_AVATAR_IMG}
                    alt="BodaLink Rider"
                    className="w-12 h-12 rounded-full object-cover border border-slate-300 shrink-0"
                  />
                  <div>
                    <div className="text-sm font-bold">{account?.user?.fullName}</div>
                    <div className="text-xs text-slate-600">
                      KYC Status: {account?.riderProfile?.verificationStatus || 'PENDING_DOCUMENTS'} ·{' '}
                      {account?.motorcycle?.registrationNumber || 'No Bike Registered'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleOnline(!account?.riderProfile?.isOnline)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    account?.riderProfile?.isOnline
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {account?.riderProfile?.isOnline ? 'Online · Go Offline' : 'Go Online'}
                </button>
              </div>

              {/* Strict Compliance Gate Notice if not yet APPROVED */}
              {account?.riderProfile?.verificationStatus !== 'APPROVED' && (
                <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>Compliance Verification Gate Active</span>
                  </div>
                  <p>
                    A rider cannot go online or accept passenger/parcel jobs until National ID, NTSA
                    Driving License, and Motorcycle Registration are approved by Compliance in the
                    separate Admin Portal.
                  </p>
                </div>
              )}

              {/* Rider Navigation Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-slate-700">
                {(
                  [
                    { id: 'DISPATCH', label: 'Dispatch' },
                    { id: 'KYC', label: 'KYC Docs' },
                    { id: 'EARNINGS', label: 'Earnings' },
                    { id: 'SUPPORT', label: 'Support' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRiderTab(t.id)}
                    className={`min-h-[44px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      riderTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {riderTab === 'DISPATCH' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold">Incoming Ride, Grocery & Parcel Requests</h3>
                  {!account?.openRideRequests?.length && !account?.riderTrips?.length ? (
                    <div className="p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                      {account?.riderProfile?.verificationStatus === 'APPROVED'
                        ? 'No pending requests in your zone right now. Stay Online for instant dispatch.'
                        : 'Complete KYC upload in the KYC Docs tab, then approve in the separate Admin Portal.'}
                    </div>
                  ) : (
                    <>
                      {(account?.openRideRequests || []).map((req: any) => (
                        <div
                          key={req.id}
                          className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50/60 text-slate-900 space-y-2 text-xs"
                        >
                          <div className="flex justify-between font-bold">
                            <span>
                              NEW · {req.serviceType.replace('_', ' ')} ({req.tripCode})
                            </span>
                            <span className="font-mono tabular-nums">
                              Net {req.riderEarningsKes} KES
                            </span>
                          </div>
                          <div>Pickup: {req.pickupAddress}</div>
                          <div>Dropoff: {req.destinationAddress}</div>
                          <div className="text-slate-600 font-mono tabular-nums">
                            Gross {req.totalFareKes} KES · Platform Fee ({req.commissionRatePct}%):{' '}
                            {req.platformCommissionKes} KES
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => void handleTripLifecycle(req.id, 'ACCEPT')}
                              className="flex-1 min-h-[44px] bg-emerald-600 text-white rounded-xl font-semibold"
                            >
                              Accept Job
                            </button>
                          </div>
                        </div>
                      ))}

                      {(account?.riderTrips || []).map((job: any) => (
                        <div
                          key={job.id}
                          className="p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs"
                        >
                          <div className="flex justify-between font-semibold">
                            <span>
                              {job.tripCode} · {job.status}
                            </span>
                            <span className="font-mono tabular-nums text-emerald-700 font-bold">
                              +{job.riderEarningsKes} KES
                            </span>
                          </div>
                          <div className="text-slate-500 truncate">To: {job.destinationAddress}</div>

                          {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                            <div className="space-y-2 pt-1">
                              <input
                                type="text"
                                value={podNoteInput}
                                onChange={(e) => setPodNoteInput(e.target.value)}
                                placeholder="Proof of delivery note / recipient PIN"
                                className="w-full min-h-[40px] px-3 border border-slate-200 rounded-lg bg-white text-slate-900"
                              />
                              <div className="flex flex-wrap gap-2">
                                {job.status === 'ACCEPTED' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleTripLifecycle(job.id, 'START_TRIP')}
                                    className="min-h-[42px] px-3.5 bg-slate-900 text-white rounded-xl font-semibold"
                                  >
                                    Collect & Start Trip
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleStreamNextGpsBreadcrumb(job)}
                                  className="min-h-[42px] px-3 border border-slate-300 rounded-xl font-medium"
                                >
                                  Broadcast GPS Update
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleTripLifecycle(job.id, 'COMPLETE_TRIP')}
                                  className="min-h-[42px] px-3.5 bg-emerald-600 text-white rounded-xl font-semibold"
                                >
                                  Confirm Delivery & Upload POD
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {riderTab === 'KYC' && (
                <form onSubmit={handleSubmitKyc} className="space-y-3 text-xs">
                  <div className="font-bold text-sm">7-Step Rider & Motorcycle Verification</div>
                  <p className="text-slate-500">
                    Upload National ID, NTSA Class A/FG Driving License, and Motorcycle Logbook for
                    Admin Compliance verification.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Kenyan National ID Number</label>
                      <input
                        type="text"
                        required
                        value={kycForm.nationalIdNumber}
                        onChange={(e) =>
                          setKycForm({ ...kycForm, nationalIdNumber: e.target.value })
                        }
                        className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl font-mono bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">NTSA Driving License No.</label>
                      <input
                        type="text"
                        required
                        value={kycForm.drivingLicenseNumber}
                        onChange={(e) =>
                          setKycForm({ ...kycForm, drivingLicenseNumber: e.target.value })
                        }
                        className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl font-mono bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Motorcycle Plate (KMF/KMG)</label>
                      <input
                        type="text"
                        required
                        value={kycForm.registrationNumber}
                        onChange={(e) =>
                          setKycForm({ ...kycForm, registrationNumber: e.target.value })
                        }
                        className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl font-mono uppercase bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Make & Model</label>
                      <input
                        type="text"
                        required
                        value={`${kycForm.make} ${kycForm.model}`}
                        onChange={(e) => setKycForm({ ...kycForm, model: e.target.value })}
                        className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl bg-white text-slate-900"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={kycForm.hasInsulatedGroceryBox}
                      onChange={(e) =>
                        setKycForm({ ...kycForm, hasInsulatedGroceryBox: e.target.checked })
                      }
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span>Equipped with weather-sealed insulated grocery & parcel rear box</span>
                  </label>

                  <button
                    type="submit"
                    className="w-full min-h-[46px] bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800"
                  >
                    Submit Verification Packet for Admin Review
                  </button>
                </form>
              )}

              {riderTab === 'EARNINGS' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
                    <div className="p-3 rounded-xl border border-slate-200">
                      <div className="text-slate-500 font-sans">Today Net</div>
                      <div className="text-base font-bold mt-0.5">
                        {riderEarningsStats.dailyNetKes.toFixed(0)} KES
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200">
                      <div className="text-slate-500 font-sans">Weekly</div>
                      <div className="text-base font-bold mt-0.5">
                        {riderEarningsStats.weeklyNetKes.toFixed(0)} KES
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200">
                      <div className="text-slate-500 font-sans">Monthly</div>
                      <div className="text-base font-bold mt-0.5">
                        {riderEarningsStats.monthlyNetKes.toFixed(0)} KES
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1 font-mono tabular-nums">
                    <div className="text-slate-400 font-sans">Withdrawable Rider Wallet</div>
                    <div className="text-2xl font-bold">
                      {account?.wallet?.balanceKes ?? '0.00'} KES
                    </div>
                    <div className="text-emerald-400 font-sans">
                      Platform Commission Deducted: {riderEarningsStats.commissionDeductedKes.toFixed(2)} KES · Rating{' '}
                      {account?.riderProfile?.averageRating || '4.95'} ★
                    </div>
                  </div>

                  <form onSubmit={handleRiderWithdraw} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={100}
                        value={withdrawKes}
                        onChange={(e) => setWithdrawKes(e.target.value)}
                        className="min-h-[44px] px-3 border border-slate-200 rounded-xl font-mono bg-white text-slate-900"
                      />
                      <input
                        type="tel"
                        value={mpesaPhoneInput}
                        onChange={(e) => setMpesaPhoneInput(e.target.value)}
                        className="min-h-[44px] px-3 border border-slate-200 rounded-xl font-mono bg-white text-slate-900"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[44px] bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
                    >
                      Instant Withdraw to M-Pesa (B2C)
                    </button>
                  </form>
                </div>
              )}

              {riderTab === 'SUPPORT' && (
                <form onSubmit={handleSendSupport} className="space-y-3 text-xs">
                  <div className="font-bold text-sm">Rider Dispatch Support</div>
                  <input
                    type="text"
                    value={supportBody}
                    onChange={(e) => setSupportBody(e.target.value)}
                    placeholder="Report road closure, parcel issue, or M-Pesa settlement question..."
                    className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl bg-white text-slate-900"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 bg-slate-900 text-white rounded-xl font-semibold"
                  >
                    Message Operations Desk
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (7 cols on desktop): Live Google Map + Fleet & Traffic Context */}
        <div className="lg:col-span-7 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              <span>Live Google Maps Routing</span>
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">
                {fleetSnapshot.onlineRiders.length} Verified Riders Online
              </span>
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">
                {routeMetrics.distanceKm} km ({routeMetrics.durationMin} mins)
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs text-slate-700">
              <button
                type="button"
                onClick={() => setPinTargetMode('PICKUP')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                  pinTargetMode === 'PICKUP' ? 'bg-white text-slate-900 shadow-sm' : ''
                }`}
              >
                Click Map: Set Pickup
              </button>
              <button
                type="button"
                onClick={() => setPinTargetMode('DROPOFF')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                  pinTargetMode === 'DROPOFF' ? 'bg-white text-slate-900 shadow-sm' : ''
                }`}
              >
                Click Map: Set Dropoff
              </button>
            </div>
          </div>

          <BodaLinkLiveMap
            pickup={
              activeCustomerTrip
                ? { lat: activeCustomerTrip.pickupLat, lng: activeCustomerTrip.pickupLng }
                : pickup
            }
            destination={
              activeCustomerTrip
                ? { lat: activeCustomerTrip.destinationLat, lng: activeCustomerTrip.destinationLng }
                : destination
            }
            onlineRiders={fleetSnapshot.onlineRiders}
            activeRiderGps={activeRiderGps}
            onRouteComputed={setRouteMetrics}
            onMapClickSelect={(pt) => {
              const coordLabel = `Pinned Location (${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)})`;
              if (pinTargetMode === 'PICKUP') {
                setPickup({ ...pt, address: coordLabel });
              } else {
                setDestination({ ...pt, address: coordLabel });
              }
            }}
          />

          {/* Online Verified Riders Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {fleetSnapshot.onlineRiders.slice(0, 3).map((r) => (
              <div
                key={r.userId}
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  darkSurface ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span className="truncate">{r.fullName}</span>
                  <span className="font-mono tabular-nums text-emerald-600">{r.averageRating} ★</span>
                </div>
                <div className="text-slate-500 font-mono">
                  {r.motorcycle?.registrationNumber || 'KMF'} · {r.motorcycle?.make || 'Boxer'}
                </div>
                <div className="text-slate-500 truncate">{r.operatingZone}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
