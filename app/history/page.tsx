"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Record = {
  name: string;
  date: string;
  prefecture: string;
};

const PREF_CODE_MAP: { [key: string]: string } = {
  "北海道": "1", "青森県": "2", "岩手県": "3", "宮城県": "4", "秋田県": "5", "山形県": "6", "福島県": "7",
  "茨城県": "8", "栃木県": "9", "群馬県": "10", "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14",
  "新潟県": "15", "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20", "岐阜県": "21", "静岡県": "22", "愛知県": "23",
  "三重県": "24", "滋賀県": "25", "京都府": "26", "大阪府": "27", "兵庫県": "28", "奈良県": "29", "和歌山県": "30",
  "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34", "山口県": "35", "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39",
  "福岡県": "40", "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "宮崎県": "45", "鹿児島県": "46", "沖縄県": "47"
};

// 逆にコードから県名を知るための辞書（表示用）
const CODE_TO_NAME = Object.fromEntries(Object.entries(PREF_CODE_MAP).map(([k, v]) => [v, k]));

export default function HistoryPage() {
  const [history, setHistory] = useState<Record[]>([]);
  const [mapSvg, setMapSvg] = useState<string>("");
  // ★ どの都道府県が選択されているかを管理 (null は未選択)
  const [selectedPrefCode, setSelectedPrefCode] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("stationHistory");
    if (saved) setHistory(JSON.parse(saved));

    fetch("https://raw.githubusercontent.com/geolonia/japanese-prefectures/master/map-polygon.svg")
      .then((res) => res.text())
      .then((svg) => setMapSvg(svg));
  }, []);

  // マップ内のクリックイベントを処理する関数
  const handleMapClick = (e: React.MouseEvent) => {
    const target = e.target as SVGElement;
    // クリックされた要素が「都道府県（prefectureクラス）」を持っているか確認
    const prefElement = target.closest(".prefecture") as HTMLElement;
    if (prefElement) {
      const code = prefElement.dataset.code || null;
      setSelectedPrefCode(code);
    } else {
      // 地図の背景などをクリックしたら選択解除
      setSelectedPrefCode(null);
    }
  };

  const handleDelete = (name: string) => {
    if (confirm(`${name}の記録を取り消しますか？`)) {
      const newHistory = history.filter((item) => item.name !== name);
      setHistory(newHistory);
      localStorage.setItem("stationHistory", JSON.stringify(newHistory));
    }
  };

  // 訪れた都道府県コードのリスト
  const visitedPrefCodes = Array.from(new Set(
    history.map(h => PREF_CODE_MAP[h.prefecture]).filter(Boolean)
  ));

  // ★ 選択された都道府県に該当する駅だけを抽出
  const filteredHistory = history.filter(h =>
    selectedPrefCode && PREF_CODE_MAP[h.prefecture] === selectedPrefCode
  );

  return (
    <div className="min-h-screen bg-indigo-50 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-black text-slate-800 mb-8 text-center">今までの記録 📍</h1>

        <div className="bg-white border-2 border-indigo-100 p-4 rounded-3xl shadow-sm mb-8">
          <h2 className="text-center text-sm font-bold text-indigo-400 mb-4">
            {selectedPrefCode ? "都道府県を選択中" : "地図をタップして駅を表示"}
          </h2>

          <style dangerouslySetInnerHTML={{
            __html: `
            .geolonia-svg-map { width: 100%; height: auto; cursor: pointer; }
            .geolonia-svg-map .prefecture { fill: #f1f5f9; stroke: #cbd5e1; stroke-width: 0.5; transition: all 0.2s; }
            
            /* 訪れた都道府県の色 */
            ${visitedPrefCodes.map(code => `
              .geolonia-svg-map [data-code="${code}"] { fill: #c7d2fe; }
            `).join('\n')}

            /* ★ 現在選択されている都道府県を強調 */
            ${selectedPrefCode ? `
              .geolonia-svg-map [data-code="${selectedPrefCode}"] { 
                fill: #4f46e5 !important; 
                filter: drop-shadow(0 0 4px rgba(79, 70, 229, 0.4));
              }
            ` : ""}
          `}} />

          <div
            onClick={handleMapClick}
            dangerouslySetInnerHTML={{ __html: mapSvg }}
          />

          <p className="text-center text-[10px] font-bold text-slate-300 mt-4 uppercase">
            Total: {visitedPrefCodes.length} Prefectures
          </p>
        </div>

        {/* --- 選択された都道府県の駅リストセクション --- */}
        <div className="space-y-4">
          {selectedPrefCode ? (
            <>
              <div className="flex justify-between items-end mb-2 px-2">
                <h3 className="font-black text-slate-700 text-lg">
                  {CODE_TO_NAME[selectedPrefCode]} の駅
                </h3>
                <span className="text-xs text-indigo-400 font-bold">{filteredHistory.length}件</span>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="bg-white/50 border-2 border-dashed border-indigo-100 p-8 rounded-2xl text-center text-slate-400 text-sm">
                  この都道府県の駅はまだ記録されていません
                </div>
              ) : (
                filteredHistory.map((item, index) => (
                  <div key={index} className="bg-white border-2 border-indigo-200 p-5 rounded-2xl flex justify-between items-center shadow-sm animate-in fade-in slide-in-from-bottom-2">
                    <div>
                      <p className="font-black text-xl text-slate-800">{item.name}</p>
                      <p className="text-xs font-bold text-indigo-400">{item.date}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.name)}
                      className="px-4 py-2 bg-red-50 text-red-500 text-sm font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all"
                    >
                      消去
                    </button>
                  </div>
                ))
              )}
            </>
          ) : (
            <p className="text-center text-slate-400 text-sm py-10">
              日本地図の都道府県をタップすると<br />訪れた駅のリストが表示されます
            </p>
          )}
        </div>

        <div className="mt-12 text-center pb-10">
          <Link href="/" className="inline-block px-8 py-3 bg-white border-2 border-indigo-200 text-indigo-600 font-bold rounded-full">
            ← ガチャに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}