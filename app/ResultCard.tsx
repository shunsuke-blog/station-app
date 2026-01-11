// src/app/ResultCard.tsx
//結果表示カード

import React from 'react';

type Props = {
  resultStation: {
    line: string;
    name: string;
    prefecture: string;
    x: number;
    y: number;
    estimatedTime?: number;
  };
  departureStation: string;
};

export default function ResultCard({ resultStation, departureStation }: Props) {
  return (
    <div className="mt-4 p-6 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-center animate-bounce-short">
      <p className="text-sm text-indigo-600 font-bold mb-1">{resultStation.line}</p>
      <h2 className="text-3xl font-black text-slate-800 mb-2">
        {resultStation.name}
        <span className="text-lg font-normal">駅</span>
      </h2>
      <p className="text-xs text-slate-500">
        📍 {resultStation.prefecture} <br />
        {/* (緯度: {resultStation.y}, 経度: {resultStation.x}) */}
      </p>

      {resultStation.estimatedTime && (
        <div className="mt-2 py-1 px-3 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full inline-block">
          {departureStation}から 約{resultStation.estimatedTime}分
        </div>
      )}

      <a
        href={`https://www.google.com/maps?q=$${encodeURIComponent(resultStation.name + "駅")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-4 text-xs text-blue-500 underline hover:text-blue-700"
      >
        Google Mapsで見る
      </a>
    </div>
  );
}