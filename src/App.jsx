import React, { useEffect, useState, useRef } from "react";

// Timed Mental Maths — Full App (bugfix update)
// Fixes: analytics showing zeros due to stale closures when timer ends.
// Strategy: keep latest questions/results/per-question-times in refs and
// ensure the timer/finish path reads from those refs so analytics use
// up-to-date data.
import "./App.css"

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function choose(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function genAddition(difficulty) {
  const max = difficulty === "Easy" ? 50 : difficulty === "Medium" ? 200 : 999;
  const a = randInt(1, max);
  const b = randInt(1, Math.min(max, Math.floor(max / 2)));
  return { prompt: `${a} + ${b}`, answer: (a + b).toString() };
}
function genSubtraction(difficulty) {
  const max = difficulty === "Easy" ? 50 : difficulty === "Medium" ? 200 : 999;
  const a = randInt(1, max);
  const b = randInt(0, a);
  return { prompt: `${a} - ${b}`, answer: (a - b).toString() };
}
function genMultiplication(difficulty) {
  const max = difficulty === "Easy" ? 12 : difficulty === "Medium" ? 20 : 50;
  const a = randInt(2, max);
  const b = randInt(2, max);
  return { prompt: `${a} × ${b}`, answer: (a * b).toString() };
}
function genDivision(difficulty) {
  const max = difficulty === "Easy" ? 12 : difficulty === "Medium" ? 20 : 50;
  const b = randInt(2, max);
  const c = randInt(2, Math.max(2, Math.floor(max / 2)));
  const a = b * c;
  return { prompt: `${a} ÷ ${b}`, answer: c.toString() };
}
function genPercent(difficulty) {
  const baseMax = difficulty === "Easy" ? 100 : difficulty === "Medium" ? 500 : 2000;
  const base = randInt(10, baseMax);
  const perc = choose([5, 10, 12, 15, 20, 25, 33, 40, 50]);
  const ans = (base * perc) / 100;
  return { prompt: `${perc}% of ${base}`, answer: ans.toString() };
}
function genApproxDivision(difficulty) {
  const a = randInt(50, difficulty === "Hard" ? 999 : 500);
  const b = randInt(2, difficulty === "Easy" ? 12 : 20);
  return { prompt: `Approx: ${a} ÷ ${b} (1 dp)`, answer: (Math.round((a / b) * 10) / 10).toFixed(1) };
}
function genPower(difficulty) {
  const baseMax = difficulty === "Easy" ? 5 : difficulty === "Medium" ? 8 : 12;
  const a = randInt(2, baseMax);
  const b = randInt(2, difficulty === "Hard" ? 5 : 3);
  return { prompt: `${a}^${b}`, answer: Math.pow(a, b).toString() };
}
function genRoot(difficulty) {
  const a = randInt(2, difficulty === "Easy" ? 12 : 40);
  return { prompt: `√${a * a}`, answer: a.toString() };
}
function genTwoStep(difficulty) {
  // e.g., (a × b) + c
  const mul = genMultiplication(difficulty);
  const c = randInt(1, difficulty === "Hard" ? 200 : 50);
  const prompt = `(${mul.prompt}) + ${c}`;
  const answer = Number(mul.answer) + c;
  return { prompt, answer: answer.toString() };
}
function genSequence(difficulty) {
  const kind = Math.random() < 0.6 ? "arith" : "geom";
  if (kind === "arith") {
    const start = randInt(1, difficulty === "Hard" ? 50 : 20);
    const diff = randInt(1, difficulty === "Hard" ? 20 : 6);
    const seq = [start, start + diff, start + 2 * diff, start + 3 * diff];
    return { prompt: `${seq.join(', ')}, ? (next)`, answer: (start + 4 * diff).toString() };
  } else {
    const start = randInt(1, 6);
    const ratio = randInt(2, difficulty === "Hard" ? 6 : 4);
    const seq = [start, start * ratio, start * ratio * ratio, start * Math.pow(ratio, 3)];
    return { prompt: `${seq.join(', ')}, ? (next)`, answer: (start * Math.pow(ratio, 4)).toString() };
  }
}

function generateOne(difficulty) {
  const pool = [
    genAddition,
    genSubtraction,
    genMultiplication,
    genDivision,
    genPercent,
    genApproxDivision,
    genPower,
    genRoot,
    genTwoStep,
    genSequence,
  ];
  return choose(pool)(difficulty);
}

function generateUniqueQuestions(count, difficulty) {
  const asked = new Set();
  const out = [];
  let attempts = 0;
  while (out.length < count) {
    const q = generateOne(difficulty);
    if (!asked.has(q.prompt)) {
      asked.add(q.prompt);
      out.push(q);
    }
    attempts++;
    if (attempts > count * 50) {
      console.warn('could not generate enough unique questions, filling with randoms');
      while (out.length < count) out.push(generateOne(difficulty));
      break;
    }
  }
  return out;
}

export default function TimedMentalMaths() {
  const [stage, setStage] = useState('menu'); // menu | test | results
  const [minutes, setMinutes] = useState(8);
  const [difficulty, setDifficulty] = useState('Mixed');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [perQuestionTime, setPerQuestionTime] = useState([]); // seconds
  const [results, setResults] = useState([]);

  // Refs to always read the latest values from timer callbacks
  const startTsRef = useRef(null);
  const timerRef = useRef(null);
  const questionsRef = useRef([]);
  const resultsRef = useRef([]);
  const perQuestionTimeRef = useRef([]);

  useEffect(() => { return () => clearInterval(timerRef.current); }, []);

  function startTest() {
    const mins = Math.max(1, Math.floor(Number(minutes) || 1));
    const qcount = mins * 10;
    const diff = difficulty === 'Mixed' ? (['Easy','Medium','Hard'][randInt(0,2)]) : difficulty;
    const qs = generateUniqueQuestions(qcount, diff);

    setQuestions(qs);
    questionsRef.current = qs;

    const timesInit = new Array(qcount).fill(0);
    setPerQuestionTime(timesInit);
    perQuestionTimeRef.current = timesInit;

    const resInit = new Array(qcount).fill(null);
    setResults(resInit);
    resultsRef.current = resInit;

    setCurrentIndex(0);
    setUserAnswer('');
    setTimeLeft(mins * 60);
    setRunning(true);
    setStage('test');
    startTsRef.current = Date.now();

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // use the latest results from ref when finishing
          finishTest(resultsRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function submitCurrent() {
    if (!running) return;
    const idx = currentIndex;
    const q = questionsRef.current[idx];
    const now = Date.now();
    const elapsed = (now - startTsRef.current) / 1000;

    const updatedTimes = perQuestionTimeRef.current.slice();
    updatedTimes[idx] = Number((updatedTimes[idx] + elapsed).toFixed(2));

    const normalizedUser = (userAnswer || '').toString().trim();
    const userNum = Number(normalizedUser);
    const expected = q.answer.toString().trim();
    let correct = false;

    if (!isNaN(userNum) && !isNaN(Number(expected))) {
      const diff = Math.abs(userNum - Number(expected));
      correct = diff <= Math.max(0.05 * Math.abs(Number(expected)), 1e-9);
    } else {
      correct = normalizedUser.toLowerCase() === expected.toLowerCase();
    }

    const updatedResults = resultsRef.current.slice();
    updatedResults[idx] = {
      prompt: q.prompt,
      expected: expected,
      answer: normalizedUser,
      correct,
      time: updatedTimes[idx]
    };

    // commit to state and refs
    setPerQuestionTime(updatedTimes);
    perQuestionTimeRef.current = updatedTimes;

    setResults(updatedResults);
    resultsRef.current = updatedResults;

    setUserAnswer('');
    startTsRef.current = Date.now();

    const next = idx + 1;
    if (next >= questionsRef.current.length) {
      finishTest(updatedResults);
      return;
    }
    setCurrentIndex(next);
  }

  function skipCurrent() {
    if (!running) return;
    const idx = currentIndex;
    const now = Date.now();
    const elapsed = (now - startTsRef.current) / 1000;

    const updatedTimes = perQuestionTimeRef.current.slice();
    updatedTimes[idx] = Number((updatedTimes[idx] + elapsed).toFixed(2));

    const updatedResults = resultsRef.current.slice();
    updatedResults[idx] = {
      prompt: questionsRef.current[idx].prompt,
      expected: questionsRef.current[idx].answer.toString(),
      answer: '',
      correct: false,
      time: updatedTimes[idx]
    };

    setPerQuestionTime(updatedTimes);
    perQuestionTimeRef.current = updatedTimes;

    setResults(updatedResults);
    resultsRef.current = updatedResults;

    setUserAnswer('');
    startTsRef.current = Date.now();

    const next = idx + 1;
    if (next >= questionsRef.current.length) { finishTest(updatedResults); return; }
    setCurrentIndex(next);
  }

  function finishTest(finalResults) {
    clearInterval(timerRef.current);
    setRunning(false);

    // use refs if no finalResults provided
    const currentResults = Array.isArray(finalResults) && finalResults.length ? finalResults.slice() : resultsRef.current.slice();
    const currentTimes = perQuestionTimeRef.current.slice();
    const qs = questionsRef.current;

    for (let i = 0; i < qs.length; i++) {
      if (currentResults[i] == null) {
        currentResults[i] = {
          prompt: qs[i].prompt,
          expected: qs[i].answer.toString(),
          answer: '',
          correct: false,
          time: Number((currentTimes[i] || 0).toFixed(2))
        };
      }
    }

    setResults(currentResults);
    resultsRef.current = currentResults;
    setStage('results');
  }

  function exportCSV() {
    if (!resultsRef.current || resultsRef.current.length === 0) return;
    const headers = ['#', 'Question', 'YourAnswer', 'CorrectAnswer', 'Correct', 'Time(s)'];
    const rows = resultsRef.current.map((r, i) => [i+1, `"${r.prompt}"`, `"${r.answer}"`, `"${r.expected}"`, r.correct ? 'Yes' : 'No', r.time]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `math_results_${new Date().toISOString().slice(0,19)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function restartSame() {
    setStage('menu');
    setTimeout(() => startTest(), 100);
  }

  function formatTime(s) { const mm = Math.floor(s/60); const ss = s%60; return `${mm}:${String(ss).padStart(2,'0')}`; }

  // render
  if (stage === 'menu') {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="ui-card animate-fadein" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3vw'}}>
        <h1 className="text-4xl font-extrabold mb-8 text-center text-purple-700 drop-shadow" style={{letterSpacing: '0.04em'}}>🧠 Timed Mental Maths</h1>
        <div style={{width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '2vw'}}>
          <label style={{fontSize: '1.5rem', fontWeight: 600, marginBottom: 12, color: '#eebbc3'}}>
            Time limit (minutes)
            <input
              type="number"
              min="1"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              className="answer-input"
              style={{marginTop: 12, width: '100%'}}
            />
            <span style={{fontSize: '1rem', color: '#b8b8d1', marginTop: 6, display: 'block'}}>Total questions = minutes × 10</span>
          </label>
          <label style={{fontSize: '1.5rem', fontWeight: 600, marginBottom: 12, color: '#eebbc3'}}>
            Difficulty
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              className="answer-input"
              style={{marginTop: 12, width: '100%'}}
            >
              <option>Mixed</option>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
            <span style={{fontSize: '1rem', color: '#b8b8d1', marginTop: 6, display: 'block'}}>Mixed will randomize Easy/Medium/Hard per session</span>
          </label>
        </div>
        <div style={{display: 'flex', gap: '2vw', marginTop: 24}}>
          <button
            onClick={startTest}
            className="bg-green-600 text-white font-bold"
            style={{fontSize: '2rem', padding: '1em 2.5em'}}
          >
            Start Test
          </button>
          <button
            onClick={() => { setMinutes(8); setDifficulty('Mixed'); }}
            className="bg-gray-200 font-semibold"
            style={{fontSize: '2rem', padding: '1em 2.5em'}}
          >
            Reset
          </button>
        </div>
        <div style={{marginTop: 32, fontSize: '1.2rem', color: '#b8b8d1', textAlign: 'center', maxWidth: 600}}>
          Questions are unique within a session.<br />
          When time expires or you finish all questions, analytics will appear automatically.
        </div>
      </div>
    </div>
  );
}

  if (stage === 'test') {
    const total = questions.length;
    const answeredCount = results.filter(r => r != null).length;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <div className="ui-card animate-fadein">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-sm text-gray-600">Progress</div>
              <div className="text-xl font-semibold">{Math.min(currentIndex+1, total)} / {total}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Time left</div>
              <div className={`text-3xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-purple-700'}`}>{formatTime(timeLeft)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Answered</div>
              <div className="text-xl font-semibold">{answeredCount}</div>
            </div>
          </div>

          <div className="border-2 border-purple-200 rounded-2xl p-10 bg-purple-50 shadow-inner flex flex-col items-center justify-center mb-8">
            <div className="mb-2">
              <div className="text-base text-gray-500 text-center">Question #{currentIndex + 1}</div>
            </div>
            <div className="text-5xl font-extrabold text-center text-purple-800 drop-shadow-lg mb-6 tracking-wide animate-question-pop">{questions[currentIndex]?.prompt}</div>

            <div className="flex gap-4 items-center justify-center">
              <input
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitCurrent(); }}
                className="rounded-xl border-2 border-purple-300 p-4 flex-1 font-mono text-2xl text-center focus:ring-2 focus:ring-purple-400 transition"
                placeholder="Type answer…"
                autoFocus
              />

              <button onClick={submitCurrent} className="px-6 py-3 bg-green-600 text-white rounded-xl text-lg font-bold shadow hover:scale-105 transition">Submit</button>
              <button onClick={skipCurrent} className="px-5 py-3 bg-yellow-300 text-yellow-900 rounded-xl text-lg font-bold shadow hover:bg-yellow-400 transition">Skip</button>
            </div>

            <div className="mt-4 text-sm text-gray-600 text-center">Keyboard: <span className="font-mono bg-gray-100 px-2 py-1 rounded">Enter</span> to submit. <span className="font-mono bg-gray-100 px-2 py-1 rounded">Skip</span> if unsure.</div>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2 text-sm justify-center">
            {questions.map((_, idx) => (
              <button key={idx} onClick={() => setCurrentIndex(idx)} className={`p-2 rounded-lg border-2 font-bold transition ${idx === currentIndex ? 'ring-2 ring-purple-400 border-purple-400 bg-purple-100' : ''} ${results[idx] ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} hover:bg-purple-50`}>
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // results
  if (stage === 'results') {
    const total = results.length;
    const correctCount = results.filter(r => r && r.correct).length;
    const wrongCount = results.filter(r => r && !r.correct && r.answer !== '').length;
    const skipped = total - results.filter(r => r && r.answer !== '').length;
    const accuracy = total ? ((correctCount / total) * 100).toFixed(1) : '0.0';
    const avgTime = total ? (results.reduce((s, r) => s + (r ? r.time : 0), 0) / total).toFixed(2) : '0.00';

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <div className="ui-card animate-fadein">
          <h1 className="text-3xl font-extrabold mb-6 text-center text-purple-700 drop-shadow">🎉 Results</h1>
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="p-6 bg-green-50 rounded-2xl shadow text-center">
              <div className="text-sm text-gray-500">Correct</div>
              <div className="text-2xl font-extrabold text-green-700">{correctCount}</div>
            </div>
            <div className="p-6 bg-red-50 rounded-2xl shadow text-center">
              <div className="text-sm text-gray-500">Wrong</div>
              <div className="text-2xl font-extrabold text-red-700">{wrongCount}</div>
            </div>
            <div className="p-6 bg-yellow-50 rounded-2xl shadow text-center">
              <div className="text-sm text-gray-500">Skipped</div>
              <div className="text-2xl font-extrabold text-yellow-700">{skipped}</div>
            </div>
            <div className="p-6 bg-purple-50 rounded-2xl shadow text-center">
              <div className="text-sm text-gray-500">Accuracy</div>
              <div className="text-2xl font-extrabold text-purple-700">{accuracy}%</div>
            </div>
          </div>

          <div className="mb-6 text-center text-lg">Average time per question: <span className="font-mono text-purple-700">{avgTime}s</span></div>

          <div className="overflow-auto max-h-96 border-2 border-purple-100 rounded-2xl shadow-inner mb-8">
            <table>
              <thead className="bg-purple-100 sticky top-0">
                <tr>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Question</th>
                  <th className="p-3 text-left">Your Answer</th>
                  <th className="p-3 text-left">Correct Answer</th>
                  <th className="p-3 text-left">Correct</th>
                  <th className="p-3 text-left">Time(s)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={`${r.correct ? 'bg-green-50' : 'bg-red-50'} hover:bg-purple-50 transition`}>
                    <td className="p-3">{i+1}</td>
                    <td className="p-3 font-mono">{r.prompt}</td>
                    <td className="p-3 font-mono">{r.answer || '—'}</td>
                    <td className="p-3 font-mono">{r.expected}</td>
                    <td className="p-3 text-lg">{r.correct ? '✅' : '❌'}</td>
                    <td className="p-3">{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-4 justify-center">
            <button onClick={exportCSV} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl text-lg font-bold shadow hover:scale-105 transition">Export CSV</button>
            <button onClick={restartSame} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-lg font-bold shadow hover:scale-105 transition">Restart Same Test</button>
            <button onClick={() => setStage('menu')} className="px-6 py-3 bg-gray-300 rounded-xl text-lg font-semibold hover:bg-gray-400 transition">Back to Menu</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
