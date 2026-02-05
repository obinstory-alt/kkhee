
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Home as HomeIcon, 
  PlusCircle, 
  BarChart3, 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Trash2, 
  Calendar,
  Wallet,
  ArrowUpRight,
  ChevronRight,
  FileSpreadsheet,
  Save,
  CheckCircle2,
  Plus,
  X,
  List,
  AreaChart as ChartIcon,
  RefreshCw,
  Search,
  Database,
  Calculator
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts';
import { DailyReport, PlatformDailyEntry, MenuSale, ViewType, PlatformType, StatsPeriod, PlatformConfig } from './types';
import { INITIAL_PLATFORMS, INITIAL_MENUS, STORAGE_KEYS } from './constants';

declare const XLSX: any;

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('HOME');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [customMenus, setCustomMenus] = useState<string[]>(INITIAL_MENUS);
  const [platformConfigs, setPlatformConfigs] = useState<Record<PlatformType, PlatformConfig>>(INITIAL_PLATFORMS);
  
  // Draft State (Input System)
  const [draftEntries, setDraftEntries] = useState<PlatformDailyEntry[]>([]);
  const [draftMemo, setDraftMemo] = useState('');
  const [draftDate, setDraftDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // --- Core Data Logic: Scan & Consolidate ---
  const scanAndConsolidate = useCallback((manual = false) => {
    setIsScanning(true);
    let consolidated: DailyReport[] = [];
    
    // 1. Load Current v26 Data
    const currentData = localStorage.getItem(STORAGE_KEYS.REPORTS);
    if (currentData) {
      try { consolidated = JSON.parse(currentData); } catch(e) { console.error(e); }
    }

    // 2. Scan Legacy Keys
    STORAGE_KEYS.LEGACY.forEach(key => {
      const legacyData = localStorage.getItem(key);
      if (!legacyData) return;

      try {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            // Check if it's already a v26 format or needs conversion
            if (item.entries && Array.isArray(item.entries)) {
              consolidated.push(item);
            } else if (item.platform && item.totalAmount !== undefined) {
              // Convert v25 flat SaleRecord to v26 DailyReport
              const converted: DailyReport = {
                id: item.id || crypto.randomUUID(),
                date: item.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                entries: [{
                  platform: item.platform,
                  menuSales: [], 
                  platformTotalAmount: item.totalAmount,
                  platformTotalCount: 1, 
                  feeAmount: item.feeAmount || 0,
                  settlementAmount: item.settlementAmount || item.totalAmount
                }],
                totalAmount: item.totalAmount,
                totalCount: 1,
                memo: `Converted from legacy data (${key})`,
                createdAt: item.createdAt || Date.now()
              };
              consolidated.push(converted);
            }
          });
        }
      } catch (e) {
        console.warn(`Failed to parse legacy key: ${key}`, e);
      }
    });

    // 3. Deduplicate by ID and Sort by Date (Desc)
    const uniqueReports = Array.from(new Map(consolidated.map(r => [r.id, r])).values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setReports(uniqueReports);
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(uniqueReports));
    setIsScanning(false);
    if (manual) alert('과거 데이터 스캔 및 통합이 완료되었습니다.');
  }, []);

  // --- Initial Sync ---
  useEffect(() => {
    const loadConfig = () => {
      const savedMenus = localStorage.getItem(STORAGE_KEYS.CONFIG_MENUS);
      const savedConfigs = localStorage.getItem(STORAGE_KEYS.CONFIG_PLATFORMS);
      const savedDraft = localStorage.getItem(STORAGE_KEYS.DRAFT);

      if (savedMenus) setCustomMenus(JSON.parse(savedMenus));
      if (savedConfigs) setPlatformConfigs(JSON.parse(savedConfigs));
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setDraftEntries(parsed.entries || []);
        setDraftMemo(parsed.memo || '');
        setDraftDate(parsed.date || new Date().toISOString().split('T')[0]);
      }
    };
    loadConfig();
    scanAndConsolidate();
    setLoading(false);
  }, [scanAndConsolidate]);

  // --- Persistent Storage Helpers ---
  const saveReports = (newReports: DailyReport[]) => {
    setReports(newReports);
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(newReports));
  };

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify({ entries: draftEntries, memo: draftMemo, date: draftDate }));
    }
  }, [draftEntries, draftMemo, draftDate, loading]);

  // --- Home Metrics ---
  const homeMetrics = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
    const prevYear = curMonth === 0 ? curYear - 1 : curYear;

    const curMonthSales = reports.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    }).reduce((sum, r) => sum + r.totalAmount, 0);

    const prevMonthSales = reports.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    }).reduce((sum, r) => sum + r.totalAmount, 0);

    return { curMonthSales, prevMonthSales };
  }, [reports]);

  const recentSummary = useMemo(() => reports.slice(0, 5), [reports]);

  // --- Draft Aggregation Logic ---
  const draftMenuSummary = useMemo(() => {
    const summary: Record<string, { count: number, amount: number }> = {};
    draftEntries.forEach(entry => {
      entry.menuSales.forEach(sale => {
        if (!summary[sale.menuName]) {
          summary[sale.menuName] = { count: 0, amount: 0 };
        }
        summary[sale.menuName].count += sale.count;
        summary[sale.menuName].amount += sale.amount;
      });
    });
    return Object.entries(summary).sort((a, b) => b[1].amount - a[1].amount);
  }, [draftEntries]);

  // --- Input Logic ---
  const finalizeDailySettlement = () => {
    if (draftEntries.length === 0) {
      alert("입력된 데이터가 없습니다.");
      return;
    }
    const totalAmount = draftEntries.reduce((sum, e) => sum + e.platformTotalAmount, 0);
    const totalCount = draftEntries.reduce((sum, e) => sum + e.platformTotalCount, 0);

    const newReport: DailyReport = {
      id: crypto.randomUUID(),
      date: draftDate,
      entries: [...draftEntries],
      totalAmount,
      totalCount,
      memo: draftMemo,
      createdAt: Date.now()
    };

    saveReports([newReport, ...reports]);
    setDraftEntries([]);
    setDraftMemo('');
    localStorage.removeItem(STORAGE_KEYS.DRAFT);
    setView('HOME');
    alert("일정산이 성공적으로 마감되었습니다.");
  };

  // --- Excel Functions ---
  const downloadExcelTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ 날짜: '2024-01-01', 플랫폼: 'BAEMIN', 메뉴: '닭강정', 수량: 10, 금액: 150000 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "kyunghee_template.xlsx");
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const importedReports = Array.isArray(data) ? data : (data.reports || []);
        const combined = [...reports, ...importedReports];
        const unique = Array.from(new Map(combined.map(r => [r.id, r])).values())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        saveReports(unique);
        if (data.customMenus) {
          setCustomMenus(data.customMenus);
          localStorage.setItem(STORAGE_KEYS.CONFIG_MENUS, JSON.stringify(data.customMenus));
        }
        if (data.platformConfigs) {
          setPlatformConfigs(data.platformConfigs);
          localStorage.setItem(STORAGE_KEYS.CONFIG_PLATFORMS, JSON.stringify(data.platformConfigs));
        }
        alert('데이터를 성공적으로 복원했습니다.');
      } catch (e) {
        alert('파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  };

  // --- Stats Filter ---
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('DAILY');
  const [statsViewType, setStatsViewType] = useState<'LIST' | 'CHART'>('LIST');

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white selection:bg-blue-500/30">
      {/* Sidebar (Desktop) */}
      <nav className="hidden md:flex flex-col w-72 glass border-r border-white/10 p-6 space-y-6">
        <div className="text-2xl font-bold tracking-tighter px-2 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          경희장부 <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded ml-2">v26.0</span>
        </div>
        <div className="flex-1 space-y-1">
          <NavBtn icon={HomeIcon} label="홈" active={view === 'HOME'} onClick={() => setView('HOME')} />
          <NavBtn icon={PlusCircle} label="기록하기" active={view === 'INPUT'} onClick={() => setView('INPUT')} />
          <NavBtn icon={BarChart3} label="통계 분석" active={view === 'STATS'} onClick={() => setView('STATS')} />
          <NavBtn icon={SettingsIcon} label="설정" active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} />
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-6 scroll-smooth">
        <div className="max-w-4xl mx-auto px-6 pt-10">
          
          {/* VIEW: HOME */}
          {view === 'HOME' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-top-2 duration-500">
              <header className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold">오늘, {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</h1>
                  <p className="text-white/40 mt-1">실시간 정산 현황을 확인하세요.</p>
                </div>
                <div className="hidden md:block glass px-4 py-2 rounded-full text-xs font-medium text-white/60">
                  마지막 업데이트: {reports.length > 0 ? new Date(reports[0].createdAt).toLocaleTimeString() : '없음'}
                </div>
              </header>

              <div className="grid grid-cols-2 gap-4">
                <MetricCard 
                  label="전월 누적 매출" 
                  value={homeMetrics.prevMonthSales.toLocaleString()} 
                  icon={ArrowUpRight} 
                  color="text-white/40" 
                />
                <MetricCard 
                  label="당월 누적 매출" 
                  value={homeMetrics.curMonthSales.toLocaleString()} 
                  icon={Wallet} 
                  color="text-blue-500" 
                  highlight
                />
              </div>

              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xl font-bold">최근 매출 현황</h2>
                  <button onClick={() => setView('STATS')} className="text-xs text-blue-500 font-medium flex items-center">
                    전체 분석 <ChevronRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
                <div className="glass apple-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="py-4 px-4 text-left font-medium text-white/40">날짜</th>
                        <th className="py-4 px-4 text-right font-medium text-white/40">매출액</th>
                        <th className="py-4 px-4 text-right font-medium text-white/40">건수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentSummary.map(r => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 text-white/80">{r.date}</td>
                          <td className="py-4 px-4 text-right font-bold">{r.totalAmount.toLocaleString()}원</td>
                          <td className="py-4 px-4 text-right text-white/40">{r.totalCount}건</td>
                        </tr>
                      ))}
                      {recentSummary.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-white/20 italic">입력된 매출 데이터가 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* VIEW: INPUT */}
          {view === 'INPUT' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">일정산 마감</h1>
                <div className="flex gap-2">
                  <button onClick={downloadExcelTemplate} className="glass px-4 py-2 rounded-xl text-xs flex items-center gap-2 hover:bg-white/10 transition-all">
                    <Download className="w-3 h-3" /> 양식 다운로드
                  </button>
                  <button className="glass px-4 py-2 rounded-xl text-xs flex items-center gap-2 hover:bg-white/10 transition-all">
                    <Upload className="w-3 h-3" /> 엑셀 업로드
                  </button>
                </div>
              </header>

              <div className="glass apple-card p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-white/40 ml-1">정산 날짜</label>
                    <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} className="w-full text-lg font-medium" />
                  </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-bold text-white/40 flex items-center gap-2 px-1">
                    <PlusCircle className="w-4 h-4" /> 플랫폼별 입력
                   </h3>
                   <div className="grid grid-cols-1 gap-3">
                      <PlatformInputSection 
                        menus={customMenus} 
                        configs={platformConfigs}
                        onAddEntry={(entry) => setDraftEntries([...draftEntries.filter(e => e.platform !== entry.platform), entry])}
                        existingEntries={draftEntries}
                      />
                   </div>
                </div>

                {/* 메뉴별 판매 합계 섹션 (추가 요청 사항) */}
                {draftEntries.length > 0 && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <label className="text-xs font-bold text-white/40 ml-1 flex items-center gap-2">
                      <Calculator className="w-3 h-3 text-blue-500" /> 오늘의 메뉴별 판매 합계 (모든 플랫폼 합산)
                    </label>
                    <div className="glass apple-card overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead className="bg-white/5 border-b border-white/5">
                          <tr>
                            <th className="p-3 text-left font-medium text-white/40">메뉴명</th>
                            <th className="p-3 text-right font-medium text-white/40">판매량</th>
                            <th className="p-3 text-right font-medium text-white/40">매출액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {draftMenuSummary.map(([name, data]) => (
                            <tr key={name} className="hover:bg-white/5 transition-colors">
                              <td className="p-3 font-medium text-white/80">{name}</td>
                              <td className="p-3 text-right">{data.count.toLocaleString()}건</td>
                              <td className="p-3 text-right font-bold">{data.amount.toLocaleString()}원</td>
                            </tr>
                          ))}
                          <tr className="bg-blue-600/10 font-bold">
                            <td className="p-3 text-blue-400">전체 합계</td>
                            <td className="p-3 text-right text-blue-400">
                              {draftMenuSummary.reduce((s, d) => s + d[1].count, 0).toLocaleString()}건
                            </td>
                            <td className="p-3 text-right text-blue-400">
                              {draftMenuSummary.reduce((s, d) => s + d[1].amount, 0).toLocaleString()}원
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 ml-1">특이사항 메모</label>
                  <textarea 
                    value={draftMemo}
                    onChange={e => setDraftMemo(e.target.value)}
                    placeholder="오늘의 특이사항을 적어주세요 (예: 단체주문 2건, 우천 등)"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500 h-24 resize-none"
                  />
                </div>

                <button 
                  onClick={finalizeDailySettlement}
                  disabled={draftEntries.length === 0}
                  className="w-full bg-blue-600 disabled:bg-white/5 disabled:text-white/20 hover:bg-blue-500 active:scale-[0.98] py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/20 transition-all"
                >
                  오늘 정산 마감하기
                </button>
              </div>
            </div>
          )}

          {/* VIEW: STATS */}
          {view === 'STATS' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">통계 분석</h1>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  <button 
                    onClick={() => setStatsViewType('LIST')} 
                    className={`p-2 rounded-lg transition-all ${statsViewType === 'LIST' ? 'bg-white/10 text-white' : 'text-white/30'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setStatsViewType('CHART')} 
                    className={`p-2 rounded-lg transition-all ${statsViewType === 'CHART' ? 'bg-white/10 text-white' : 'text-white/30'}`}
                  >
                    <ChartIcon className="w-4 h-4" />
                  </button>
                </div>
              </header>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as StatsPeriod[]).map(p => (
                  <button 
                    key={p} 
                    onClick={() => setStatsPeriod(p)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${statsPeriod === p ? 'bg-blue-600 text-white' : 'glass text-white/40'}`}
                  >
                    {p === 'DAILY' ? '일별' : p === 'WEEKLY' ? '주별' : p === 'MONTHLY' ? '월별' : '연별'}
                  </button>
                ))}
              </div>

              {statsViewType === 'LIST' ? (
                <div className="glass apple-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/5">
                      <tr>
                        <th className="p-4 text-left text-white/40">기간</th>
                        <th className="p-4 text-right text-white/40">총 매출</th>
                        <th className="p-4 text-right text-white/40">주문수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {reports.map(r => (
                        <tr key={r.id}>
                          <td className="p-4 font-medium">{r.date}</td>
                          <td className="p-4 text-right font-bold">{r.totalAmount.toLocaleString()}원</td>
                          <td className="p-4 text-right text-white/40">{r.totalCount}건</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="glass apple-card p-6 h-80">
                      <h3 className="text-sm font-bold mb-6 text-white/40">매출 변동 추이</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={reports.slice().reverse()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" hide />
                          <YAxis hide />
                          <Tooltip contentStyle={{background: '#111', border: 'none', borderRadius: '12px'}} />
                          <Area type="monotone" dataKey="totalAmount" stroke="#3b82f6" fillOpacity={0.1} fill="#3b82f6" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              )}

              <button className="w-full glass py-4 rounded-2xl flex items-center justify-center gap-2 text-white/60 hover:text-white transition-all">
                <FileSpreadsheet className="w-5 h-5" /> 분석 데이터 엑셀 다운로드
              </button>
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {view === 'SETTINGS' && (
            <div className="space-y-10 animate-in fade-in duration-500 pb-20">
              <h1 className="text-3xl font-bold">설정 및 관리</h1>
              
              <section className="space-y-4">
                <h2 className="text-lg font-bold px-1 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" /> 데이터 복원 및 보존
                </h2>
                <div className="glass apple-card p-6 space-y-6">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex-1">
                      <div className="font-bold flex items-center gap-2">
                        과거 데이터 자동 스캔 엔진
                        {isScanning && <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />}
                      </div>
                      <p className="text-xs text-white/40 mt-1 leading-relaxed">
                        앱이 구동될 때 브라우저의 localStorage를 전수 조사하여 
                        kh_sales_v24_final, kh_sales_v24, sales_data 등 과거 파편화된 데이터를 통합합니다.
                        중복된 항목은 ID 기준으로 자동 합산 및 정렬됩니다.
                      </p>
                    </div>
                    <button 
                      onClick={() => scanAndConsolidate(true)}
                      className="whitespace-nowrap bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                    >
                      <Search className="w-4 h-4" /> 데이터 수동 스캔
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <button 
                       onClick={() => {
                         const blob = new Blob([JSON.stringify({reports, customMenus, platformConfigs}, null, 2)], { type: 'application/json' });
                         const url = URL.createObjectURL(blob);
                         const a = document.createElement('a');
                         a.href = url;
                         a.download = `kyunghee-backup-${new Date().toISOString().split('T')[0]}.json`;
                         a.click();
                       }}
                       className="glass py-4 rounded-2xl flex items-center justify-center gap-3 text-white/80 hover:bg-white/10 transition-all font-bold text-sm"
                    >
                      <Download className="w-5 h-5 text-blue-500" /> 전체 데이터 내보내기 (JSON)
                    </button>
                    <label className="glass py-4 rounded-2xl flex items-center justify-center gap-3 text-white/80 hover:bg-white/10 transition-all font-bold text-sm cursor-pointer">
                      <Upload className="w-5 h-5 text-emerald-500" /> 백업 파일 불러오기 (Import)
                      <input type="file" className="hidden" accept=".json" onChange={importData} />
                    </label>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold px-1">메뉴 관리</h2>
                <div className="glass apple-card p-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {customMenus.map(m => (
                      <div key={m} className="bg-white/5 px-4 py-2 rounded-xl flex items-center gap-2 border border-white/5">
                        <span className="text-sm">{m}</span>
                        <button onClick={() => setCustomMenus(customMenus.filter(x => x !== m))} className="text-white/20 hover:text-rose-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input id="new-menu" type="text" placeholder="새 메뉴 이름" className="flex-1 text-sm py-3" />
                    <button 
                      onClick={() => {
                        const val = (document.getElementById('new-menu') as HTMLInputElement).value;
                        if(val) {
                          setCustomMenus([...customMenus, val]);
                          localStorage.setItem(STORAGE_KEYS.CONFIG_MENUS, JSON.stringify([...customMenus, val]));
                          (document.getElementById('new-menu') as HTMLInputElement).value = '';
                        }
                      }}
                      className="bg-white/10 px-4 rounded-xl hover:bg-white/20"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold px-1">플랫폼 수수료 설정</h2>
                <div className="glass apple-card overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {Object.values(platformConfigs).map(p => (
                      <div key={p.id} className="p-4 flex items-center justify-between">
                        <span className="font-medium">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            step="0.1"
                            value={p.feeRate * 100}
                            onChange={(e) => {
                              const newRate = Number(e.target.value) / 100;
                              const newConfigs = {...platformConfigs, [p.id]: {...p, feeRate: newRate}};
                              setPlatformConfigs(newConfigs);
                              localStorage.setItem(STORAGE_KEYS.CONFIG_PLATFORMS, JSON.stringify(newConfigs));
                            }}
                            className="w-16 text-right py-1 px-2 text-xs"
                          />
                          <span className="text-xs text-white/40">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <div className="space-y-4 pt-10 border-t border-white/5">
                <div className="glass apple-card p-6 flex items-center justify-between text-rose-500">
                  <div>
                    <div className="font-bold">데이터 초기화</div>
                    <p className="text-xs opacity-60">브라우저의 모든 기록이 영구 삭제됩니다.</p>
                  </div>
                  <button onClick={() => { if(confirm('영구 삭제하시겠습니까?')) saveReports([]); }} className="p-3 bg-rose-500/10 rounded-full hover:bg-rose-500/20 transition-all">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="text-center text-white/20 text-[10px] py-10">
                경희장부 Premium Settlement System v26.0<br/>
                Designed by Apple-style UX Lab
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Tab Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/10 h-20 px-6 flex items-center justify-around z-50">
        <TabBtn icon={HomeIcon} label="홈" active={view === 'HOME'} onClick={() => setView('HOME')} />
        <TabBtn icon={PlusCircle} label="기록" active={view === 'INPUT'} onClick={() => setView('INPUT')} />
        <TabBtn icon={BarChart3} label="통계" active={view === 'STATS'} onClick={() => setView('STATS')} />
        <TabBtn icon={SettingsIcon} label="설정" active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} />
      </nav>
    </div>
  );
};

// --- Sub Components ---

const MetricCard: React.FC<{ label: string, value: string, icon: any, color: string, highlight?: boolean }> = ({ label, value, icon: Icon, color, highlight }) => (
  <div className={`glass apple-card p-5 space-y-3 transition-all ${highlight ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''}`}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</span>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-bold tracking-tight">{value}</span>
      <span className="text-xs text-white/20">원</span>
    </div>
  </div>
);

const NavBtn: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white hover:bg-white/5'}`}>
    <Icon className={`w-5 h-5 ${active ? 'text-blue-500' : ''}`} />
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

const TabBtn: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-500' : 'text-white/30'}`}>
    <Icon className={`w-6 h-6 ${active ? 'scale-110' : ''}`} />
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const PlatformInputSection: React.FC<{ 
  menus: string[], 
  configs: Record<PlatformType, PlatformConfig>,
  onAddEntry: (entry: PlatformDailyEntry) => void,
  existingEntries: PlatformDailyEntry[]
}> = ({ menus, configs, onAddEntry, existingEntries }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('BAEMIN');
  const [menuData, setMenuData] = useState<Record<string, { count: string, amount: string }>>({});

  const activeEntry = existingEntries.find(e => e.platform === selectedPlatform);

  useEffect(() => {
    if (activeEntry) {
      const data: any = {};
      activeEntry.menuSales.forEach(s => {
        data[s.menuName] = { count: s.count.toString(), amount: s.amount.toString() };
      });
      setMenuData(data);
    } else {
      setMenuData({});
    }
  }, [selectedPlatform, activeEntry]);

  const handleSavePlatform = () => {
    const sales: MenuSale[] = Object.entries(menuData).map(([name, data]) => ({
      menuName: name,
      count: Number(data.count) || 0,
      amount: Number(data.amount) || 0
    })).filter(s => s.count > 0 || s.amount > 0);

    const platformTotalAmount = sales.reduce((sum, s) => sum + s.amount, 0);
    const platformTotalCount = sales.reduce((sum, s) => sum + s.count, 0);
    const feeAmount = Math.floor(platformTotalAmount * configs[selectedPlatform].feeRate);

    onAddEntry({
      platform: selectedPlatform,
      menuSales: sales,
      platformTotalAmount,
      platformTotalCount,
      feeAmount,
      settlementAmount: platformTotalAmount - feeAmount
    });
    alert(`${configs[selectedPlatform].name} 데이터가 임시 저장되었습니다.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(Object.keys(configs) as PlatformType[]).map(pt => (
          <button 
            key={pt}
            onClick={() => setSelectedPlatform(pt)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${selectedPlatform === pt ? 'bg-white/10 border-blue-500/50 text-white' : 'glass border-white/5 text-white/30'}`}
          >
            {configs[pt].name} {existingEntries.some(e => e.platform === pt) && '✓'}
          </button>
        ))}
      </div>

      <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
        {menus.map(menu => (
          <div key={menu} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4 text-sm font-medium text-white/80">{menu}</div>
            <div className="col-span-3">
              <input 
                type="number" 
                placeholder="건수" 
                className="w-full text-center py-2 text-xs" 
                value={menuData[menu]?.count || ''}
                onChange={e => setMenuData({...menuData, [menu]: { ...menuData[menu], count: e.target.value }})}
              />
            </div>
            <div className="col-span-5 relative">
              <input 
                type="number" 
                placeholder="금액" 
                className="w-full pr-6 py-2 text-xs" 
                value={menuData[menu]?.amount || ''}
                onChange={e => setMenuData({...menuData, [menu]: { ...menuData[menu], amount: e.target.value }})}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/20">원</span>
            </div>
          </div>
        ))}
        <button 
          onClick={handleSavePlatform}
          className="w-full mt-2 py-3 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 flex items-center justify-center gap-2"
        >
          <Save className="w-3 h-3 text-blue-500" /> {configs[selectedPlatform].name} 임시 저장
        </button>
      </div>
      
      {existingEntries.length > 0 && (
        <div className="p-3 bg-blue-500/10 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span className="text-[10px] font-medium text-blue-300">현재 {existingEntries.length}개 플랫폼이 마감 준비되었습니다.</span>
        </div>
      )}
    </div>
  );
};

export default App;
