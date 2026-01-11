"use client";

import { useState, useEffect, useRef } from 'react';
import { PREFECTURES, PREFECTURE_DATA } from './constants';
// ★作ったファイルを読み込む
import { calculateDistance, estimateTime } from './utils';
import ResultCard from './ResultCard';
import SearchForm from './SearchForm';

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
      prev?: string; // 前の駅（始発の場合はデータがないので ? をつける）
      next?: string; // 次の駅（終点の場合はデータがないので ? をつける）
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

  // 路線
  const [selectedLine, setSelectedLine] = useState<string>("すべて");

  // 1. 都道府県が変わったら路線を取得
  useEffect(() => {
    // ★追加: 都道府県が変わったら、選択中の路線を「すべて」に戻す
    setSelectedLine("すべて");
    // ↓ここから下は今までと同じです
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
        } else {
          // ★追加: 都道府県指定モードの場合
          // もし特定の路線が選ばれていたら、その路線だけを対象にする
          if (selectedLine !== "すべて") {
            targetLines = [selectedLine];
          }
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
        <SearchForm
          departureStation={departureStation}
          setDepartureStation={setDepartureStation}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          setCurrentCoords={setCurrentCoords}
          setResultStation={setResultStation}
          maxTime={maxTime}
          setMaxTime={setMaxTime}
          selectedPref={selectedPref}
          setSelectedPref={setSelectedPref}
          displayPrefectures={displayPrefectures}
          lines={lines}
          selectedLine={selectedLine}
          setSelectedLine={setSelectedLine}
          loading={loading}
          currentCoords={currentCoords}
          handleGacha={handleGacha}
        />
        {statusMessage && <p className="text-center text-sm text-slate-500 animate-pulse mt-4">{statusMessage}</p>}

        {resultStation && (
          <ResultCard resultStation={resultStation} departureStation={departureStation} />
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        Powered by <a href="http://express.heartrails.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">HeartRails Express</a>
      </footer>
    </main>
  );
}