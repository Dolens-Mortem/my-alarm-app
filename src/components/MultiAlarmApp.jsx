import React, { useState, useEffect, useRef } from 'react'

export default function MultiAlarmApp() {
  const [alarms, setAlarms] = useState(() => {
    const saved = localStorage.getItem('alarms')
    return saved ? JSON.parse(saved) : []
  })
  const [newTime, setNewTime] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [uploadedSounds, setUploadedSounds] = useState(() => {
    const saved = localStorage.getItem('sounds')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedSound, setSelectedSound] = useState('')
  const [themeColor, setThemeColor] = useState('#4f46e5')

  // 🔊 состояние разблокировки звука
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  const audioRefs = useRef({})

  // сохраняем в localStorage
  useEffect(() => {
    localStorage.setItem('alarms', JSON.stringify(alarms))
  }, [alarms])

  useEffect(() => {
    localStorage.setItem('sounds', JSON.stringify(uploadedSounds))
  }, [uploadedSounds])

  // проверка будильников каждую секунду
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const current = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`

      alarms.forEach(alarm => {
        if (alarm.time === current && !alarm.triggered) {
          triggerAlarm(alarm)
        }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [alarms, audioUnlocked])

  // разблокировка звука
  function unlockAudio() {
    // проиграем короткий звук
    const a = new Audio(uploadedSounds[0]?.url || '/beep.mp3')
    a.play().catch(() => {})
    setAudioUnlocked(true)
  }

  function triggerAlarm(alarm) {
    alert(`Будильник: ${alarm.label || alarm.time}`)

    // 🔊 играем звук, если разрешено
    if (audioUnlocked) {
      const soundUrl =
        uploadedSounds.find(s => s.id === alarm.soundId)?.url ||
        '/beep.mp3'
      const a = new Audio(soundUrl)
      a.play().catch(err => console.log('Ошибка воспроизведения', err))
    }

    setAlarms(prev =>
      prev.map(a =>
        a.id === alarm.id ? { ...a, triggered: true } : a
      )
    )
  }

  function addAlarm() {
    if (!newTime) return
    const newAlarm = {
      id: Date.now(),
      time: newTime,
      label: newLabel,
      soundId: selectedSound,
      triggered: false,
    }
    setAlarms([...alarms, newAlarm])
    setNewTime('')
    setNewLabel('')
  }

  function deleteAlarm(id) {
    setAlarms(alarms.filter(a => a.id !== id))
  }

  function handleUploadSound(e) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const newSound = {
      id: Date.now(),
      name: file.name,
      url,
    }
    setUploadedSounds(prev => [...prev, newSound])
    setSelectedSound(newSound.id)
  }

  function changeThemeColor(e) {
    setThemeColor(e.target.value)
  }

  return (
    <div
      className="min-h-screen p-4 text-gray-900"
      style={{ backgroundColor: themeColor + '20' }}
    >
      <h1 className="text-2xl font-bold mb-4">Мульти-будильник</h1>

      {!audioUnlocked && (
        <div className="mb-4">
          <button
            onClick={unlockAudio}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Разрешить звук
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <label className="font-medium">Цвет темы:</label>
        <input
          type="color"
          value={themeColor}
          onChange={changeThemeColor}
        />
      </div>

      <div className="mb-4 flex flex-col md:flex-row md:items-end gap-2">
        <div>
          <label className="block font-medium">Время</label>
          <input
            type="time"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Название</label>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            className="border p-2 rounded"
            placeholder="Например: Подъём"
          />
        </div>
        <div>
          <label className="block font-medium">Звук</label>
          <select
            value={selectedSound}
            onChange={e => setSelectedSound(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Стандартный</option>
            {uploadedSounds.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium">Загрузить звук</label>
          <input
            type="file"
            accept="audio/*"
            onChange={handleUploadSound}
            className="border p-2 rounded"
          />
        </div>
        <button
          onClick={addAlarm}
          className="px-4 py-2 bg-indigo-500 text-white rounded h-10 self-center"
        >
          Добавить
        </button>
      </div>

      <ul>
        {alarms.map(a => (
          <li
            key={a.id}
            className="flex items-center justify-between p-2 mb-2 bg-white rounded shadow"
          >
            <div>
              <div className="font-semibold">{a.time}</div>
              <div className="text-sm text-gray-600">{a.label}</div>
              <div className="text-xs text-gray-500">
                Звук:{' '}
                {uploadedSounds.find(s => s.id === a.soundId)?.name ||
                  'Стандартный'}
              </div>
            </div>
            <button
              onClick={() => deleteAlarm(a.id)}
              className="px-2 py-1 bg-red-500 text-white rounded"
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
