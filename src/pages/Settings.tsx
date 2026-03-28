import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettingsToDefault,
  saveSettings,
  type GameSettings,
} from '../modules/storage'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      {hint && <span className="settings-field__hint">{hint}</span>}
      {children}
    </label>
  )
}

export function Settings() {
  const initial = useMemo(() => loadSettings(), [])
  const [form, setForm] = useState<GameSettings>(initial)
  const [savedFlash, setSavedFlash] = useState(false)

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const persist = (next: GameSettings) => {
    saveSettings(next)
    setForm(next)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1200)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    persist(form)
  }

  const onReset = () => {
    if (!window.confirm('恢复为默认阈值与节奏？')) return
    persist(resetSettingsToDefault())
  }

  return (
    <>
      <header>
        <h1 className="page-title">设置</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.92rem' }}>
          阈值与节奏保存在本机。阅读页会在下次开始麦克风时应用。
        </p>
      </header>

      <form className="card settings-form" onSubmit={onSubmit}>
        <Field label="朗读判定阈值 (RMS)" hint="越高越不容易进入「正在阅读」。">
          <input
            type="number"
            step={0.001}
            min={0.001}
            max={0.08}
            value={form.activeThreshold}
            onChange={(e) => update('activeThreshold', Number(e.target.value))}
          />
        </Field>
        <Field label="静音阈值 (RMS)" hint="低于此值累计静音时间，需小于朗读阈值。">
          <input
            type="number"
            step={0.001}
            min={0.0005}
            max={0.06}
            value={form.quietThreshold}
            onChange={(e) => update('quietThreshold', Number(e.target.value))}
          />
        </Field>
        <Field label="静音保持 (毫秒)" hint="连续静音多久后视为暂停（不计正向有效阅读；反向模式开始失鱼）。">
          <input
            type="number"
            step={10}
            min={100}
            max={3000}
            value={form.quietHoldMs}
            onChange={(e) => update('quietHoldMs', Number(e.target.value))}
          />
        </Field>
        <Field label="鱼节奏 (秒)" hint="正向：有效阅读累计满此秒数得一条鱼。反向：同秒数用于恢复/失鱼节奏。">
          <input
            type="number"
            step={1}
            min={3}
            max={120}
            value={form.fishEverySeconds}
            onChange={(e) => update('fishEverySeconds', Number(e.target.value))}
          />
        </Field>
        <Field label="反向模式初始鱼数" hint="开始会话时的鱼缸数量（0–24）。">
          <input
            type="number"
            step={1}
            min={0}
            max={24}
            value={form.reverseInitialFish}
            onChange={(e) => update('reverseInitialFish', Number(e.target.value))}
          />
        </Field>

        <div className="settings-actions">
          <button type="submit">保存</button>
          <button type="button" className="secondary" onClick={onReset}>
            恢复默认
          </button>
        </div>
        {savedFlash && <p className="settings-saved">已保存</p>}
      </form>

      <div className="card" style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--text)' }}>默认值参考</strong>
        <ul style={{ margin: '0.45rem 0 0', paddingLeft: '1.1rem' }}>
          <li>朗读 {DEFAULT_SETTINGS.activeThreshold} · 静音 {DEFAULT_SETTINGS.quietThreshold}</li>
          <li>静音保持 {DEFAULT_SETTINGS.quietHoldMs} ms</li>
          <li>鱼节奏 {DEFAULT_SETTINGS.fishEverySeconds} s · 反向初始 {DEFAULT_SETTINGS.reverseInitialFish} 条</li>
        </ul>
      </div>

      <Link to="/">
        <button type="button" className="secondary">
          回首页
        </button>
      </Link>
    </>
  )
}
