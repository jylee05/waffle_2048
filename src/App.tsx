import { useState, useEffect, useCallback } from "react";
import "./styles.css";

// ---------- 타입 정의 ----------
type Cell = { value: number; merged: boolean } | null;
type Map2048 = Cell[][];
type Direction = "up" | "down" | "left" | "right";
type MoveResult = {
  result: Map2048;
  isMoved: boolean;
  scoreGained: number;
};

// ---------- 상수 ----------
const SIZE = 4;

const TILE_COLORS: Record<number, string> = {
  2: "tile-2",
  4: "tile-4",
  8: "tile-8",
  16: "tile-16",
  32: "tile-32",
  64: "tile-64",
  128: "tile-128",
};

// ---------- 헬퍼 함수 ----------

// 새 타일 생성
const generateTile = (map: Map2048): Map2048 => {
  const emptyCells: [number, number][] = [];
  map.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (!cell) emptyCells.push([y, x]);
    })
  );
  if (emptyCells.length === 0) return map;

  const [y, x] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newMap = map.map((row) =>
    row.map((cell) => (cell ? { ...cell } : null))
  );
  newMap[y][x] = { value: Math.random() < 0.9 ? 2 : 4, merged: false };
  return newMap;
};

// 좌측 이동 로직
const moveLeft = (map: Map2048): MoveResult => {
  let moved = false;
  let scoreGained = 0;

  const newMap = map.map((row) => {
    const filtered = row.filter((cell) => cell !== null) as {
      value: number;
      merged: boolean;
    }[];
    const resultRow: Cell[] = [];
    let skip = false;

    for (let i = 0; i < filtered.length; i++) {
      if (skip) {
        skip = false;
        continue;
      }
      if (
        i + 1 < filtered.length &&
        filtered[i].value === filtered[i + 1].value
      ) {
        const mergedValue = filtered[i].value * 2;
        scoreGained += mergedValue;
        resultRow.push({ value: mergedValue, merged: true });
        skip = true;
      } else {
        resultRow.push({ ...filtered[i], merged: false });
      }
    }

    while (resultRow.length < SIZE) resultRow.push(null);

    if (
      !moved &&
      row.some(
        (cell, idx) => (cell?.value ?? null) !== (resultRow[idx]?.value ?? null)
      )
    )
      moved = true;

    return resultRow;
  });

  return { result: newMap, isMoved: moved, scoreGained };
};

// 맵 회전
const rotateMap = (map: Map2048, times: number): Map2048 => {
  let rotated = map.map((row) =>
    row.map((cell) => (cell ? { ...cell } : null))
  );
  for (let t = 0; t < times; t++) {
    rotated = rotated[0].map((_, i) => rotated.map((row) => row[i]).reverse());
  }
  return rotated;
};

// 방향별 회전 매핑
const directionToRotation: Record<Direction, number> = {
  left: 0,
  up: 3,
  right: 2,
  down: 1,
};

// ---------- merged 초기화 ----------
const resetMerged = (map: Map2048): Map2048 =>
  map.map((row) =>
    row.map((cell) => (cell ? { ...cell, merged: false } : null))
  );

// ---------- 방향 이동 통합 ----------
const moveMap = (map: Map2048, direction: Direction) => {
  const rotatedTimes = directionToRotation[direction];
  let rotated = rotateMap(map, rotatedTimes);
  const { result, isMoved, scoreGained } = moveLeft(rotated);
  const finalMap = rotateMap(result, (4 - rotatedTimes) % 4);
  return { result: finalMap, isMoved, scoreGained };
};

// 게임 오버 여부 확인
const checkGameOver = (map: Map2048): boolean => {
  // 빈 칸이 있으면 게임 오버가 아님
  if (map.flat().some((cell) => cell === null)) {
    return false;
  }

  // 인접한 타일 중 같은 숫자가 있는지 확인
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const value = map[y][x]?.value;
      if (value) {
        // 인접한 셀 확인
        const directions = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        for (const [dy, dx] of directions) {
          const newY = y + dy;
          const newX = x + dx;
          if (newY >= 0 && newY < SIZE && newX >= 0 && newX < SIZE) {
            if (map[newY][newX]?.value === value) {
              return false; // 합쳐질 타일이 있음
            }
          }
        }
      }
    }
  }
  return true; // 더 이상 움직일 수 없음
};

// ---------- App Component ----------
const App = () => {
  const emptyMap: Map2048 = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null)
  );

  const [map, setMap] = useState<Map2048>(() => {
    const saved = localStorage.getItem("map2048");
    return saved ? JSON.parse(saved) : generateTile(generateTile(emptyMap));
  });

  const [score, setScore] = useState<number>(() => {
    const saved = localStorage.getItem("map2048_score");
    return saved ? JSON.parse(saved) : 0;
  });

  const [bestScore, setBestScore] = useState<number>(() => {
    const saved = localStorage.getItem("2048-best-score");
    return saved ? JSON.parse(saved) : 0;
  });

  const [_history, setHistory] = useState<Map2048[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  // ---------- Move ----------
  const handleMove = useCallback(
    (direction: Direction) => {
      if (gameOver || win) return;
      const { result, isMoved, scoreGained } = moveMap(map, direction);
      if (!isMoved) return;

      const newMap = generateTile(result);
      setHistory((prev) => [...prev, map]);
      setMap(resetMerged(newMap));
      const newScore = score + scoreGained;
      setScore(newScore);

      localStorage.setItem("map2048", JSON.stringify(newMap));
      localStorage.setItem("map2048_score", JSON.stringify(newScore));

      if (newScore > bestScore) {
        setBestScore(newScore);
        localStorage.setItem("2048-best-score", JSON.stringify(newScore));
      }

      // 128 타일 도달 시 승리
      if (newMap.flat().some((cell) => cell?.value === 128)) {
        setWin(true);
      }

      // 더 이상 움직일 수 없을 때 게임 오버
      if (checkGameOver(newMap)) {
        setGameOver(true);
      }
    },
    [map, score, gameOver, win, bestScore]
  );

  // ---------- Undo ----------
  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setMap(resetMerged(last));
      localStorage.setItem("map2048", JSON.stringify(last));
      return prev.slice(0, -1);
    });
  };

  // ---------- New Game ----------
  const handleNewGame = () => {
    const newMap = generateTile(generateTile(emptyMap));
    setMap(resetMerged(newMap));
    setScore(0);
    setHistory([]);
    setGameOver(false);
    setWin(false);
    localStorage.setItem("map2048", JSON.stringify(newMap));
    localStorage.setItem("map2048_score", "0");
  };

  // 최고 점수 초기화
  const handleResetBestScore = () => {
    setBestScore(0);
    localStorage.removeItem("2048-best-score");
  };

  // ---------- Keyboard ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver || win) return;
      switch (e.key) {
        case "ArrowUp":
          handleMove("up");
          break;
        case "ArrowDown":
          handleMove("down");
          break;
        case "ArrowLeft":
          handleMove("left");
          break;
        case "ArrowRight":
          handleMove("right");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMove, gameOver, win]);

  // ---------- Render ----------
  return (
    <div className="game-container">
      <div className="header-container">
        <h1 className="title">2048 Game</h1>
        <p className="subtitle">Join the numbers and get to the 2048 tile!</p>
        <div className="score-container">
          <div className="score-box">
            <div className="score-label">SCORE</div>
            <div className="score-value">{score}</div>
          </div>
          <div className="score-box">
            <div className="score-label">BEST</div>
            <div className="score-value">{bestScore}</div>
          </div>
        </div>
        <div className="button-group">
          <button onClick={handleUndo} className="game-button">
            Undo
          </button>
          <button
            onClick={handleNewGame}
            className="game-button new-game-button"
          >
            New Game
          </button>
          <button onClick={handleResetBestScore} className="game-button">
            Reset Best Score
          </button>
        </div>
      </div>
      {gameOver && !win && <p className="game-over-message">Game Over!</p>}
      {win && (
        <p className="game-over-message">🎉 You reached 128! You win! 🎉</p>
      )}
      <div className="board-container">
        <div className="game-board">
          {map.flat().map((cell, idx) => (
            <div
              key={idx}
              className={`tile ${
                cell ? TILE_COLORS[cell.value] : "tile-empty"
              } ${cell?.merged ? "merged-tile" : ""}`}
            >
              {cell?.value || ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
