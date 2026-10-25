import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ENGINEERING_PHASES } from '../data/engineeringPhases.ts';

export function EngineeringBlueprintExplorer() {
  const [selectedPhase, setSelectedPhase] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const active =
    ENGINEERING_PHASES.find((p) => p.phaseNumber === selectedPhase) || ENGINEERING_PHASES[0];

  const handleCopy = () => {
    navigator.clipboard?.writeText(active.codeArtifact);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="engineering-phases" className="space-y-6">
      <div className="max-w-3xl space-y-2">
        <div className="text-xs font-medium text-emerald-700">
          Complete 8-Phase Production Engineering Deliverables
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          End-to-End Platform Specification: PRD, Architecture, PostgreSQL, NestJS, Flutter, Admin, QA & DevOps
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Inspect all eight engineering phases engineered for Android, iOS, and Web scale beyond
          100,000 East African riders and customers.
        </p>
      </div>

      {/* Interactive Phase Selector Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
        {ENGINEERING_PHASES.map((phase) => {
          const isSelected = phase.phaseNumber === selectedPhase;
          return (
            <button
              key={phase.phaseNumber}
              type="button"
              onClick={() => setSelectedPhase(phase.phaseNumber)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phase {phase.phaseNumber}: {phase.title.split('(')[0].trim()}
            </button>
          );
        })}
      </div>

      {/* Selected Phase Detail View */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <div className="text-xs text-slate-500">
              Phase 0{active.phaseNumber} · {active.ownerTeam}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{active.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{active.summary}</p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-900">Core Deliverables</h4>
            <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
              {active.keyDeliverables.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-emerald-700 font-bold">0{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            {active.architectureSpecs.map((spec, idx) => (
              <div key={idx} className="space-y-1">
                <div className="text-xs font-semibold text-slate-900">{spec.heading}</div>
                <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                  {spec.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-slate-200 rounded-t-2xl border-b border-slate-800 text-xs">
            <span className="font-mono truncate">{active.codeArtifactTitle}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>
          <pre className="flex-1 bg-slate-950 text-slate-200 p-5 rounded-b-2xl text-xs font-mono leading-relaxed overflow-x-auto">
            <code>{active.codeArtifact}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
