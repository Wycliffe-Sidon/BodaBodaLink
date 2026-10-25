import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../lib/authContext.tsx';
import { BodaLinkLiveMap } from './BodaLinkMap.tsx';

const ADMIN_OPS_IMG = '/src/assets/images/bodalink_admin_ops_1792917976871.jpg';

export function SeparateAdminPortal({ onReturnToMainSite }: { onReturnToMainSite: () => void }) {
  const { firebaseUser, signInWithGoogle, apiFetch, socket } = useAuth();

  const [sessionState, setSessionState] = useState<{
    sessionToken: string;
    mfaVerified: boolean;
    admin: any;
    demoMfaHint?: string;
  } | null>(null);

  const [mfaCodeInput, setMfaCodeInput] = useState('246810');
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const [activeSection, setActiveSection] = useState<
    'FLEET' | 'KYC' | 'PRICING' | 'FINANCE' | 'SUPPORT' | 'SECURITY'
  >('FLEET');

  const [pricingForm, setPricingForm] = useState({
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
  });

  const [newAdminForm, setNewAdminForm] = useState({
    email: '',
    fullName: '',
    roleKey: 'COMPLIANCE_OFFICER' as
      | 'SUPER_ADMIN'
      | 'OPERATIONS_MANAGER'
      | 'FINANCE_MANAGER'
      | 'CUSTOMER_SUPPORT'
      | 'COMPLIANCE_OFFICER',
    mfaPasscode: '246810',
  });

  const [kycNotesMap, setKycNotesMap] = useState<Record<number, string>>({});
  const [supportReplyMap, setSupportReplyMap] = useState<Record<number, string>>({});
  const [portalNotice, setPortalNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(
    null
  );

  const loadDashboard = useCallback(
    async (token: string) => {
      setLoading(true);
      try {
        const data = await apiFetch('/api/admin/dashboard', {
          adminSessionToken: token,
        });
        setDashboard(data);
        if (data?.pricing) {
          setPricingForm({
            baseFareKes: String(data.pricing.baseFareKes),
            distanceRatePerKmKes: String(data.pricing.distanceRatePerKmKes),
            timeRatePerMinKes: String(data.pricing.timeRatePerMinKes),
            peakHourFeeKes: String(data.pricing.peakHourFeeKes),
            nightFeeKes: String(data.pricing.nightFeeKes),
            weatherRiskFeeKes: String(data.pricing.weatherRiskFeeKes),
            platformCommissionPct: String(data.pricing.platformCommissionPct),
            peakHourActive: Boolean(data.pricing.peakHourActive),
            nightFeeActive: Boolean(data.pricing.nightFeeActive),
            weatherRiskActive: Boolean(data.pricing.weatherRiskActive),
          });
        }
      } catch (err: any) {
        setPortalNotice({ tone: 'err', text: err.message });
      } finally {
        setLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    if (!socket || !sessionState?.mfaVerified) return;
    socket.emit('join:role', 'ADMIN_OPS');

    const refresh = () => {
      void loadDashboard(sessionState.sessionToken);
    };
    socket.on('trip:updated', refresh);
    socket.on('admin:kyc:submitted', refresh);
    socket.on('sos:triggered', refresh);
    socket.on('support:updated', refresh);
    return () => {
      socket.off('trip:updated', refresh);
      socket.off('admin:kyc:submitted', refresh);
      socket.off('sos:triggered', refresh);
      socket.off('support:updated', refresh);
    };
  }, [socket, sessionState, loadDashboard]);

  const handleInitAdminLogin = async () => {
    setAuthMsg(null);
    try {
      if (!firebaseUser) {
        const u = await signInWithGoogle();
        if (!u) return;
      }
      const res = await apiFetch('/api/admin/session/init', { method: 'POST' });
      setSessionState(res);
      if (res.demoMfaHint) {
        setMfaCodeInput(res.demoMfaHint);
      }
    } catch (err: any) {
      setAuthMsg(err.message);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionState) return;
    setAuthMsg(null);
    try {
      const verified = await apiFetch('/api/admin/session/verify-mfa', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: sessionState.sessionToken,
          mfaCode: mfaCodeInput,
        }),
      });
      setSessionState(verified);
      await loadDashboard(verified.sessionToken);
    } catch (err: any) {
      setAuthMsg(err.message);
    }
  };

  const handleReviewRider = async (
    riderProfileId: number,
    decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  ) => {
    if (!sessionState) return;
    try {
      await apiFetch(`/api/admin/riders/${riderProfileId}/review`, {
        method: 'POST',
        adminSessionToken: sessionState.sessionToken,
        body: JSON.stringify({
          decision,
          notes:
            kycNotesMap[riderProfileId] ||
            (decision === 'APPROVED'
              ? 'National ID, NTSA Class A License & Motorcycle Logbook verified.'
              : 'Compliance documentation incomplete.'),
        }),
      });
      await loadDashboard(sessionState.sessionToken);
      setPortalNotice({
        tone: 'ok',
        text: `Rider profile #${riderProfileId} updated to ${decision}.`,
      });
    } catch (err: any) {
      setPortalNotice({ tone: 'err', text: err.message });
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionState) return;
    try {
      await apiFetch('/api/admin/pricing', {
        method: 'POST',
        adminSessionToken: sessionState.sessionToken,
        body: JSON.stringify(pricingForm),
      });
      await loadDashboard(sessionState.sessionToken);
      setPortalNotice({
        tone: 'ok',
        text: 'Kenya dynamic fare formula & platform commission rate updated across live fleet.',
      });
    } catch (err: any) {
      setPortalNotice({ tone: 'err', text: err.message });
    }
  };

  const handleCreateAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionState) return;
    try {
      await apiFetch('/api/admin/accounts', {
        method: 'POST',
        adminSessionToken: sessionState.sessionToken,
        body: JSON.stringify(newAdminForm),
      });
      setNewAdminForm({
        email: '',
        fullName: '',
        roleKey: 'COMPLIANCE_OFFICER',
        mfaPasscode: '246810',
      });
      await loadDashboard(sessionState.sessionToken);
      setPortalNotice({
        tone: 'ok',
        text: 'Created new Admin Portal account with mandatory MFA enforcement.',
      });
    } catch (err: any) {
      setPortalNotice({ tone: 'err', text: err.message });
    }
  };

  const handleReplySupport = async (ticketId: number, resolveTicket: boolean) => {
    if (!sessionState) return;
    const body = supportReplyMap[ticketId] || 'Operations team has reviewed and resolved this request.';
    try {
      await apiFetch(`/api/admin/support/${ticketId}/reply`, {
        method: 'POST',
        adminSessionToken: sessionState.sessionToken,
        body: JSON.stringify({ body, resolveTicket }),
      });
      setSupportReplyMap((prev) => ({ ...prev, [ticketId]: '' }));
      await loadDashboard(sessionState.sessionToken);
    } catch (err: any) {
      setPortalNotice({ tone: 'err', text: err.message });
    }
  };

  // ==========================================================================
  // ISOLATED ADMIN AUTH + MFA SECURITY GATE
  // ==========================================================================
  if (!sessionState || !sessionState.mfaVerified) {
    return (
      <div className="min-h-[82vh] bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <div className="text-xs text-emerald-400 font-mono">
              admin.bodalink.com · Isolated Enterprise Control Plane
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              BodaLink Admin & Compliance Portal
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              Strictly separated from the Customer & Rider mobile application. Requires verified
              Admin account credentials, Multi-Factor Authentication (MFA), device binding, and IP
              session audit logging. Only a Super Admin can provision additional Admin accounts.
            </p>
          </div>

          {authMsg && (
            <div className="p-4 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-200">
              {authMsg}
            </div>
          )}

          {!sessionState ? (
            <div className="space-y-4 max-w-md">
              <button
                type="button"
                onClick={() => void handleInitAdminLogin()}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors"
              >
                Authenticate Admin Identity & Device
              </button>
              <button
                type="button"
                onClick={onReturnToMainSite}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-800 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Return to Public Customer & Rider Platform
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyMfa} className="space-y-4 max-w-md">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 text-xs space-y-1">
                <div className="font-semibold text-white">
                  Step 2 of 2 — Multi-Factor Authentication (MFA)
                </div>
                <div className="text-slate-400">
                  Identity: {sessionState.admin.email} · Role: {sessionState.admin.roleKey}
                </div>
                <div className="text-emerald-400 font-mono">
                  Email Verified · Workstation Fingerprint Recorded
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Enter 6-Digit Authenticator / Security Passcode
                </label>
                <input
                  type="text"
                  required
                  value={mfaCodeInput}
                  onChange={(e) => setMfaCodeInput(e.target.value)}
                  className="w-full min-h-[48px] px-4 text-base tracking-widest font-mono bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500 transition-colors"
              >
                Verify MFA & Unlock Admin Console
              </button>
            </form>
          )}

          <div className="text-xs text-slate-500">
            Supported RBAC Roles: Super Admin · Operations Manager · Finance Manager · Customer Support · Compliance Officer
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[320px] bg-slate-900">
          <img
            src={ADMIN_OPS_IMG}
            alt="BodaLink Nairobi Fleet Dispatch Center"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
        </div>
      </div>
    );
  }

  // ==========================================================================
  // AUTHENTICATED + MFA-VERIFIED ADMIN WORKSPACE (Sidebar + High-Density Grids)
  // ==========================================================================
  const metrics = dashboard?.metrics || {
    grossGmvKes: '0.00',
    platformRevenueKes: '0.00',
    riderPayoutsKes: '0.00',
    totalTripsCount: 0,
    activeTripsCount: 0,
    pendingRidersCount: 0,
    approvedOnlineRidersCount: 0,
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[82vh]">
      {/* Left Sidebar (260px equivalent) */}
      <aside className="lg:col-span-3 xl:col-span-2 bg-slate-950 text-slate-200 p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="space-y-6">
          <div>
            <div className="text-sm font-bold text-white tracking-tight">BodaLink Admin</div>
            <div className="text-[11px] font-mono text-emerald-400 mt-0.5">admin.bodalink.com</div>
          </div>

          <nav className="space-y-1">
            {(
              [
                { id: 'FLEET', label: 'Live Fleet & Dispatch' },
                { id: 'KYC', label: `Rider KYC (${metrics.pendingRidersCount})` },
                { id: 'PRICING', label: 'Fare & Commission' },
                { id: 'FINANCE', label: 'Finance & Withdrawals' },
                { id: 'SUPPORT', label: 'Support & SOS Desk' },
                { id: 'SECURITY', label: 'RBAC, Sessions & Audit' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  activeSection === item.id
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800 space-y-3 text-xs">
          <div>
            <div className="font-semibold text-white truncate">
              {dashboard?.currentAdmin?.fullName}
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              {dashboard?.currentAdmin?.roleKey}
            </div>
          </div>
          <button
            type="button"
            onClick={onReturnToMainSite}
            className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs"
          >
            Exit Admin Portal
          </button>
        </div>
      </aside>

      {/* Main Admin Viewport */}
      <div className="lg:col-span-9 xl:col-span-10 p-6 lg:p-8 space-y-6">
        {/* Top Bar Breadcrumb + Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="text-xs text-slate-500">
            <span>Admin Portal</span>
            <span aria-hidden="true"> / </span>
            <span className="font-semibold text-slate-900">{activeSection}</span>
            <span aria-hidden="true"> · </span>
            <span>MFA Session Verified</span>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard(sessionState.sessionToken)}
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        {portalNotice && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex justify-between items-center ${
              portalNotice.tone === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span>{portalNotice.text}</span>
            <button
              type="button"
              onClick={() => setPortalNotice(null)}
              className="underline text-xs"
            >
              Close
            </button>
          </div>
        )}

        {/* 4-Column KPI Strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 font-mono tabular-nums">
          <div className="p-4 rounded-2xl border border-slate-200">
            <div className="text-xs font-sans text-slate-500">Gross Platform GMV</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{metrics.grossGmvKes} KES</div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200">
            <div className="text-xs font-sans text-slate-500">
              Platform Commission ({pricingForm.platformCommissionPct}%)
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {metrics.platformRevenueKes} KES
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200">
            <div className="text-xs font-sans text-slate-500">Net Rider Settlements</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {metrics.riderPayoutsKes} KES
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200">
            <div className="text-xs font-sans text-slate-500">Active Trips · Online Riders</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {metrics.activeTripsCount} · {metrics.approvedOnlineRidersCount}
            </div>
          </div>
        </div>

        {/* SECTION 1: LIVE FLEET & DISPATCH */}
        {activeSection === 'FLEET' && (
          <div className="space-y-6">
            <BodaLinkLiveMap
              pickup={null}
              destination={null}
              onlineRiders={(dashboard?.riders || []).filter(
                (r: any) => r.verificationStatus === 'APPROVED' && r.isOnline
              )}
              heightClass="h-[380px]"
            />

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Trip Code</th>
                    <th className="py-3 px-4 font-semibold">Service</th>
                    <th className="py-3 px-4 font-semibold">Route</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Gross (KES)</th>
                    <th className="py-3 px-4 font-semibold text-right">Commission</th>
                    <th className="py-3 px-4 font-semibold text-right">Rider Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(dashboard?.trips || []).map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold">{t.tripCode}</td>
                      <td className="py-3 px-4">{t.serviceType}</td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        {t.pickupAddress} → {t.destinationAddress}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {t.sosTriggered ? 'CRITICAL SOS_ALERT' : t.status}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {t.totalFareKes}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {t.platformCommissionKes}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {t.riderEarningsKes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 2: RIDER KYC & COMPLIANCE QUEUE */}
        {activeSection === 'KYC' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold">
              Rider Compliance Verification Queue (NTSA & National ID Review)
            </h3>
            <div className="space-y-3">
              {(dashboard?.riders || []).map((r: any) => (
                <div
                  key={r.riderProfileId}
                  className="p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      {r.fullName} · {r.verificationStatus}
                    </div>
                    <div className="text-slate-600 font-mono">
                      National ID: {r.nationalIdNumber || 'Not Uploaded'} · NTSA DL:{' '}
                      {r.drivingLicenseNumber || 'Not Uploaded'} · Bike:{' '}
                      {r.motorcycle?.registrationNumber || 'Pending'} ({r.motorcycle?.make || '—'})
                    </div>
                    <div className="text-slate-500">
                      Zone: {r.operatingZone} · Insulated Grocery Box:{' '}
                      {r.motorcycle?.hasInsulatedGroceryBox ? 'Yes' : 'No'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={kycNotesMap[r.riderProfileId] || ''}
                      onChange={(e) =>
                        setKycNotesMap((prev) => ({
                          ...prev,
                          [r.riderProfileId]: e.target.value,
                        }))
                      }
                      placeholder="Compliance audit note..."
                      className="min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void handleReviewRider(r.riderProfileId, 'APPROVED')}
                      className="min-h-[40px] px-3.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 whitespace-nowrap"
                    >
                      Approve & Activate
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReviewRider(r.riderProfileId, 'REJECTED')}
                      className="min-h-[40px] px-3 border border-red-200 text-red-700 rounded-xl font-medium hover:bg-red-50 whitespace-nowrap"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: DYNAMIC PRICING & COMMISSION ENGINE */}
        {activeSection === 'PRICING' && (
          <form onSubmit={handleSavePricing} className="max-w-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold">
              Configurable Fare Formula & Platform Commission Rate
            </h3>
            <p className="text-slate-500">
              Example: On a 1,000 KES ride at {pricingForm.platformCommissionPct}% commission,
              BodaLink receives{' '}
              {((1000 * Number(pricingForm.platformCommissionPct || 15)) / 100).toFixed(0)} KES and
              the Rider receives{' '}
              {(1000 - (1000 * Number(pricingForm.platformCommissionPct || 15)) / 100).toFixed(0)}{' '}
              KES.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 mb-1">Platform Commission (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={pricingForm.platformCommissionPct}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, platformCommissionPct: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Base Fare (KES)</label>
                <input
                  type="number"
                  value={pricingForm.baseFareKes}
                  onChange={(e) => setPricingForm({ ...pricingForm, baseFareKes: e.target.value })}
                  className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Distance Rate per KM (KES)</label>
                <input
                  type="number"
                  value={pricingForm.distanceRatePerKmKes}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, distanceRatePerKmKes: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Time Rate per Minute (KES)</label>
                <input
                  type="number"
                  value={pricingForm.timeRatePerMinKes}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, timeRatePerMinKes: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 py-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pricingForm.peakHourActive}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, peakHourActive: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>Peak Hour Fee (+{pricingForm.peakHourFeeKes} KES)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pricingForm.nightFeeActive}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, nightFeeActive: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>Night Safety Fee (+{pricingForm.nightFeeKes} KES)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pricingForm.weatherRiskActive}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, weatherRiskActive: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>Rain / Weather Risk Fee (+{pricingForm.weatherRiskFeeKes} KES)</span>
              </label>
            </div>

            <button
              type="submit"
              className="min-h-[46px] px-6 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800"
            >
              Publish Live Pricing & Commission Rules
            </button>
          </form>
        )}

        {/* SECTION 4: FINANCE, PAYMENTS & WITHDRAWALS */}
        {activeSection === 'FINANCE' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold">
                M-Pesa Daraja & Wallet Payments
              </div>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {(dashboard?.payments || []).map((p: any) => (
                  <div key={p.id} className="p-3.5 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">
                        {p.method} · {p.mpesaReceiptNumber || p.receiptCode}
                      </div>
                      <div className="text-slate-500 font-mono">{p.mpesaPhone || 'Wallet'}</div>
                    </div>
                    <div className="font-mono tabular-nums font-bold">{p.amountKes} KES</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold">
                Rider M-Pesa B2C Withdrawals
              </div>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {(dashboard?.withdrawals || []).map((w: any) => (
                  <div key={w.id} className="p-3.5 flex justify-between items-center">
                    <div>
                      <div className="font-semibold font-mono">{w.mpesaB2cReference}</div>
                      <div className="text-slate-500">{w.mpesaPhone}</div>
                    </div>
                    <div className="font-mono tabular-nums font-bold text-emerald-700">
                      {w.amountKes} KES
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: SUPPORT & SOS DESK */}
        {activeSection === 'SUPPORT' && (
          <div className="space-y-3 text-xs">
            <h3 className="text-base font-bold">Live Customer/Rider Support & Emergency SOS</h3>
            {(dashboard?.supportTickets || []).map((tk: any) => (
              <div key={tk.id} className="p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between font-bold">
                  <span>
                    {tk.ticketNumber} · {tk.category} ({tk.priority}) — {tk.subject}
                  </span>
                  <span>{tk.status}</span>
                </div>
                <div className="space-y-1 text-slate-600">
                  {(tk.messages || []).map((m: any, idx: number) => (
                    <div key={idx}>
                      <span className="font-semibold text-slate-900">
                        [{m.senderRole}] {m.senderName}:
                      </span>{' '}
                      {m.body}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <input
                    type="text"
                    value={supportReplyMap[tk.id] || ''}
                    onChange={(e) =>
                      setSupportReplyMap((prev) => ({ ...prev, [tk.id]: e.target.value }))
                    }
                    placeholder="Write official Operations / Support response..."
                    className="flex-1 min-h-[40px] px-3 border border-slate-200 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => void handleReplySupport(tk.id, false)}
                    className="min-h-[40px] px-3.5 bg-slate-900 text-white rounded-xl font-medium"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReplySupport(tk.id, true)}
                    className="min-h-[40px] px-3.5 bg-emerald-600 text-white rounded-xl font-semibold"
                  >
                    Resolve Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 6: SUPER ADMIN RBAC, IP SESSIONS & AUDIT LOGS */}
        {activeSection === 'SECURITY' && (
          <div className="space-y-6 text-xs">
            {dashboard?.currentAdmin?.roleKey === 'SUPER_ADMIN' && (
              <form
                onSubmit={handleCreateAdminUser}
                className="p-5 rounded-2xl border border-slate-200 space-y-4"
              >
                <div className="font-bold text-sm">
                  Provision Admin Portal Account (Super Admin Exclusive)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="email"
                    required
                    value={newAdminForm.email}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                    placeholder="ops.lead@bodalink.com"
                    className="min-h-[42px] px-3 border border-slate-200 rounded-xl"
                  />
                  <input
                    type="text"
                    required
                    value={newAdminForm.fullName}
                    onChange={(e) =>
                      setNewAdminForm({ ...newAdminForm, fullName: e.target.value })
                    }
                    placeholder="Full Name"
                    className="min-h-[42px] px-3 border border-slate-200 rounded-xl"
                  />
                  <select
                    value={newAdminForm.roleKey}
                    onChange={(e) =>
                      setNewAdminForm({ ...newAdminForm, roleKey: e.target.value as any })
                    }
                    className="min-h-[42px] px-3 border border-slate-200 rounded-xl"
                  >
                    <option value="COMPLIANCE_OFFICER">Compliance Officer</option>
                    <option value="OPERATIONS_MANAGER">Operations Manager</option>
                    <option value="FINANCE_MANAGER">Finance Manager</option>
                    <option value="CUSTOMER_SUPPORT">Customer Support</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                  <button
                    type="submit"
                    className="min-h-[42px] px-4 bg-emerald-600 text-white rounded-xl font-semibold"
                  >
                    Create Admin Account
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold">
                  Active Admin Sessions & IP / Device Monitoring
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {(dashboard?.adminSessions || []).map((s: any) => (
                    <div key={s.id} className="p-3.5 space-y-0.5">
                      <div className="font-mono font-semibold">
                        IP: {s.ipAddress} · MFA: {s.mfaVerified ? 'VERIFIED' : 'PENDING'}
                      </div>
                      <div className="text-slate-500 truncate">{s.deviceLabel}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold">
                  Immutable Admin Security Audit Trail
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {(dashboard?.adminAuditLogs || []).map((log: any) => (
                    <div key={log.id} className="p-3.5 space-y-0.5">
                      <div className="font-semibold">
                        {log.action} → <span className="font-mono">{log.targetResource}</span>
                      </div>
                      <div className="text-slate-500 font-mono">
                        {log.adminEmail} ({log.adminRole}) · {log.ipAddress}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
