"use client";

import { useState, useEffect } from 'react';
// PREFECTURE_DATA は必須です！
import { PREFECTURES, PREFECTURE_DATA } from './constants';

type LinesResponse = {
  response: {
    line: string[];
  }
};

type StationsResponse = {
  response: {
    station: {
      name: string;
      line: string;
      prefecture: string;
      x: number;
      y: number;
    }[];
  }
};

// 距離計算関数
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateTime(distanceKm: number): number {
  const actualDistance = distanceKm * 1.3;
  const speedKmh = 40;
  return Math.round((actualDistance / speedKmh) * 60);
}

export default function Home() {
  const [selectedPref, setSelectedPref] = useState<string>("全国");
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const [departureStation, setDepartureStation] = useState<string>("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const [maxTime, setMaxTime] = useState<string>("60");
  const [resultStation, setResultStation] = useState<any>(null);

  // ★追加: 出発駅の座標（絞り込み用）
  const [currentCoords, setCurrentCoords] = useState<{ lat: number, lon: number } | null>(null);

  // ★追加: ドロップダウンに表示する都道府県リスト（最初は全員）
  const [displayPrefectures, setDisplayPrefectures] = useState<string[]>(PREFECTURES);

  // 1. 都道府県が変わったら路線を取得（変更なし）
  useEffect(() => {
    if (selectedPref === "全国") {
      setLines([]);
      return;
    }
    const fetchLines = async () => {
      setLoading(true);
      setStatusMessage("路線データを取得中...");
      try {
        const res = await fetch(`https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(selectedPref)}`);
        const data: LinesResponse = await res.json();
        setLines(data?.response?.line || []);
        setStatusMessage("");
      } catch (error) {
        console.error(error);
        setStatusMessage("データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };
    fetchLines();
  }, [selectedPref]);


  // 2. 出発駅の入力処理（座標取得ロジックを追加）
  useEffect(() => {
    if (!departureStation) {
      setSuggestions([]);
      setCurrentCoords(null); // クリア
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(departureStation)}`);
        const data: StationsResponse = await res.json();
        const stations = data?.response?.station || [];

        setSuggestions(stations);
        setShowSuggestions(true);

        // ★追加: 入力された駅が存在すれば、その座標を記憶しておく
        if (stations.length > 0) {
          setCurrentCoords({ lat: stations[0].y, lon: stations[0].x });
        }
      } catch (error) {
        console.error("候補の取得に失敗", error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [departureStation]);


  // ★追加: 「出発駅の座標」または「時間設定」が変わったら、都道府県リストを再計算する
  useEffect(() => {
    // 条件が揃っていない場合は、全県を表示して終了
    if (!currentCoords || maxTime === "0") {
      setDisplayPrefectures(PREFECTURES);
      return;
    }

    // 距離計算してフィルタリング
    const speedKmh = 40;
    const maxDist = (parseInt(maxTime) / 60) * speedKmh;
    const searchRadius = maxDist + 80; // 県の端っこも考慮してバッファを持たせる

    const filteredPrefs = PREFECTURE_DATA.filter(pref => {
      const dist = calculateDistance(currentCoords.lat, currentCoords.lon, pref.y, pref.x);
      return dist <= searchRadius;
    }).map(d => d.name);

    setDisplayPrefectures(filteredPrefs);

    // もし現在選択中の都道府県が、リストから消えた場合（例：北海道を選んでいたのに新宿60分にした場合）
    // 「全国」に戻してあげる
    if (selectedPref !== "全国" && !filteredPrefs.includes(selectedPref)) {
      setSelectedPref("全国");
    }

  }, [currentCoords, maxTime, selectedPref]);


  // 3. ガチャ実行ボタン（ロジックは前回と同じ）
  const handleGacha = async () => {
    if (!departureStation) {
      alert("出発駅を入力してください！");
      return;
    }
    if (selectedPref !== "全国" && lines.length === 0) return;

    setLoading(true);
    setResultStation(null);
    setStatusMessage("抽選中...");

    try {
      let deptLat = 0;
      let deptLon = 0;

      // 座標が既にある場合はそれを使う（API節約）
      if (currentCoords) {
        deptLat = currentCoords.lat;
        deptLon = currentCoords.lon;
      } else {
        const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(departureStation)}`);
        const data = await res.json();
        const station = data?.response?.station?.[0];
        if (!station) {
          alert("出発駅が見つかりませんでした。");
          setLoading(false);
          setStatusMessage("");
          return;
        }
        deptLat = station.y;
        deptLon = station.x;
      }

      // 抽選ロジック
      let foundStation = null;
      let retryCount = 0;
      const MAX_RETRIES = 100;

      // ★修正: リスト絞り込み済みの displayPrefectures を使う
      // （これで「全国」を選んでも、遠すぎる県は抽選対象に入らない）
      const targetPrefList = displayPrefectures;

      // ... (前略) whileループの開始部分 ...

      while (retryCount < MAX_RETRIES) {
        retryCount++;
        setStatusMessage(retryCount > 1 ? `条件に合う駅を探しています...(${retryCount}回目)` : "抽選中...");

        // A. 路線を選ぶ
        let targetLines = lines;

        if (selectedPref === "全国") {
          const randomPref = targetPrefList[Math.floor(Math.random() * targetPrefList.length)];
          const res = await fetch(`https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(randomPref)}`);
          const data: LinesResponse = await res.json();
          targetLines = data?.response?.line || [];
          if (targetLines.length === 0) continue;
        }

        const randomLine = targetLines[Math.floor(Math.random() * targetLines.length)];

        // B. 駅を選ぶ
        const resStations = await fetch(`https://express.heartrails.com/api/json?method=getStations&line=${encodeURIComponent(randomLine)}`);
        const dataStations: StationsResponse = await resStations.json();
        const stations = dataStations.response.station;

        // ★修正ポイント: ここで「都道府県フィルタ」をかける！
        let candidates = stations;

        // もし「全国」以外（東京都など）が選ばれていたら、その県の駅だけに絞り込む
        if (selectedPref !== "全国") {
          candidates = stations.filter(s => s.prefecture === selectedPref);
        }

        // 絞り込んだ結果、候補がなくなってしまったら（路線だけ通過して駅がない等）やり直し
        if (candidates.length === 0) continue;

        // 絞り込んだリストからランダムに選ぶ
        const candidate = candidates[Math.floor(Math.random() * candidates.length)];


        // C. 時間判定
        if (maxTime === "0") {
          const dist = calculateDistance(deptLat, deptLon, candidate.y, candidate.x);
          const time = estimateTime(dist);
          foundStation = candidate;
          (foundStation as any).estimatedTime = time;
          break;
        }

        const dist = calculateDistance(deptLat, deptLon, candidate.y, candidate.x);
        const time = estimateTime(dist);
        console.log(`候補: ${candidate.name}駅 (${candidate.prefecture}), 推定時間: ${time}分`);

        if (time <= parseInt(maxTime)) {
          foundStation = candidate;
          (foundStation as any).estimatedTime = time;
          break;
        }
      }

      if (foundStation) {
        setResultStation(foundStation);
        setStatusMessage("");
      } else {
        setStatusMessage("条件に合う駅が見つかりませんでした💦 条件を緩めてみてください。");
      }

    } catch (error) {
      console.error(error);
      setStatusMessage("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-800">駅ガチャ 🚃</h1>

        <div className="space-y-6">

          {/* 出発駅入力フォーム */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              出発駅（現在地）
              <span className="text-red-500 text-xs ml-2 font-bold">必須</span>
            </label>
            <input
              type="text"
              placeholder="例: 新宿"
              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={departureStation}
              onChange={(e) => {
                setDepartureStation(e.target.value);
                setShowSuggestions(false);
              }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            />
            {/* 予測候補のドロップダウンリスト */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1">
                {suggestions.map((station, index) => (
                  <li
                    key={`${station.name}-${index}`}
                    className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-none transition-colors"
                    onClick={() => {
                      setDepartureStation(station.name);
                      // ★追加: 候補クリック時にも座標をセットしてリスト更新を促す
                      setCurrentCoords({ lat: station.y, lon: station.x });
                      setShowSuggestions(false);
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
                className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 appearance-none"
                value={maxTime}
                onChange={(e) => setMaxTime(e.target.value)}
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
              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50"
              value={selectedPref}
              onChange={(e) => setSelectedPref(e.target.value)}
              disabled={loading}
            >
              <option value="全国">全国</option>

              {/* ★修正: 絞り込まれたリスト(displayPrefectures)を表示 */}
              {displayPrefectures.map(pref => (
                <option key={pref} value={pref}>{pref}</option>
              ))}
            </select>

            <p className="text-xs text-slate-500 mt-1 text-right">
              {/* メッセージも動的に */}
              {maxTime !== "0" && departureStation && displayPrefectures.length < 47
                ? `条件に合う ${displayPrefectures.length} エリアから検索`
                : selectedPref === "全国"
                  ? "日本国内のすべての駅から抽選します"
                  : lines.length > 0 ? `${lines.length} 路線が見つかりました` : "読み込み中..."}
            </p>
          </div>

          {/* ガチャボタン */}
          <button
            onClick={handleGacha}
            disabled={loading || (selectedPref !== "全国" && lines.length === 0)}
            className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all shadow-md
              ${loading ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95"}
            `}
          >
            {loading ? "通信中..." : "どこかの駅へ行く！"}
          </button>

          {/* ステータス表示 */}
          {statusMessage && <p className="text-center text-sm text-slate-500 animate-pulse">{statusMessage}</p>}

          {/* 結果表示エリア */}
          {resultStation && (
            <div className="mt-4 p-6 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-center animate-bounce-short">
              <p className="text-sm text-indigo-600 font-bold mb-1">{resultStation.line}</p>
              <h2 className="text-3xl font-black text-slate-800 mb-2">{resultStation.name}<span className="text-lg font-normal">駅</span></h2>
              <p className="text-xs text-slate-500">
                📍 {resultStation.prefecture} <br />
                (緯度: {resultStation.y}, 経度: {resultStation.x})
              </p>

              {resultStation.estimatedTime && (
                <div className="mt-2 py-1 px-3 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full inline-block">
                  {departureStation}から 約{resultStation.estimatedTime}分
                </div>
              )}

              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(resultStation.name + "駅")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-xs text-blue-500 underline hover:text-blue-700"
              >
                Google Mapsで見る
              </a>
            </div>
          )}

        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        Powered by <a href="http://express.heartrails.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">HeartRails Express</a>
      </footer>
    </main>
  );
}