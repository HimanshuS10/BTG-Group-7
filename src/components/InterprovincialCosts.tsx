import React, { useMemo, useState } from 'react';
import { Edit3, Info, Plus, Trash2, X } from 'lucide-react';
import { formatCAD } from '../data/skyjackCaseData';
import type { InterprovincialDelivery } from '../types/skyguard';

interface InterprovincialCostsProps {
  deliveries: InterprovincialDelivery[];
  onAddDelivery: (delivery: InterprovincialDelivery) => void;
  onEditDelivery: (id: string, delivery: InterprovincialDelivery) => void;
  onDeleteDelivery: (id: string) => void;
}

export const InterprovincialCosts: React.FC<InterprovincialCostsProps> = ({
  deliveries,
  onAddDelivery,
  onEditDelivery,
  onDeleteDelivery,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InterprovincialDelivery | null>(null);
  const [dest, setDest] = useState('Ottawa, ON');
  const [prov, setProv] = useState('ON');
  const [date, setDate] = useState('2026-09-25');
  const [sales, setSales] = useState('500000');
  const [taxLabel, setTaxLabel] = useState('HST 13%');
  const [taxRatePct, setTaxRatePct] = useState('13');
  const [freight, setFreight] = useState('9200');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const baseline = deliveries.filter(
      (d) => d.provenance === 'Official case baseline'
    );
    const totalSales = deliveries.reduce((s, d) => s + d.salesAmount, 0);
    const totalTax = deliveries.reduce((s, d) => s + d.customerSalesTax, 0);
    const totalFreight = deliveries.reduce((s, d) => s + d.freightExpense, 0);
    return {
      totalSales,
      totalTax,
      totalFreight,
      baselineTax: baseline.reduce((s, d) => s + d.customerSalesTax, 0),
      baselineFreight: baseline.reduce((s, d) => s + d.freightExpense, 0),
      freightPctOfSales: totalSales > 0 ? (totalFreight / totalSales) * 100 : 0,
    };
  }, [deliveries]);

  const openAdd = () => {
    setEditing(null);
    setDest('Ottawa, ON');
    setProv('ON');
    setDate('2026-09-25');
    setSales('500000');
    setTaxLabel('HST 13%');
    setTaxRatePct('13');
    setFreight('9200');
    setNotes('User-added Canadian delivery scenario.');
    setError(null);
    setShowModal(true);
  };

  const openEdit = (d: InterprovincialDelivery) => {
    setEditing(d);
    setDest(d.destination);
    setProv(d.provinceCode);
    setDate(d.date);
    setSales(String(d.salesAmount));
    setTaxLabel(d.taxLabel);
    setTaxRatePct(String((d.taxRateDecimal * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')));
    setFreight(String(d.freightExpense));
    setNotes(d.notes);
    setError(null);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const salesNum = Number(sales);
    const rateNum = Number(taxRatePct) / 100;
    const freightNum = Number(freight);
    if (
      !dest.trim() ||
      !Number.isFinite(salesNum) ||
      salesNum <= 0 ||
      !Number.isFinite(rateNum) ||
      rateNum < 0 ||
      !Number.isFinite(freightNum) ||
      freightNum < 0
    ) {
      setError('Enter valid destination, positive sales amount, tax %, and freight expense.');
      return;
    }
    const customerSalesTax = Math.round(salesNum * rateNum);
    const payload: InterprovincialDelivery = {
      id: editing?.id ?? `IP-${String(deliveries.length + 1).padStart(2, '0')}`,
      provenance: editing?.provenance ?? 'User-added scenario',
      date,
      destination: dest.trim(),
      provinceCode: prov.trim().toUpperCase(),
      salesAmount: salesNum,
      taxLabel: taxLabel.trim() || 'Sales Tax',
      taxRateDecimal: rateNum,
      customerSalesTax,
      freightExpense: freightNum,
      notes: notes.trim(),
    };
    if (editing) {
      onEditDelivery(editing.id, payload);
    } else {
      onAddDelivery(payload);
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Strict Tax vs Customs & Freight Distinction Banner */}
      <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3 max-w-3xl">
          <Info className="h-4 w-4 text-[#F04F25] shrink-0 mt-0.5" />
          <p className="text-xs text-stone-600 leading-relaxed">
            <span className="font-semibold text-[#222222]">Zero Customs Duty Inside Canada:</span>{' '}
            Customer sales taxes collected on Canadian deliveries (GST, PST, QST, HST, RST totaling{' '}
            <span className="font-mono font-semibold text-[#222222]">
              {formatCAD(totals.totalTax)}
            </span>
            ) are tax remittances collected from customers — NEVER SKYJACK customs expenses, financial losses, or cost-recovery opportunities. Only outbound freight (<span className="font-mono font-semibold text-[#222222]">{formatCAD(totals.totalFreight)}</span>) is a logistics cost.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D9421B] shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Canadian Delivery</span>
        </button>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            Interprovincial Sales Total
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#222222]">
            {formatCAD(totals.totalSales)}
          </div>
          <div className="mt-1.5 text-xs text-stone-500">
            Across {deliveries.length} Canadian corridors
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            Customer Sales Tax Collected (Separate)
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-stone-700">
            {formatCAD(totals.totalTax)}
          </div>
          <div className="mt-1.5 text-xs text-stone-500">
            Excluded from losses & ROI recovery
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            Domestic Outbound Freight Expense
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#F04F25]">
            {formatCAD(totals.totalFreight)}
          </div>
          <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
            {totals.freightPctOfSales.toFixed(2)}% of interprovincial sales
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            Domestic Customs Duty
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-emerald-700">
            CAD $0
          </div>
          <div className="mt-1.5 text-xs text-stone-500">
            No customs duties apply within Canada
          </div>
        </div>
      </section>

      {/* Deliveries Table + Freight Ratio Bars */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 rounded-xl bg-white border border-stone-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#222222]">
              Canadian Interprovincial Delivery Schedule
            </h2>
            <span className="text-xs text-stone-500 font-mono">
              Official baseline: Sales $7.3M · Tax $799,525 · Freight $95,400
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-[#FAFAFA] text-stone-500 font-medium">
                  <th className="py-3 px-4">Corridor</th>
                  <th className="py-3 px-4 text-right">Sales (CAD)</th>
                  <th className="py-3 px-4">Tax Regime</th>
                  <th className="py-3 px-4 text-right">Customer Tax</th>
                  <th className="py-3 px-4 text-right">Freight Expense</th>
                  <th className="py-3 px-4 text-right">Freight %</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {deliveries.map((d) => {
                  const pct = d.salesAmount > 0 ? (d.freightExpense / d.salesAmount) * 100 : 0;
                  return (
                    <tr key={d.id} className="hover:bg-[#FAFAFA]">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#222222]">
                          {d.destination}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {d.id} · {d.provenance}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#222222]">
                        {formatCAD(d.salesAmount)}
                      </td>
                      <td className="py-3 px-4 text-stone-700">{d.taxLabel}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600">
                        {formatCAD(d.customerSalesTax)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#F04F25]">
                        {formatCAD(d.freightExpense)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600">
                        {pct.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {d.provenance === 'User-added scenario' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(d)}
                              aria-label={`Edit ${d.destination}`}
                              className="text-stone-600 hover:text-[#222222]"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDelivery(d.id)}
                              aria-label={`Delete ${d.destination}`}
                              className="text-red-700 hover:text-red-800"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-400">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Freight Intensity Summary */}
        <div className="xl:col-span-4 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-[#222222]">
            Freight Cost Intensity by Route (% of Sales)
          </h3>
          <p className="text-xs text-stone-500">
            Highlights domestic lane freight efficiency independently of provincial tax rates.
          </p>
          <div className="space-y-3 text-xs">
            {deliveries.map((d) => {
              const pct = d.salesAmount > 0 ? (d.freightExpense / d.salesAmount) * 100 : 0;
              return (
                <div key={d.id} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium text-[#333333]">{d.destination}</span>
                    <span className="font-mono tabular-nums text-[#222222]">
                      {formatCAD(d.freightExpense)} ({pct.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F04F25]"
                      style={{ width: `${Math.min(100, (pct / 2.5) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Add / Edit Delivery Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-semibold text-[#222222]">
                {editing ? `Edit Delivery (${editing.id})` : 'Add Canadian Interprovincial Delivery'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-stone-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 block space-y-1">
                  <span className="font-medium text-stone-700">Destination City *</span>
                  <input
                    type="text"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Prov</span>
                  <input
                    type="text"
                    value={prov}
                    onChange={(e) => setProv(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Sales Amount (CAD) *</span>
                  <input
                    type="number"
                    min={1}
                    value={sales}
                    onChange={(e) => setSales(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Freight Expense (CAD) *</span>
                  <input
                    type="number"
                    min={0}
                    value={freight}
                    onChange={(e) => setFreight(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 block space-y-1">
                  <span className="font-medium text-stone-700">Customer Tax Label</span>
                  <input
                    type="text"
                    value={taxLabel}
                    onChange={(e) => setTaxLabel(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Tax Rate %</span>
                  <input
                    type="number"
                    step="0.001"
                    min={0}
                    value={taxRatePct}
                    onChange={(e) => setTaxRatePct(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Delivery Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Notes</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              {error && <div className="text-red-700 font-medium">{error}</div>}
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F04F25] px-4 py-2 font-semibold text-white"
                >
                  Save Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
