// src/app/SearchForm.tsx
"use client";

import { useEffect, useRef } from 'react';

// 親(page.tsx)から受け取るデータの型定義
type Props = {
  departureStation: string;
  setDepartureStation: (value: string) => void;
  suggestions: any[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  setCurrentCoords: (coords: { lat: number, lon: number } | null) => void;
  setResultStation: (station: any) => void;
  maxTime: string;
  setMaxTime: (time: string) => void;
  selectedPref: string;
  setSelectedPref: (pref: string) => void;
  displayPrefectures: string[];
  lines: string[];
  selectedLine: string;
  setSelectedLine: (line: string) => void;
  loading: boolean;
  currentCoords: { lat: number, lon: number } | null;
  handleGacha: () => void;
};

export default function SearchForm({
  departureStation,
  setDepartureStation,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  setCurrentCoords,
  setResultStation,
  maxTime,
  setMaxTime,
  selectedPref,
  setSelectedPref,
  displayPrefectures,
  lines,
  selectedLine,
  setSelectedLine,
  loading,
  currentCoords,
  handleGacha,
}: Props) {

  // クリック検知用のRefはこのコンポーネントの中で管理する
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 外側クリックでリストを閉じる処理
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setShowSuggestions]);

  return (
    <div className="space-y-6">
      {/* 出発駅入力フォーム */}
      <div className="relative" ref={wrapperRef}>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          出発駅（現在地）
          <span className="text-red-500 text-xs ml-2 font-bold">必須</span>
        </label>
        <input
          type="text"
          placeholder="例: 新宿"
          className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 text-slate-900 focus:ring-indigo-500 outline-none transition-all"
          value={departureStation}
          onChange={(e) => {
            setDepartureStation(e.target.value);
            setShowSuggestions(false);
            setCurrentCoords(null);
            setResultStation(null);
          }}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              setShowSuggestions(false);
            }
          }}
        />
        {/* 予測候補リスト */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1">
            {suggestions.map((station, index) => (
              <li
                key={`${station.name}-${index}`}
                className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-none transition-colors"
                onClick={() => {
                  setDepartureStation(station.name);
                  setCurrentCoords({ lat: station.y, lon: station.x });
                  setShowSuggestions(false);
                  setResultStation(null);
                }}
              >
                <div className="font-bold text-slate-800">{station.name}</div>
                <div className="text-xs text-slate-500">{station.line} ({station.prefecture})</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 移動時間の条件設定 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">移動時間（目安）</label>
        <div className="relative">
          <select
            className="w-full p-3 border border-slate-300 rounded-lg text-slate-900 bg-slate-50 appearance-none"
            value={maxTime}
            onChange={(e) => {
              setMaxTime(e.target.value);
              setResultStation(null);
            }}
          >
            <option value="30">30分以内</option>
            <option value="60">1時間以内</option>
            <option value="90">1時間半以内</option>
            <option value="120">2時間以内</option>
            <option value="180">3時間以内</option>
            <option value="0">無制限（どこまでも）</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      {/* 都道府県選択 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">エリア選択</label>
        <select
          className="w-full p-3 border border-slate-300 text-slate-900 rounded-lg bg-slate-50"
          value={selectedPref}
          onChange={(e) => {
            setSelectedPref(e.target.value);
            setResultStation(null);
          }}
          disabled={loading}
        >
          <option value="全国">全国</option>
          {displayPrefectures.map(pref => (
            <option key={pref} value={pref}>{pref}</option>
          ))}
        </select>
      </div>

      {/* 路線選択 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">路線選択（オプション）</label>
        <div className="relative">
          <select
            className="w-full p-3 border border-slate-300 text-slate-900 rounded-lg bg-slate-50 appearance-none disabled:bg-slate-200 disabled:text-slate-400"
            value={selectedLine}
            onChange={(e) => {
              setSelectedLine(e.target.value);
              setResultStation(null);
            }}
            disabled={selectedPref === "全国" || lines.length === 0}
          >
            <option value="すべて">すべての路線から</option>
            {lines.map(line => (
              <option key={line} value={line}>{line}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
        {selectedPref === "全国" && (
          <p className="text-xs text-slate-400 mt-1 text-right">※全国モードでは路線指定できません</p>
        )}
      </div>

      {/* ガチャボタン */}
      <button
        onClick={handleGacha}
        disabled={loading || !currentCoords || (selectedPref !== "全国" && lines.length === 0)}
        className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all shadow-md
          ${loading || !currentCoords ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95"}
        `}
      >
        {loading ? "通信中..." : !currentCoords ? "出発駅を入力してください" : "どこかの駅へ行く！"}
      </button>
    </div>
  );
}