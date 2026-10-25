import { useMemo, useState } from "react";
import { Download, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const rupiah = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ entryDate: today(), voucherNo: "", category: "Pendapatan Iklan/Banner", description: "", income: "", expense: "", pphStatus: "Objek PPh 0.5%" as const, paymentStatus: "Sudah Diterima" as const, billingCode: "", merchantName: "" });
type EntryForm = ReturnType<typeof blank>;
type Props = { sessionToken: string };

export function TaxLedgerPanel({ sessionToken }: Props) {
  const year = new Date().getFullYear();
  const entries = trpc.marketplace.taxCashEntries.useQuery({ sessionToken, year }, { refetchInterval: 30000 });
  const sync = trpc.marketplace.syncTaxCashEntries.useMutation();
  const create = trpc.marketplace.createTaxCashEntry.useMutation();
  const update = trpc.marketplace.updateTaxCashEntry.useMutation();
  const remove = trpc.marketplace.deleteTaxCashEntry.useMutation();
  const [form, setForm] = useState<EntryForm>(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const data = entries.data ?? [];
  const report = useMemo(() => Array.from({ length: 12 }, (_, month) => {
    const monthEntries = data.filter((entry) => Number(entry.entryDate.slice(5, 7)) === month + 1);
    const omzet = monthEntries.filter((entry) => entry.pphStatus === "Objek PPh 0.5%").reduce((sum, entry) => sum + entry.income, 0);
    return { month: new Date(year, month, 1).toLocaleDateString("id-ID", { month: "long" }), omzet, tax: Math.round(omzet * 0.005) };
  }), [data, year]);
  const totals = useMemo(() => ({ income: data.reduce((sum, entry) => sum + entry.income, 0), expense: data.reduce((sum, entry) => sum + entry.expense, 0), omzet: report.reduce((sum, row) => sum + row.omzet, 0), tax: report.reduce((sum, row) => sum + row.tax, 0) }), [data, report]);
  const setField = (key: keyof EntryForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setForm(blank()); setEditingId(null); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { sessionToken, entryDate: form.entryDate, voucherNo: form.voucherNo, category: form.category, description: form.description, income: Number(form.income || 0), expense: Number(form.expense || 0), pphStatus: form.pphStatus, paymentStatus: form.paymentStatus, billingCode: form.billingCode || undefined, merchantName: form.merchantName || undefined };
    const options = { onSuccess: () => { entries.refetch(); reset(); toast.success(editingId ? "Catatan kas diperbarui" : "Catatan kas ditambahkan"); }, onError: (error: { message: string }) => toast.error("Catatan kas belum tersimpan", { description: error.message }) };
    if (editingId) update.mutate({ ...payload, id: editingId }, options); else create.mutate(payload, options);
  };
  const startEdit = (entry: (typeof data)[number]) => { if (entry.sourceType !== "manual") return toast("Catatan otomatis hanya dapat diperbaiki dari sumber transaksinya."); setEditingId(entry.id); setForm({ entryDate: entry.entryDate, voucherNo: entry.voucherNo, category: entry.category, description: entry.description, income: String(entry.income), expense: String(entry.expense), pphStatus: entry.pphStatus as EntryForm["pphStatus"], paymentStatus: entry.paymentStatus as EntryForm["paymentStatus"], billingCode: entry.billingCode || "", merchantName: entry.merchantName || "" }); };
  const syncEntries = () => sync.mutate({ sessionToken }, { onSuccess: (result) => { entries.refetch(); toast.success("Kas otomatis disinkronkan", { description: `${result.created} catatan pesanan selesai ditambahkan.` }); }, onError: (error) => toast.error("Sinkronisasi gagal", { description: error.message }) });
  const exportExcel = () => {
    const cashRows: Array<Array<string | number>> = [["PT PASAR SARANA KARYA - BUKU KAS & TRANSAKSI HARIAN"], ["Pencatatan komisi PASARKU, pendapatan banner, dan pengeluaran operasional"], [], ["Tanggal", "No. Bukti / Invoice", "Kategori Transaksi", "Keterangan / Uraian", "Pemasukan (Masuk)", "Pengeluaran (Keluar)", "Saldo Kas/Bank", "Status PPh 0,5%", "Status Pembayaran", "Merchant"]];
    let saldo = 0;
    data.forEach((entry) => { saldo += entry.income - entry.expense; cashRows.push([entry.entryDate, entry.voucherNo, entry.category, entry.description, entry.income, entry.expense, saldo, entry.pphStatus, entry.paymentStatus, entry.merchantName || ""]); });
    const reportRows: Array<Array<string | number>> = [["PT PASAR SARANA KARYA - REKAPITULASI OMZET & PPh FINAL 0,5%"], [`Tahun ${year}`], [], ["No", "Masa Pajak (Bulan)", "Total Pendapatan / Omzet", "Tarif PPh", "PPh Final 0,5% Terutang", "Status Pembayaran", "Kode Billing / NTPN"]];
    report.forEach((row, index) => reportRows.push([index + 1, row.month, row.omzet, 0.005, row.tax, row.tax ? "Belum Dibayar" : "Nihil", "-" ]));
    reportRows.push([], ["", "TOTAL TAHUN", totals.omzet, "-", totals.tax, "", ""]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(cashRows), "Buku Kas Utama");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(reportRows), `Rekap PPh ${year}`);
    XLSX.writeFile(workbook, `PASARKU_Buku_Kas_Pajak_${year}.xlsx`);
    toast.success("File Excel berhasil dibuat");
  };
  return <section className="admin-tax-panel">
    <div className="panel-heading"><div><div className="eyebrow">Keuangan & pajak</div><h3>Buku Kas dan Rekap PPh {year}</h3><p>Komisi hanya dihitung dari biaya penanganan pesanan berstatus Selesai. Pendapatan banner dicatat manual sebagai transaksi iklan.</p></div><Download size={18} /></div>
    <div className="tax-summary-grid"><div><small>Total pemasukan</small><strong>{rupiah(totals.income)}</strong></div><div><small>Total pengeluaran</small><strong>{rupiah(totals.expense)}</strong></div><div><small>Omzet objek PPh</small><strong>{rupiah(totals.omzet)}</strong></div><div><small>PPh 0,5% terutang</small><strong>{rupiah(totals.tax)}</strong></div></div>
    <div className="tax-actions"><button className="outline-button" type="button" onClick={syncEntries} disabled={sync.isPending}><RefreshCw size={15} /> {sync.isPending ? "Menyinkronkan..." : "Sinkronkan pesanan selesai"}</button><button className="primary-button" type="button" onClick={exportExcel}><Download size={15} /> Export Excel</button></div>
    <form className="tax-entry-form" onSubmit={submit}><div className="tax-form-heading"><strong>{editingId ? "Edit catatan kas manual" : "Tambah pemasukan/pengeluaran"}</strong>{editingId && <button type="button" className="branding-remove-button" onClick={reset}><X size={14} /> Batal</button>}</div><div className="tax-form-grid"><label>Tanggal<input type="date" value={form.entryDate} onChange={(event) => setField("entryDate", event.target.value)} /></label><label>No. bukti / invoice<input required value={form.voucherNo} onChange={(event) => setField("voucherNo", event.target.value)} placeholder="IKL-001" /></label><label>Kategori<select value={form.category} onChange={(event) => setField("category", event.target.value)}><option>Pendapatan Iklan/Banner</option><option>Pendapatan Komisi</option><option>Modal Disetor</option><option>Beban Operasional</option><option>Lainnya</option></select></label><label>Merchant / pihak terkait<input value={form.merchantName} onChange={(event) => setField("merchantName", event.target.value)} placeholder="Nama merchant" /></label><label>Pemasukan<input type="number" min="0" value={form.income} onChange={(event) => setField("income", event.target.value)} /></label><label>Pengeluaran<input type="number" min="0" value={form.expense} onChange={(event) => setField("expense", event.target.value)} /></label><label>Status PPh<select value={form.pphStatus} onChange={(event) => setField("pphStatus", event.target.value)}><option>Objek PPh 0.5%</option><option>Bukan Omzet</option></select></label><label>Status pembayaran<select value={form.paymentStatus} onChange={(event) => setField("paymentStatus", event.target.value)}><option>Sudah Diterima</option><option>Belum Dibayar</option><option>Nihil</option></select></label><label className="wide-field">Keterangan<textarea required rows={2} value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Uraian transaksi" /></label><label>Kode billing / NTPN<input value={form.billingCode} onChange={(event) => setField("billingCode", event.target.value)} /></label></div><button className="primary-button" type="submit" disabled={create.isPending || update.isPending}>{editingId ? <Save size={15} /> : <Plus size={15} />} {editingId ? "Simpan perubahan" : "Tambah catatan"}</button></form>
    <div className="tax-table-wrap"><table className="admin-data-table"><thead><tr><th>Tanggal</th><th>Bukti</th><th>Kategori / uraian</th><th>Masuk</th><th>Keluar</th><th>PPh</th><th>Sumber</th><th>Aksi</th></tr></thead><tbody>{data.map((entry) => <tr key={entry.id}><td>{entry.entryDate}</td><td><strong>{entry.voucherNo}</strong></td><td><strong>{entry.category}</strong><small>{entry.description}</small></td><td>{rupiah(entry.income)}</td><td>{rupiah(entry.expense)}</td><td>{entry.pphStatus}</td><td>{entry.sourceType === "order" ? "Pesanan selesai" : entry.sourceType === "promo" ? "Banner promo" : "Manual"}</td><td>{entry.sourceType === "manual" && <><button type="button" className="user-action-button edit" onClick={() => startEdit(entry)}><Pencil size={13} /></button><button type="button" className="user-action-button delete" onClick={() => { if (window.confirm("Hapus catatan kas ini?")) remove.mutate({ sessionToken, id: entry.id }, { onSuccess: () => { entries.refetch(); toast.success("Catatan kas dihapus"); }, onError: (error) => toast.error("Catatan belum dihapus", { description: error.message }) }); }}><Trash2 size={13} /></button></>}</td></tr>)}</tbody></table>{!data.length && <div className="table-empty"><Download size={22} /><strong>Belum ada catatan tahun {year}</strong><span>Tekan sinkronisasi atau tambahkan transaksi banner secara manual.</span></div>}</div>
    <div className="tax-report-grid"><div><strong>Rekap PPh bulanan</strong>{report.map((row) => <div className="tax-report-row" key={row.month}><span>{row.month}</span><b>{rupiah(row.omzet)}</b><small>{rupiah(row.tax)}</small></div>)}</div></div>
  </section>;
}
