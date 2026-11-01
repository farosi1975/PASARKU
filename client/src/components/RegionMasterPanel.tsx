import { useEffect, useMemo, useState } from "react";
import { Check, Edit3, MapPin, Save, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type RegionLevel = "regency" | "district" | "village";

type RegionMasterPanelProps = {
  sessionToken: string;
};

const keyFor = (level: string, code: string) => `${level}:${code}`;

export function RegionMasterPanel({ sessionToken }: RegionMasterPanelProps) {
  const [selectedRegencyCode, setSelectedRegencyCode] = useState("3518");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("351803");
  const [villageSearch, setVillageSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const master = trpc.marketplace.regionMaster.useQuery({ sessionToken }, { refetchInterval: 30000 });
  const updateRegion = trpc.marketplace.updateRegionMaster.useMutation();
  const toggleRegion = trpc.marketplace.setRegionOperational.useMutation();
  const utils = trpc.useUtils();

  const regencies = master.data?.regencies ?? [];
  const districts = master.data?.districts ?? [];
  const villages = master.data?.villages ?? [];
  const selectedRegency = regencies.find((item) => item.code === selectedRegencyCode) ?? regencies[0];
  const selectedDistrict = districts.find((item) => item.code === selectedDistrictCode) ?? districts.find((item) => item.regencyCode === selectedRegency?.code);
  const visibleDistricts = useMemo(() => districts.filter((item) => item.regencyCode === selectedRegency?.code), [districts, selectedRegency?.code]);
  const visibleVillages = useMemo(() => villages.filter((item) => item.districtCode === selectedDistrict?.code && item.name.toLowerCase().includes(villageSearch.toLowerCase().trim())), [villages, selectedDistrict?.code, villageSearch]);
  const activeCounts = useMemo(() => ({
    regencies: regencies.filter((item) => item.isOperational === 1).length,
    districts: districts.filter((item) => item.isOperational === 1).length,
    villages: villages.filter((item) => item.isOperational === 1).length,
  }), [regencies, districts, villages]);

  useEffect(() => {
    if (!selectedRegencyCode && regencies[0]) setSelectedRegencyCode(regencies[0].code);
    if (selectedRegencyCode && !regencies.some((item) => item.code === selectedRegencyCode) && regencies[0]) setSelectedRegencyCode(regencies[0].code);
  }, [regencies, selectedRegencyCode]);

  useEffect(() => {
    const matching = districts.find((item) => item.code === selectedDistrictCode && item.regencyCode === selectedRegency?.code) ?? visibleDistricts[0];
    if (matching && matching.code !== selectedDistrictCode) setSelectedDistrictCode(matching.code);
  }, [districts, selectedDistrictCode, selectedRegency?.code, visibleDistricts]);

  const valueFor = (level: string, code: string, original: string) => drafts[keyFor(level, code)] ?? original;
  const setDraft = (level: string, code: string, value: string) => setDrafts((current) => ({ ...current, [keyFor(level, code)]: value }));

  const save = (level: RegionLevel, code: string, originalName: string, extra?: { capital?: string; type?: string }) => {
    const name = valueFor(level, code, originalName).trim();
    if (name.length < 2) return toast.error("Nama wilayah minimal 2 karakter.");
    updateRegion.mutate({ sessionToken, level, code, name, ...extra }, {
      onSuccess: async () => {
        setDrafts((current) => { const next = { ...current }; delete next[keyFor(level, code)]; if (level === "regency") delete next[keyFor("regency-capital", code)]; return next; });
        await utils.marketplace.regionMaster.invalidate();
        toast.success("Master wilayah disimpan.");
      },
      onError: (error) => toast.error("Perubahan belum disimpan", { description: error.message }),
    });
  };

  const toggle = (level: RegionLevel, code: string, isOperational: number) => {
    toggleRegion.mutate({ sessionToken, level, code, isOperational: isOperational !== 1 }, {
      onSuccess: async () => { await utils.marketplace.regionMaster.invalidate(); toast.success(isOperational === 1 ? "Wilayah dinonaktifkan." : "Wilayah diaktifkan."); },
      onError: (error) => toast.error("Status wilayah belum berubah", { description: error.message }),
    });
  };

  if (master.isLoading) return <section className="admin-region-panel"><div className="panel-heading"><div><h3>Master wilayah</h3><p>Memuat data kabupaten, kecamatan, dan desa…</p></div><MapPin size={18} /></div></section>;
  if (master.isError) return <section className="admin-region-panel"><div className="panel-heading"><div><h3>Master wilayah</h3><p>Data wilayah belum dapat dimuat. Coba buka ulang panel Admin.</p></div><MapPin size={18} /></div></section>;

  return <section className="admin-region-panel">
    <div className="panel-heading">
      <div><div className="eyebrow">Data wilayah terstruktur</div><h3>Master wilayah Jawa Timur</h3><p>Data resmi tersimpan terpisah dari user, toko, kurir, pesanan, dan produk lama.</p></div>
      <MapPin size={18} />
    </div>
    <div className="region-safety-note"><ShieldCheck size={16} /><span><strong>Aman untuk pilot:</strong> hanya Kabupaten Nganjuk, Kecamatan Sawahan, dan desa di dalamnya yang aktif. Kode wilayah tidak dapat diedit agar relasi data tetap aman.</span></div>
    <div className="region-stats"><div><strong>{regencies.length}</strong><span>Kabupaten/kota</span><small>{activeCounts.regencies} aktif</small></div><div><strong>{districts.length}</strong><span>Kecamatan</span><small>{activeCounts.districts} aktif</small></div><div><strong>{villages.length}</strong><span>Desa/kelurahan</span><small>{activeCounts.villages} aktif</small></div></div>
    <div className="region-selector-grid">
      <label>Kabupaten/kota<select value={selectedRegency?.code ?? ""} onChange={(event) => setSelectedRegencyCode(event.target.value)}>{regencies.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select></label>
      <label>Kecamatan<select value={selectedDistrict?.code ?? ""} onChange={(event) => setSelectedDistrictCode(event.target.value)}>{visibleDistricts.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    </div>
    {selectedRegency && <div className="region-edit-card"><div className="region-edit-heading"><div><span className="region-code">{selectedRegency.code}</span><strong>Kabupaten/kota</strong></div><button type="button" className={`region-toggle ${selectedRegency.isOperational ? "is-active" : ""}`} onClick={() => toggle("regency", selectedRegency.code, selectedRegency.isOperational)} disabled={toggleRegion.isPending}>{selectedRegency.isOperational ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}{selectedRegency.isOperational ? "Aktif" : "Nonaktif"}</button></div><div className="region-edit-fields"><label>Nama<input value={valueFor("regency", selectedRegency.code, selectedRegency.name)} onChange={(event) => setDraft("regency", selectedRegency.code, event.target.value)} /></label><label>Ibu kota<input value={valueFor("regency-capital", selectedRegency.code, selectedRegency.capital ?? "")} onChange={(event) => setDraft("regency-capital", selectedRegency.code, event.target.value)} /></label><button type="button" className="outline-button" onClick={() => save("regency", selectedRegency.code, selectedRegency.name, { capital: drafts[keyFor("regency-capital", selectedRegency.code)] ?? selectedRegency.capital ?? "" })} disabled={updateRegion.isPending}><Save size={14} /> Simpan</button></div></div>}
    {selectedDistrict && <div className="region-edit-card"><div className="region-edit-heading"><div><span className="region-code">{selectedDistrict.code}</span><strong>Kecamatan {selectedDistrict.name}</strong></div><button type="button" className={`region-toggle ${selectedDistrict.isOperational ? "is-active" : ""}`} onClick={() => toggle("district", selectedDistrict.code, selectedDistrict.isOperational)} disabled={toggleRegion.isPending}>{selectedDistrict.isOperational ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}{selectedDistrict.isOperational ? "Aktif" : "Nonaktif"}</button></div><div className="region-edit-fields"><label>Nama kecamatan<input value={valueFor("district", selectedDistrict.code, selectedDistrict.name)} onChange={(event) => setDraft("district", selectedDistrict.code, event.target.value)} /></label><button type="button" className="outline-button" onClick={() => save("district", selectedDistrict.code, selectedDistrict.name)} disabled={updateRegion.isPending}><Save size={14} /> Simpan nama</button></div></div>}
    {selectedDistrict && <div className="region-villages-card"><div className="region-villages-heading"><div><strong>Desa/kelurahan di {selectedDistrict.name}</strong><small>Gunakan nonaktifkan, bukan hapus, bila data belum digunakan.</small></div><input value={villageSearch} onChange={(event) => setVillageSearch(event.target.value)} placeholder="Cari desa…" aria-label="Cari desa" /></div><div className="region-village-list">{visibleVillages.map((village) => <div className="region-village-row" key={village.code}><div><span className="region-code">{village.code}</span><small>{village.type}</small></div><input value={valueFor("village", village.code, village.name)} onChange={(event) => setDraft("village", village.code, event.target.value)} aria-label={`Nama ${village.name}`} /><button type="button" className={`region-toggle ${village.isOperational ? "is-active" : ""}`} onClick={() => toggle("village", village.code, village.isOperational)} disabled={toggleRegion.isPending}>{village.isOperational ? <><Check size={14} /> Aktif</> : "Nonaktif"}</button><button type="button" className="icon-outline-button" onClick={() => save("village", village.code, village.name, { type: village.type })} disabled={updateRegion.isPending} title="Simpan nama desa" aria-label={`Simpan nama ${village.name}`}><Edit3 size={15} /></button></div>)}{!visibleVillages.length && <div className="region-empty">Tidak ada desa yang cocok.</div>}</div></div>}
    <div className="region-footer-note"><Check size={15} /> Perubahan nama dan status tercatat dalam Riwayat aktivitas Admin.</div>
  </section>;
}
