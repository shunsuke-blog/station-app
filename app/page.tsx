"use client";

import { useState, useEffect, useRef } from 'react';
import { PREFECTURES, PREFECTURE_DATA } from './constants';
// ★作ったファイルを読み込む
import { calculateDistance, estimateTime } from './utils';
import ResultCard from './ResultCard';


// 型定義
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
      postal: string;
      x: number;
      y: number;
    }[];
  }
};

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

  // 出発駅の座標
  const [currentCoords, setCurrentCoords] = useState<{ lat: number, lon: number } | null>(null);

  // 表示する都道府県リスト
  const [displayPrefectures, setDisplayPrefectures] = useState<string[]>(PREFECTURES);
  // 入力フォーム全体を監視するための「参照(ref)」
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 1. 都道府県が変わったら路線を取得
  useEffect(() => {
    if (selectedPref === "全国") {
      setLines([]);
      return;
    }
    const fetchLines = async () => {
      setLoading(true);
      setStatusMessage("路線データを取得中...");

      try {
        let searchPref = selectedPref;
        if (selectedPref.includes("東京都")) {
          searchPref = "東京都";
        }
        const res = await fetch(`https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(searchPref)}`);
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


  // 2. 出発駅の入力処理
  useEffect(() => {
    if (!departureStation) {
      setSuggestions([]);
      setCurrentCoords(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(departureStation)}`);
        // method=getStations はそのまま、パラメータを filtering に変える
        // const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&filtering=${encodeURIComponent(departureStation)}`);
        const data: StationsResponse = await res.json();
        const stations = data?.response?.station || [];

        setSuggestions(stations);
        setShowSuggestions(true);

        if (stations.length > 0) {
          setCurrentCoords({ lat: stations[0].y, lon: stations[0].x });
        }
      } catch (error) {
        console.error("候補の取得に失敗", error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [departureStation]);


  // 3. 都道府県リストの再計算
  useEffect(() => {
    if (!currentCoords || maxTime === "0") {
      setDisplayPrefectures(PREFECTURES);
      return;
    }

    // 計算ロジックを utils.ts に追い出したのでスッキリ！
    const speedKmh = 40;
    const maxDist = (parseInt(maxTime) / 60) * speedKmh;
    const searchRadius = maxDist + 80;

    const filteredPrefs = PREFECTURE_DATA.filter(pref => {
      const dist = calculateDistance(currentCoords.lat, currentCoords.lon, pref.y, pref.x);
      return dist <= searchRadius;
    }).map(d => d.name);

    setDisplayPrefectures(filteredPrefs);

    if (selectedPref !== "全国" && !filteredPrefs.includes(selectedPref)) {
      setSelectedPref("全国");
    }

  }, [currentCoords, maxTime, selectedPref]);

  // 画面クリック監視用
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
  }, []);

  // ガチャ実行ボタン
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

      let foundStation = null;
      let retryCount = 0;
      const MAX_RETRIES = 100;
      const targetPrefList = displayPrefectures;

      while (retryCount < MAX_RETRIES) {
        retryCount++;
        setStatusMessage(retryCount > 1 ? `条件に合う駅を探しています...(${retryCount}回目)` : "抽選中...");

        let targetLines = lines;

        if (selectedPref === "全国") {
          const randomPref = targetPrefList[Math.floor(Math.random() * targetPrefList.length)];
          const res = await fetch(`https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(randomPref)}`);
          const data: LinesResponse = await res.json();
          targetLines = data?.response?.line || [];
          if (targetLines.length === 0) continue;
        }

        const randomLine = targetLines[Math.floor(Math.random() * targetLines.length)];
        const resStations = await fetch(`https://express.heartrails.com/api/json?method=getStations&line=${encodeURIComponent(randomLine)}`);
        const dataStations: StationsResponse = await resStations.json();
        const stations = dataStations.response.station;

        let candidates = stations;
        if (selectedPref !== "全国") {

          if (selectedPref === "東京都(23区内)") {
            // 郵便番号が 100〜159 で始まるものが23区
            candidates = stations.filter(s => s.postal && s.postal.match(/^1[0-5]/));

          } else if (selectedPref === "東京都(23区外)") {
            // 郵便番号が 180〜208 で始まるものが多摩地域（23区外）
            // またはシンプルに「東京都だけど23区内じゃないやつ」
            candidates = stations.filter(s => s.prefecture === "東京都" && !(s.postal && s.postal.match(/^1[0-5]/)));

          } else {
            // それ以外の県は今まで通り名前で一致させる
            // (APIには "東京都" で検索かけているので、ここで "東京都(全域)" の場合の考慮もOK)
            let searchPref = selectedPref;
            if (selectedPref === "東京都(全域)") searchPref = "東京都"; // そのまま
            candidates = stations.filter(s => s.prefecture === searchPref);
          }
        }

        if (candidates.length === 0) continue;

        const candidate = candidates[Math.floor(Math.random() * candidates.length)];

        // 計算ロジックを utils.ts から使用
        const dist = calculateDistance(deptLat, deptLon, candidate.y, candidate.x);
        const time = estimateTime(dist);

        if (maxTime === "0") {
          foundStation = candidate;
          (foundStation as any).estimatedTime = time;
          break;
        }

        console.log(`候補: ${candidate.name}駅, 推定時間: ${time}分`);

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
              }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={(e) => {
                // Enterキーが押されたら閉じる
                // (!e.nativeEvent.isComposing は「日本語変換中のEnter」を除外するためのおまじないです)
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  setShowSuggestions(false);
                }
              }}
            />
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
              className="w-full p-3 border border-slate-300 text-slate-900 rounded-lg bg-slate-50"
              value={selectedPref}
              onChange={(e) => setSelectedPref(e.target.value)}
              disabled={loading}
            >
              <option value="全国">全国</option>
              {displayPrefectures.map(pref => (
                <option key={pref} value={pref}>{pref}</option>
              ))}
            </select>

            <p className="text-xs text-slate-500 mt-1 text-right">
              {maxTime !== "0" && departureStation && displayPrefectures.length < 47
                ? `条件に合う ${displayPrefectures.length} エリアから検索`
                : selectedPref === "全国"
                  ? "日本国内のすべての駅から抽選します"
                  : lines.length > 0 ? `${lines.length} 路線が見つかりました` : "読み込み中..."}
            </p>
          </div>

          <button
            onClick={handleGacha}
            disabled={loading || (selectedPref !== "全国" && lines.length === 0)}
            className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all shadow-md
              ${loading ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95"}
            `}
          >
            {loading ? "通信中..." : "どこかの駅へ行く！"}
          </button>

          {statusMessage && <p className="text-center text-sm text-slate-500 animate-pulse">{statusMessage}</p>}

          {/* ★結果表示カード: コンポーネント化したので1行で済む！ */}
          {resultStation && (
            <ResultCard resultStation={resultStation} departureStation={departureStation} />
          )}

        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        Powered by <a href="http://express.heartrails.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">HeartRails Express</a>
      </footer>
    </main>
  );
}