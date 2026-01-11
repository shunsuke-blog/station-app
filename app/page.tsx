"use client";

import { useState, useEffect } from 'react';
import { PREFECTURES } from './constants';

// HeartRails APIのレスポンス型定義
type LinesResponse = {
  response: {
    line: string[];
  }
};

type StationsResponse = {
  response: {
    station: {
      name: string; //駅名
      line: string; //路線名
      prefecture: string; //都道府県名
      x: number; // 経度
      y: number; // 緯度
    }[];
  }
};

// 2点の緯度経度から距離(km)を計算する関数 (ヒュベニの公式の簡易版)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球の半径(km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 距離(km)
}

// 距離から時間を推測する関数（電車は直線では走れないので距離を1.3倍し、時速40kmで計算）
function estimateTime(distanceKm: number): number {
  const actualDistance = distanceKm * 1.3; // 線路の曲がり具合補正
  const speedKmh = 40; // 平均時速（停車時間含む）
  return Math.round((actualDistance / speedKmh) * 60); // 分に換算
}

export default function Home() {
  const [selectedPref, setSelectedPref] = useState<string>("全国");
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // 出発駅・予測変換用
  const [departureStation, setDepartureStation] = useState<string>("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [maxTime, setMaxTime] = useState<string>("60");

  // 抽出結果
  const [resultStation, setResultStation] = useState<any>(null);

  // 1. 都道府県が変わったら、そのエリアの「路線一覧」をAPIから取得する
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

  // 2. ガチャ実行ボタン
  // 2. ガチャ実行ボタン
  const handleGacha = async () => {
    // バリデーション: 出発駅が入力されていないのに時間制限がある場合
    if (maxTime !== "0" && !departureStation) {
      alert("時間制限をする場合は、出発駅を入力してください！");
      return;
    }
    if (selectedPref !== "全国" && lines.length === 0) return;

    setLoading(true);
    setResultStation(null);
    setStatusMessage("抽選中...");

    try {
      // 0. 出発駅の座標を取得する（時間制限がある場合のみ）
      let deptLat = 0;
      let deptLon = 0;

      if (maxTime !== "0") {
        // 出発駅の情報をAPIで取得
        const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(departureStation)}`);
        const data = await res.json();
        const station = data?.response?.station?.[0]; // 候補の1つ目を使う

        if (!station) {
          alert("出発駅が見つかりませんでした。正しい駅名を入力してください。");
          setLoading(false);
          setStatusMessage("");
          return;
        }
        deptLat = station.y; // 緯度
        deptLon = station.x; // 経度
      }

      // ★ここからリトライループ開始（最大10回挑戦）
      let foundStation = null;
      let retryCount = 0;
      const MAX_RETRIES = 10;

      while (retryCount < MAX_RETRIES) {
        retryCount++;
        setStatusMessage(retryCount > 1 ? `条件に合う駅を探しています...(${retryCount}回目)` : "抽選中...");

        // A. 路線を選ぶ
        let targetLines = lines;
        // 全国の場合は毎回都道府県から選び直す
        if (selectedPref === "全国") {
          const randomPref = PREFECTURES[Math.floor(Math.random() * PREFECTURES.length)];
          const res = await fetch(`https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(randomPref)}`);
          const data: LinesResponse = await res.json();
          targetLines = data?.response?.line || [];
          if (targetLines.length === 0) continue; // 失敗したら次へ
        }

        const randomLine = targetLines[Math.floor(Math.random() * targetLines.length)];

        // B. 駅を選ぶ
        const resStations = await fetch(`https://express.heartrails.com/api/json?method=getStations&line=${encodeURIComponent(randomLine)}`);
        const dataStations: StationsResponse = await resStations.json();
        const stations = dataStations.response.station;
        const candidate = stations[Math.floor(Math.random() * stations.length)];

        // C. 時間判定（時間制限なし "0" なら即採用）
        if (maxTime === "0") {
          foundStation = candidate;
          break;
        }

        // 距離と時間を計算
        const dist = calculateDistance(deptLat, deptLon, candidate.y, candidate.x);
        const time = estimateTime(dist);

        console.log(`候補: ${candidate.name}駅, 距離: ${dist.toFixed(1)}km, 推定時間: ${time}分`);

        // 条件（maxTime以内）なら採用！
        if (time <= parseInt(maxTime)) {
          foundStation = candidate;
          // 結果表示用に推定時間をオブジェクトに追加しておく
          (foundStation as any).estimatedTime = time;
          break;
        }

        // ダメならループ継続（次の回へ）
      }

      // 結果セット
      if (foundStation) {
        setResultStation(foundStation);
        setStatusMessage("");
      } else {
        setStatusMessage("条件に合う駅が見つかりませんでした💦 エリアを広げてみてください。");
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

          {/* 出発駅入力フォーム（シンプル版に戻しました） */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">出発駅（現在地）</label>
            <input
              type="text"
              placeholder="例: 新宿"
              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={departureStation}
              onChange={(e) => setDepartureStation(e.target.value)}
            />
          </div>
          {/* 時間入力フォーム */}
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
                <option value="180">1日以内</option>
                <option value="0">無制限（どこまでも）</option>
              </select>
              {/* 矢印アイコンを右端に置くおしゃれ装飾 */}
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

              {PREFECTURES.map(pref => (
                <option key={pref} value={pref}>{pref}</option>
              ))}
            </select>

            {/* メッセージも少し調整 */}
            <p className="text-xs text-slate-500 mt-1 text-right">
              {selectedPref === "全国"
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
              {/* 推定時間の表示 */}
              {resultStation.estimatedTime && (
                <div className="mt-2 py-1 px-3 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full inline-block">
                  {departureStation}から 約{resultStation.estimatedTime}分
                </div>
              )}
              {/* Google Mapsリンク（ここも修正済みです） */}
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