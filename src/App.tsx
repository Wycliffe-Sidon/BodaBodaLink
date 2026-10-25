/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthProvider, useAuth } from './lib/authContext.tsx';
import { MobilePlatformWorkspace } from './components/MobilePlatformWorkspace.tsx';
import { SeparateAdminPortal } from './components/SeparateAdminPortal.tsx';
import { EngineeringBlueprintExplorer } from './components/EngineeringBlueprintExplorer.tsx';

const HERO_NAIROBI_IMG = '/src/assets/images/bodalink_hero_nairobi_1792917975226.jpg';
const GROCERY_PARCEL_IMG = '/src/assets/images/bodalink_grocery_parcel_1792917976214.jpg';

function BodaLinkShell() {
  const { firebaseUser, signInWithGoogle } = useAuth();
  const [surfaceMode, setSurfaceMode] = useState<'MAIN_PLATFORM' | 'SEPARATE_ADMIN_PORTAL'>(() =>
    window.location.pathname.startsWith('/admin') ? 'SEPARATE_ADMIN_PORTAL' : 'MAIN_PLATFORM'
  );
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [cargoImgFailed, setCargoImgFailed] = useState(false);

  const scrollToSection = (id: string) => {
    setSurfaceMode('MAIN_PLATFORM');
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single text wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setSurfaceMode('MAIN_PLATFORM');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-lg font-extrabold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            BodaLink
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => scrollToSection('mobile-workspace')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Customer & Rider App
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('grocery-monetization')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Services & Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('engineering-phases')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              8-Phase Architecture
            </button>
            <button
              type="button"
              onClick={() => {
                setSurfaceMode('SEPARATE_ADMIN_PORTAL');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                surfaceMode === 'SEPARATE_ADMIN_PORTAL' ? 'text-emerald-700 font-semibold' : ''
              }`}
            >
              Admin Portal
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            {surfaceMode === 'SEPARATE_ADMIN_PORTAL' ? (
              <button
                type="button"
                onClick={() => setSurfaceMode('MAIN_PLATFORM')}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Open Mobile App
              </button>
            ) : firebaseUser ? (
              <button
                type="button"
                onClick={() => scrollToSection('mobile-workspace')}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
              >
                Open Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 lg:py-12 space-y-16">
        {surfaceMode === 'SEPARATE_ADMIN_PORTAL' ? (
          <SeparateAdminPortal onReturnToMainSite={() => setSurfaceMode('MAIN_PLATFORM')} />
        ) : (
          <>
            {/* HERO SECTION: 2-Column Stretch Split + Full-Width 4-Column Metric Row Below */}
            <section className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-between py-2 space-y-6">
                  <div className="space-y-4">
                    <div className="text-xs font-medium text-slate-500">
                      Kenya & East Africa Mobility · Passenger Rides · Grocery & Parcel Logistics
                    </div>
                    <h1
                      className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.08]"
                      style={{ textWrap: 'balance' }}
                    >
                      Safe Rides. Fast Deliveries. Built for East Africa’s Boda Network.
                    </h1>
                    <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                      Book NTSA-verified motorcycle passenger transport, 25-minute weather-sealed
                      grocery deliveries, and PIN-protected express parcels across Nairobi with
                      M-Pesa Daraja STK checkout and real-time GPS tracking.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => scrollToSection('mobile-workspace')}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap"
                    >
                      Book Ride or Grocery Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => setSurfaceMode('SEPARATE_ADMIN_PORTAL')}
                      className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      Launch Separate Admin Portal
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 min-h-[320px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 relative">
                  {!heroImgFailed ? (
                    <img
                      src={HERO_NAIROBI_IMG}
                      alt="Verified BodaLink motorcycle courier riding along a jacaranda-lined Nairobi avenue with insulated grocery and parcel box"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full lg:h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm p-8">
                      BodaLink Nairobi Fleet — Safe Rides. Fast Deliveries.
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute bottom-5 left-6 right-6 text-white text-xs flex flex-wrap items-center justify-between gap-2">
                    <span>Verified NTSA Class A Riders · Dual Certified Helmets</span>
                    <span className="font-mono tabular-nums">M-Pesa STK · Wallet · Cash</span>
                  </div>
                </div>
              </div>

              {/* Full-Width 4-Column Quantitative Proof Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-200">
                <div className="py-2">
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    85% / 15%
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Transparent Rider Payout vs Configurable Platform Commission
                  </div>
                </div>
                <div className="py-2">
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    100 KES
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Base Fare + 20 KES/km + 2 KES/min Automatic Pricing
                  </div>
                </div>
                <div className="py-2">
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    23 Tables
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Live Cloud SQL PostgreSQL Schema + Socket.IO Real-Time Sync
                  </div>
                </div>
                <div className="py-2">
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    100,000+
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Target Concurrent East African Riders & Grocery Customers
                  </div>
                </div>
              </div>
            </section>

            {/* UNIFIED CUSTOMER & RIDER APPLICATION WORKSPACE */}
            <div id="mobile-workspace">
              <MobilePlatformWorkspace />
            </div>

            {/* SERVICES, GROCERY LOGISTICS & MONETIZATION ARCHITECTURE */}
            <section
              id="grocery-monetization"
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white border border-slate-200 rounded-3xl p-6 lg:p-10"
            >
              <div className="lg:col-span-5 rounded-2xl overflow-hidden bg-slate-100 min-h-[280px]">
                {!cargoImgFailed ? (
                  <img
                    src={GROCERY_PARCEL_IMG}
                    alt="Weather-sealed BodaLink insulated grocery and parcel box filled with East African fresh produce and barcoded packages"
                    referrerPolicy="no-referrer"
                    onError={() => setCargoImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 p-6">
                    Insulated Grocery & Express Parcel Cargo Box
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-emerald-700">
                    Multi-Vertical Mobility & Unit Economics
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    High-Frequency Grocery Express, Passenger Rides & Corporate Logistics
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Every verified BodaLink operator can switch seamlessly between commuter rides
                    during peak traffic hours and high-margin supermarket grocery or merchant parcel
                    deliveries throughout the day.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100 text-xs">
                  <div className="space-y-1.5">
                    <div className="font-bold text-sm text-slate-900">
                      01. Configurable Ride & Parcel Commission
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      On a <span className="font-mono tabular-nums font-semibold">1,000 KES</span>{' '}
                      trip at the default{' '}
                      <span className="font-mono tabular-nums font-semibold">15%</span> rate,
                      BodaLink records{' '}
                      <span className="font-mono tabular-nums font-semibold">150 KES</span> platform
                      revenue and credits{' '}
                      <span className="font-mono tabular-nums font-semibold">850 KES</span>{' '}
                      immediately to the Rider Wallet.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-bold text-sm text-slate-900">
                      02. Strict Role & Portal Isolation
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Customers and Riders share a single Clean-Architecture mobile app with
                      automatic post-login RBAC routing. Admins authenticate exclusively via the
                      isolated <span className="font-mono">admin.bodalink.com</span> portal with MFA.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-bold text-sm text-slate-900">
                      03. 7-Step NTSA & KYC Compliance Gate
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Riders upload National ID, NTSA Class A Driving License, Motorcycle Logbook,
                      and Profile Photo. Dispatch remains locked until Compliance Admin approval.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-bold text-sm text-slate-900">
                      04. Subscriptions & Corporate Accounts
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Recurring revenue from Weekly Pro Rider Subscriptions, featured grocery store
                      partnerships, and consolidated monthly corporate transport billing.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* COMPLETE 8-PHASE ENGINEERING DELIVERABLE EXPLORER */}
            <EngineeringBlueprintExplorer />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-900">BodaLink</span> · Safe Rides. Fast
            Deliveries. · Nairobi, Kenya & East Africa
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 underline-offset-4 hover:underline"
            >
              Google Maps End User Terms
            </a>
            <button
              type="button"
              onClick={() => {
                setSurfaceMode('SEPARATE_ADMIN_PORTAL');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-900 underline-offset-4 hover:underline"
            >
              Isolated Admin Portal (admin.bodalink.com)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  return (
    <AuthProvider>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <APIProvider apiKey={mapsApiKey} region="KE" language="en">
        <BodaLinkShell />
      </APIProvider>
    </AuthProvider>
  );
}
