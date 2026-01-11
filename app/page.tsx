"use client";

import { useState, useEffect } from 'react';

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

// 選択肢としての都道府県リスト
const PREFECTURES = ["東京都", "神奈川県", "大阪府", "愛知県", "北海道", "福岡県"];

export default function Home() {
  const [selectedPref, setSelectedPref] = useState<string>("東京都");
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // 抽出結果
  const [resultStation, setResultStation] = useState<any>(null);

  // 1. 都道府県が変わったら、そのエリアの「路線一覧」をAPIから取得する
  useEffect(() => {
    const fetchLines = async () => {
      setLoading(true);
      setStatusMessage("路線データを取得中...");
      try {
        // APIリクエスト: 指定エリアの路線一覧を取得
        const res = await fetch(`https://express.heartrails.com/api/json?method=getLines&prefecture=${encodeURIComponent(selectedPref)}`);
        const data: LinesResponse = await res.json();
        // setLines(data.response.line);
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
  const handleGacha = async () => {
    if (lines.length === 0) return;

    setLoading(true);
    setResultStation(null);
    setStatusMessage("抽選中...");

    try {
      // step A: 路線をランダムに1つ決める
      const randomLine = lines[Math.floor(Math.random() * lines.length)];
      setStatusMessage(`${randomLine} の駅を検索中...`);

      // step B: その路線の「駅一覧」をAPIから取得する
      const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&line=${encodeURIComponent(randomLine)}`);
      const data: StationsResponse = await res.json();
      const stations = data.response.station;

      // step C: 駅をランダムに1つ決める
      const randomStation = stations[Math.floor(Math.random() * stations.length)];

      setResultStation(randomStation);
      setStatusMessage("");

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
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-800">API連動 駅名ガチャ 🚃</h1>

        <div className="space-y-6">

          {/* 都道府県選択 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">エリア選択</label>
            <select
              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50"
              value={selectedPref}
              onChange={(e) => setSelectedPref(e.target.value)}
              disabled={loading}
            >
              {PREFECTURES.map(pref => (
                <option key={pref} value={pref}>{pref}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1 text-right">
              {lines.length > 0 ? `${lines.length} 路線が見つかりました` : "読み込み中..."}
            </p>
          </div>

          {/* ガチャボタン */}
          <button
            onClick={handleGacha}
            disabled={loading || lines.length === 0}
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
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${resultStation.name}駅`}
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
    </main>
  );
}