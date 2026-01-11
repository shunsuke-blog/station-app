"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Record = {
  name: string;
  line: string;
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

  // ★ どの路線が選択されているかを管理 (null は未選択)
  const [selectedLine, setSelectedLine] = useState<string>("全て");

  // ★ 手動入力用のState
  const [inputName, setInputName] = useState("");
  const [inputLine, setInputLine] = useState("");
  const [inputPref, setInputPref] = useState("東京都"); // デフォルト

  // ★ 検索機能用のState
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  // 現在選択中（保存前）の駅情報を保持するState
  const [pendingStation, setPendingStation] = useState<any | null>(null);

  // 1. 駅名検索ロジック (HeartRails API)
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&name=${searchQuery}`);
        const data = await res.json();
        if (data.response.station) {
          setSuggestions(data.response.station);
        }
      } catch (err) { console.error(err); }
    };
    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. 候補から「選択」した時の処理 (まだ保存はしない)
  const handleSelectSuggestion = (station: any) => {
    setPendingStation(station); // 仮置き
    setSearchQuery(station.name); // 入力欄を駅名で埋める
    setSuggestions([]); // 候補を閉じる
  };

  // 3. 「保存ボタン」が押された時の最終処理
  const handleFinalSave = () => {
    if (!pendingStation) return;

    if (history.some(h => h.name === pendingStation.name)) {
      alert("この駅は既に記録されています。");
      setPendingStation(null);
      setSearchQuery("");
      return;
    }

    const newEntry = {
      name: pendingStation.name,
      line: pendingStation.line,
      prefecture: pendingStation.prefecture,
      date: new Date().toLocaleDateString(),
    };

    const newHistory = [newEntry, ...history];
    setHistory(newHistory);
    localStorage.setItem("stationHistory", JSON.stringify(newHistory));

    // 全てリセット
    setPendingStation(null);
    setSearchQuery("");
    alert(`${pendingStation.name} を記録しました！`);
  };

  useEffect(() => {
    const saved = localStorage.getItem("stationHistory");
    if (saved) {
      const data: Record[] = JSON.parse(saved);

      // ★ 重複を完全に排除する処理
      // Mapオブジェクトを使って、駅名(name)をキーにして保存
      // あとから出てきた同じ名前のデータが上書きされるので、最新の1つだけが残ります
      const uniqueMap = new Map();
      data.forEach(item => {
        // 駅名だけで判定。もし「路線が違えば別」にしたいなら key = item.name + item.line にします
        uniqueMap.set(item.name, item.item);
        // ※↑ ここがポイント：同じ名前が来たら最新に更新される
        uniqueMap.set(item.name, item);
      });

      const uniqueData = Array.from(uniqueMap.values());

      // 綺麗にしたデータをStateに入れる
      setHistory(uniqueData);

      // ★重要：LocalStorageの中身自体も、重複がない綺麗な状態に上書き保存し直す
      localStorage.setItem("stationHistory", JSON.stringify(uniqueData));
    }

    // 地図の取得
    fetch("https://raw.githubusercontent.com/geolonia/japanese-prefectures/master/map-polygon.svg")
      .then((res) => res.text())
      .then((svg) => setMapSvg(svg));
  }, []);

  // 都道府県が切り替わった時に、路線選択をリセットする
  useEffect(() => {
    setSelectedLine("すべて");
  }, [selectedPrefCode]);

  // ★ 1. 選択された都道府県に該当する駅をまず抽出
  const prefFilteredHistory = history.filter(h =>
    selectedPrefCode && PREF_CODE_MAP[h.prefecture] === selectedPrefCode
  );

  // ★ 2. その都道府県内で「存在する路線のリスト」を作る
  const availableLines = Array.from(new Set(prefFilteredHistory.map(h => h.line))).filter(Boolean);

  // ★ 3. 選択された路線でさらに絞り込む
  const finalFilteredHistory = prefFilteredHistory.filter(h =>
    selectedLine === "すべて" || h.line === selectedLine
  );

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

  // ★ 手動で保存する関数
  const handleManualSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;

    // 重複チェック
    if (history.some(h => h.name === inputName)) {
      alert("この駅は既に記録されています。");
      return;
    }

    const newEntry = {
      name: inputName,
      line: inputLine || "不明な路線",
      prefecture: inputPref,
      date: new Date().toLocaleDateString(),
    };

    const newHistory = [...history, newEntry];
    setHistory(newHistory);
    localStorage.setItem("stationHistory", JSON.stringify(newHistory));

    // 入力をリセット
    setInputName("");
    setInputLine("");
    alert(`${inputName} を記録しました！`);
  };

  return (
    <div className="min-h-screen bg-indigo-50 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-black text-slate-800 mb-8 text-center">今までの記録 📍</h1>

        {/* --- 検索・追加フォームエリア --- */}
        <div className="bg-white border-2 border-indigo-100 p-5 rounded-3xl shadow-sm mb-8">
          <p className="text-xs font-bold text-indigo-400 mb-3 px-1 text-center uppercase tracking-widest">訪れた駅を追加</p>

          <div className="relative">
            <div className="bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl flex items-center mb-4 focus-within:border-indigo-200 transition-all">
              <span className="mr-2">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPendingStation(null); // 入力し直したら仮選択を解除
                }}
                placeholder="例：新宿"
                className="w-full text-sm outline-none bg-transparent font-bold text-slate-700"
              />
            </div>

            {/* 候補リスト */}
            {suggestions.length > 0 && (
              <div className="absolute z-50 w-full -mt-2 bg-white border-2 border-indigo-50 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-slate-50 last:border-none transition-colors"
                  >
                    <p className="font-bold text-slate-700 text-sm">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.line} / {s.prefecture}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ★ 保存ボタン：駅が選択されている時だけ活性化 */}
          <button
            onClick={handleFinalSave}
            disabled={!pendingStation}
            className={`w-full py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-sm
              ${pendingStation
                ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"}
            `}
          >
            <span>💾</span> 記録を保存する
          </button>

        </div>

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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              <div className="px-2 mb-4">
                <h3 className="font-black text-slate-700 text-lg mb-3">
                  {CODE_TO_NAME[selectedPrefCode]} の駅
                </h3>

                {/* ★ 路線選択リスト (横スクロール可能) */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedLine("すべて")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border-2 ${selectedLine === "すべて"
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-indigo-100 text-indigo-400"
                      }`}
                  >
                    すべて ({prefFilteredHistory.length})
                  </button>
                  {availableLines.map(line => (
                    <button
                      key={line}
                      onClick={() => setSelectedLine(line)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border-2 ${selectedLine === line
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-indigo-100 text-indigo-400"
                        }`}
                    >
                      {line}
                    </button>
                  ))}
                </div>
              </div>

              {finalFilteredHistory.length === 0 ? (
                <p className="text-center text-slate-400 py-10 bg-white/50 rounded-2xl border-2 border-dashed border-indigo-100">
                  該当する駅はありません
                </p>
              ) : (
                finalFilteredHistory.map((item, index) => (
                  <div key={index} className="bg-white border-2 border-indigo-100 p-5 rounded-2xl mb-3 flex justify-between items-center shadow-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        {/* 駅名 */}
                        <p className="font-black text-xl text-slate-800">{item.name}</p>
                        {/* ★ 路線の情報を小さめ・薄めに表示 */}
                        <p className="text-[10px] font-bold text-slate-400 truncate flex-1">
                          {item.line}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-indigo-400">{item.date}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.name)}
                      className="shrink-0 ml-4 px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-lg border border-red-100 hover:bg-red-500 hover:text-white transition-all"
                    >
                      消去
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="text-center py-10 bg-indigo-100/30 rounded-3xl border-2 border-dashed border-indigo-200">
              <p className="text-indigo-400 font-bold text-sm">地図をタップして記録を確認</p>
            </div>
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