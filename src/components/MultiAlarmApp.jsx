/*
MultiAlarmApp.jsx
Single-file React component for a multi-alarm website.

How to use:
1. Create a React app (Vite or CRA). E.g. with Vite:
   npm create vite@latest my-alarm-app --template react
2. Install Tailwind CSS (optional but recommended for styling). Follow Tailwind setup for Vite/CRA.
3. Place this file under src/components/MultiAlarmApp.jsx and import it from App.jsx.

Features implemented in this single file:
- Create multiple alarms (time, label)
- Enable/disable alarms independently
- Upload custom sound files for each alarm (uses Object URLs)
- Preview uploaded sounds
- Global color theme picker (applies to UI accent color)
- LocalStorage persistence for alarms and theme
- In-browser notifications and sound playback when alarm triggers
- Basic responsive layout and accessibility hints

Notes & limitations:
- Browsers require user interaction to allow audio play and Notification permission; request is triggered by UI actions.
- Uploaded sounds are stored in memory as object URLs and will be lost when the page reloads; for persistent hosting, upload to server or cloud storage and save URLs.
- This is a single-file demo; for production split into components, add tests, and handle edge cases (timezones, DST)
*/

import React, { useEffect, useState, useRef } from "react";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_SOUNDS = [
  { name: "Beep", url: "data:audio/wav;base64,//uQZAAAAAAAAAAAAAA..." },
  // Note: real base64 sound omitted for brevity; you can replace with an actual asset.
];

export default function MultiAlarmApp() {
  const [alarms, setAlarms] = useState(() => {
    try {
      const raw = localStorage.getItem("multi_alarms_v1");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [timeValue, setTimeValue] = useState("");
  const [labelValue, setLabelValue] = useState("");
  const [globalColor, setGlobalColor] = useState(() => localStorage.getItem("alarm_theme_color") || "#4f46e5");
  const [uploadedSounds, setUploadedSounds] = useState(() => {
    try {
      const raw = localStorage.getItem("uploaded_sounds_v1");
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  });

  const audioRefs = useRef({});
  const tickRef = useRef();

  useEffect(() => {
    localStorage.setItem("multi_alarms_v1", JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    localStorage.setItem("alarm_theme_color", globalColor);
  }, [globalColor]);

  useEffect(() => {
    localStorage.setItem("uploaded_sounds_v1", JSON.stringify(uploadedSounds));
  }, [uploadedSounds]);

  useEffect(() => {
    // tick every second to check alarms
    tickRef.current = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const cur = `${hh}:${mm}`;
      setAlarms(prev => {
        // trigger alarms that are enabled and match current minute and not already triggered this minute
        return prev.map(a => {
          if (a.enabled && !a._lastTriggeredMinute && a.time === cur) {
            triggerAlarm(a);
            return { ...a, _lastTriggeredMinute: `${hh}:${mm}` };
          }
          // reset _lastTriggeredMinute when minute changes
          if (a._lastTriggeredMinute && a._lastTriggeredMinute !== cur) {
            return { ...a, _lastTriggeredMinute: null };
          }
          return a;
        });
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const requestNotification = async () => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try {
        await Notification.requestPermission();
      } catch (e) {
        // ignore
      }
    }
  };

  useEffect(() => {
    // attempt to restore audioRefs for uploaded sounds
    uploadedSounds.forEach(s => {
      if (!audioRefs.current[s.id]) audioRefs.current[s.id] = new Audio(s.url);
    });
  }, []);

  function addAlarm(e) {
    e?.preventDefault();
    if (!timeValue) return;
    const newAlarm = {
      id: uid(),
      time: timeValue,
      label: labelValue || "Alarm",
      enabled: true,
      soundId: uploadedSounds[0]?.id || null,
      soundName: uploadedSounds[0]?.name || "Default",
      createdAt: Date.now(),
      _lastTriggeredMinute: null,
    };
    setAlarms(prev => [...prev, newAlarm]);
    setTimeValue("");
    setLabelValue("");
    requestNotification();
  }

  function removeAlarm(id) {
    setAlarms(prev => prev.filter(a => a.id !== id));
  }

  function toggleAlarm(id) {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  function updateAlarmSound(alarmId, soundId) {
    const sound = uploadedSounds.find(s => s.id === soundId);
    setAlarms(prev => prev.map(a => a.id === alarmId ? { ...a, soundId: sound?.id || null, soundName: sound?.name || "Default" } : a));
  }

  function triggerAlarm(alarm) {
    // show notification
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(alarm.label || "Alarm", { body: `It's ${alarm.time}` });
    }

    // play sound
    const sound = uploadedSounds.find(s => s.id === alarm.soundId);
    let audio;
    if (sound) {
      audio = audioRefs.current[sound.id] || new Audio(sound.url);
      audioRefs.current[sound.id] = audio;
    } else {
      audio = new Audio(); // silent default
    }
    audio.loop = true;
    audio.play().catch(() => {
      // play may be blocked until user interacts — we asked for permission elsewhere
    });

    // show a modal-like prompt in-page to stop the alarm
    const stopLabel = `${alarm.label} — ${alarm.time}`;
    // keep it simple: create a browser confirm (blocking) to stop
    const stop = window.confirm(`${stopLabel}\n
Press OK to stop alarm.
(You might need to interact to allow audio playback.)`);
    if (stop) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    const newItems = files.map(f => {
      const url = URL.createObjectURL(f);
      return {
        id: uid(),
        name: f.name,
        url,
        size: f.size,
        uploadedAt: Date.now(),
      };
    });
    // preload
    newItems.forEach(it => audioRefs.current[it.id] = new Audio(it.url));
    setUploadedSounds(prev => [...newItems, ...prev]);
    e.target.value = null;
  }

  function previewSound(id) {
    const a = audioRefs.current[id];
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function removeSound(id) {
    const s = uploadedSounds.find(x => x.id === id);
    if (s) URL.revokeObjectURL(s.url);
    setUploadedSounds(prev => prev.filter(x => x.id !== id));
    setAlarms(prev => prev.map(a => (a.soundId === id ? { ...a, soundId: null, soundName: "Default" } : a)));
  }

  function formatAlarm(a) {
    return `${a.time} — ${a.label}`;
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 antialiased" style={{ fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: globalColor }}>Multi-Alarm</h1>
          <p className="text-sm text-gray-600">Create multiple alarms, upload sounds, change interface color. Works in-browser, saved in localStorage.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <form className="p-4 rounded-lg shadow-sm bg-white" onSubmit={addAlarm}>
            <h2 className="text-lg font-semibold mb-3">Add alarm</h2>
            <label className="block text-sm">Time</label>
            <input aria-label="alarm-time" type="time" value={timeValue} onChange={e => setTimeValue(e.target.value)} className="mt-1 w-full p-2 border rounded" required />

            <label className="block text-sm mt-3">Label</label>
            <input aria-label="alarm-label" type="text" value={labelValue} onChange={e => setLabelValue(e.target.value)} className="mt-1 w-full p-2 border rounded" placeholder="Morning run" />

            <label className="block text-sm mt-3">Sound</label>
            <select onChange={e => {
              const id = e.target.value || null;
            }} className="mt-1 w-full p-2 border rounded">
              <option value="">(use default / preview below)</option>
              {uploadedSounds.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="mt-3 flex items-center gap-2">
              <button type="submit" className="px-4 py-2 rounded shadow" style={{ background: globalColor, color: '#fff' }}>Add</button>
              <button type="button" onClick={() => { setTimeValue(""); setLabelValue(""); }} className="px-3 py-2 border rounded">Reset</button>
            </div>

            <div className="mt-4">
              <label className="block text-sm">Upload sounds</label>
              <input aria-label="upload-sounds" type="file" accept="audio/*" onChange={handleFileUpload} className="mt-2" multiple />
              <small className="text-xs text-gray-500">Uploaded sounds are stored temporarily (Object URLs). For persistence, upload to a server.</small>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Uploaded sounds</h3>
              <ul className="mt-2 space-y-2 max-h-40 overflow-auto">
                {uploadedSounds.length === 0 && <li className="text-xs text-gray-500">No sounds uploaded yet.</li>}
                {uploadedSounds.map(s => (
                  <li key={s.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="truncate mr-3">{s.name}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => previewSound(s.id)} className="px-2 py-1 text-sm border rounded">Preview</button>
                      <button onClick={() => removeSound(s.id)} className="px-2 py-1 text-sm border rounded">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </form>

          <div className="p-4 rounded-lg shadow-sm bg-white md:col-span-2">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Alarms ({alarms.length})</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm">Theme</label>
                <input aria-label="theme-color" type="color" value={globalColor} onChange={e => setGlobalColor(e.target.value)} className="w-10 h-8 p-0 border-0" />
                <button onClick={() => { setAlarms([]); }} className="px-2 py-1 border rounded text-sm">Clear all</button>
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              {alarms.length === 0 && <div className="text-sm text-gray-500">No alarms yet — add one on the left.</div>}
              {alarms.map(a => (
                <div key={a.id} className="p-3 rounded border flex items-center justify-between bg-white">
                  <div>
                    <div className="text-lg font-medium" style={{ color: globalColor }}>{a.time}</div>
                    <div className="text-sm text-gray-600">{a.label}</div>
                    <div className="text-xs text-gray-500 mt-1">Sound: {a.soundName || 'Default'}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select aria-label={`select-sound-${a.id}`} value={a.soundId || ""} onChange={e => updateAlarmSound(a.id, e.target.value)} className="p-2 border rounded text-sm">
                      <option value="">Default</option>
                      {uploadedSounds.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={a.enabled} onChange={() => toggleAlarm(a.id)} />
                      <span className="text-sm">Enabled</span>
                    </label>
                    <button onClick={() => removeAlarm(a.id)} className="px-2 py-1 border rounded">Delete</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium">Tips</h3>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
}
