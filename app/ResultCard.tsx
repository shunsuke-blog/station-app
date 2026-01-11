// src/app/ResultCard.tsx
//結果出力カード
import React from 'react';

type Props = {
  resultStation: {
    line: string;
    name: string;
    prefecture: string;
    x: number;
    y: number;
    // ★ここにも prev / next を追加
    prev?: string;
    next?: string;
    estimatedTime?: number;
  };
  departureStation: string;
};

export default function ResultCard({ resultStation, departureStation }: Props) {
  return (
    <div className="mt-4 p-6 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-center animate-bounce-short">

      {/* 路線名 */}
      <p className="text-sm text-indigo-600 font-bold mb-4">{resultStation.line}</p>

      <div className="flex items-center justify-center gap-2 mb-2">
        {/* 前の駅（あれば表示） */}
        <div className={`text-s text-slate-400 ${!resultStation.prev ? "invisible" : ""}`}>
          {resultStation.prev}<br />
        </div>

        {/* つなぎ棒 */}
        <div className="text-slate-300 font-light">ー</div>

        {/* メインの当選駅 */}
        <div>
          <h2 className="text-3xl font-black text-slate-800 leading-none">
            {resultStation.name}
          </h2>
        </div>

        {/* つなぎ棒 */}
        <div className="text-slate-300 font-light">―</div>

        {/* 次の駅（あれば表示） */}
        <div className={`text-s text-slate-400 ${!resultStation.next ? "invisible" : ""}`}>
          {resultStation.next}<br />
        </div>
      </div>

      {/* 都道府県などの情報 */}
      <p className="text-xs text-slate-500 mt-4">
        📍 {resultStation.prefecture} <br />
        {/* (緯度: {resultStation.y}, 経度: {resultStation.x}) */}
      </p>

      {resultStation.estimatedTime && (
        <div className="mt-2 py-1 px-3 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full inline-block">
          {departureStation}から 約{resultStation.estimatedTime}分
        </div>
      )}

      <br />

      <a
        href={`https://www.google.com/maps?q=${encodeURIComponent(resultStation.name + "駅")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-4 text-xs text-blue-500 underline hover:text-blue-700"
      >
        Google Mapsで見る
      </a>
    </div>
  );
}