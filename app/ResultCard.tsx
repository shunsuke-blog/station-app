// src/app/ResultCard.tsx
import React from 'react';

type Props = {
  resultStation: {
    line: string;
    name: string;
    prefecture: string;
    x: number;
    y: number;
    prev?: string;
    next?: string;
    estimatedTime?: number;
  };
  departureStation: string;
};

export default function ResultCard({ resultStation, departureStation }: Props) {
  const handleSave = () => {
    // 1. 今表示されている駅名を取得（例: stationNameという変数に入っているとする）
    const stationName = resultStation.name;
    const visitDate = new Date().toLocaleDateString(); // 今日の日付

    // 2. 今までの保存データを取得（なければ空のリスト [] を作る）
    const currentHistory = JSON.parse(localStorage.getItem("stationHistory") || "[]");

    // 3. 新しい記録を追加
    const newEntry = {
      name: stationName,
      date: visitDate,
      prefecture: resultStation.prefecture // ★これを追加
    };
    const newHistory = [...currentHistory, newEntry];

    // 4. LocalStorageに保存（文字に変換して）
    localStorage.setItem("stationHistory", JSON.stringify(newHistory));

    alert("記録しました！");
  };
  return (
    <div className="mt-4 p-6 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-center animate-bounce-short w-full">

      {/* 路線名 */}
      <p className="text-sm text-indigo-600 font-bold mb-4">{resultStation.line}</p>

      {/* メイン表示エリア：左右均等割り */}
      <div className="flex items-center justify-between w-full mb-2">

        {/* 左側：前の駅（flex-1 で幅を確保し、右寄せにする） */}
        <div className="flex-1 flex justify-end items-center min-w-0">
          <div className={`text-s text-slate-400 ${!resultStation.prev ? "invisible" : ""}`}>
            <div className="wrap-break-word whitespace-normal leading-tight max-w-20 sm:max-w-30 ml-auto">
              {resultStation.prev || "dummy"}
            </div>
          </div>
          {/* つなぎ棒 */}
          <div className={`text-slate-300 font-light mx-2 ${!resultStation.prev ? "invisible" : ""}`}>―</div>
        </div>

        {/* 中央：当選した駅（幅は文字数なり、縮まない） */}
        <div className="shrink-0 text-center px-2">
          <h2 className="wrap-break-word leading-tight text-3xl font-black text-slate-800">
            {resultStation.name}
          </h2>
        </div>

        {/* 右側：次の駅（flex-1 で幅を確保し、左寄せにする） */}
        <div className="flex-1 flex justify-start items-center min-w-0">
          {/* つなぎ棒 */}
          <div className={`text-slate-300 font-light mx-2 ${!resultStation.next ? "invisible" : ""}`}>―</div>
          <div className={`text-xs text-slate-400 ${!resultStation.next ? "invisible" : ""}`}>
            <div className="wrap-break-word leading-tight max-w-20 sm:max-w-30 whitespace-normal">
              {resultStation.next || "dummy"}
            </div>
          </div>
        </div>

      </div>

      {/* 都道府県などの情報 */}
      <p className="text-s text-slate-500 mt-4">
        📍 {resultStation.prefecture} <br />
        {/* (緯度: {resultStation.y}, 経度: {resultStation.x}) */}
      </p>

      {resultStation.estimatedTime && (
        <div className="mt-2 py-1 px-3 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full inline-block">
          {departureStation}から 約{resultStation.estimatedTime}分
        </div>
      )}

      <br />
      <div className="mt-6 flex items-center justify-center gap-3">
        {/* Google Mapsリンク */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resultStation.name + "駅")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 underline hover:text-blue-700"
        >
          Google Mapsで見る
        </a>

        {/* 記録ボタン（おとなしいデザインに変更） */}
        <button
          onClick={handleSave}
          className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-3 py-1 transition flex items-center gap-1"
        >
          <span>💾</span> ここに行った！
        </button>
      </div>
    </div>

  );
}