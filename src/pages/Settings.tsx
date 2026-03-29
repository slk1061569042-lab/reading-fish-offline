import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettingsToDefault,
  saveSettings,
  type GameMode,
  type GameSettings,
} from '../modules/storage'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      {hint && <span className="settings-field__hint">{hint}</span>}
      {children}
    </label>
  )
}

function modeLabel(mode: GameMode) {
  switch (mode) {
    case 'reverse':
      return '守护模式：开始自带鱼，安静太久会掉鱼。'
    case 'study':
      return '自习模式：持续安静越久，鱼越多，还能触发稀有鱼。'
    default:
      return '朗读模式：持续出声阅读，鱼会越来越多。'
  }
}

function formatDecimalInput(value: number, digits = 3) {
  return String(value.toFixed(digits)).replace(/0+$/, '').replace(/\.$/, '')
}

function parseDecimalInput(raw: string, fallback: number) {
  const normalized = raw.replace(/,/g, '.').trim()
  if (!normalized) return fallback
  const num = Number(normalized)
  return Number.isFinite(num) ? num : fallback
}

function DecimalInput({ value, onChange, min, max, placeholder }: {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  placeholder?: string
}) {
  const [text, setText] = useState(formatDecimalInput(value))

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const nextText = e.target.value
        setText(nextText)
        const parsed = parseDecimalInput(nextText, value)
        if (Number.isFinite(parsed)) {
          const clamped = Math.min(max, Math.max(min, parsed))
          onChange(clamped)
        }
      }}
      onBlur={() => setText(formatDecimalInput(Math.min(max, Math.max(min, value))))}
      autoComplete="off"
      spellCheck={false}
    />
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
    if (!window.confirm('恢复为默认设置？')) return
    persist(resetSettingsToDefault())
  }

  return (
    <>
      <header>
        <h1 className="page-title">设置</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.92rem' }}>
          这里保留灵敏度与节奏参数；首页直接选“早读养鱼 / 自习养鱼”。
        </p>
      </header>

      <form className="card settings-form" onSubmit={onSubmit}>
        <Field label="默认模式" hint={modeLabel(form.mode)}>
          <div className="mode-switch" role="group" aria-label="模式选择">
            <button type="button" className={form.mode === 'positive' ? '' : 'secondary'} onClick={() => update('mode', 'positive')}>
              朗读
            </button>
            <button type="button" className={form.mode === 'reverse' ? '' : 'secondary'} onClick={() => update('mode', 'reverse')}>
              守护
            </button>
            <button type="button" className={form.mode === 'study' ? '' : 'secondary'} onClick={() => update('mode', 'study')}>
              自习
            </button>
          </div>
        </Field>

        <Field label="朗读判定阈值 (RMS)" hint="移动端已改成稳定的小数输入，不再用 number 输入框。">
          <DecimalInput value={form.activeThreshold} min={0.001} max={0.08} onChange={(v) => update('activeThreshold', v)} placeholder="如 0.012" />
        </Field>
        <Field label="静音阈值 (RMS)" hint="低于此值更容易被认为安静；需小于朗读阈值。">
          <DecimalInput value={form.quietThreshold} min={0.0005} max={0.06} onChange={(v) => update('quietThreshold', v)} placeholder="如 0.006" />
        </Field>
        <Field label="静音保持 (毫秒)" hint="连续安静多久后视为稳定安静 / 暂停。">
          <input type="number" inputMode="numeric" step={10} min={100} max={3000} value={form.quietHoldMs} onChange={(e) => update('quietHoldMs', Number(e.target.value))} />
        </Field>
        <Field label="鱼节奏 (秒)" hint="累计满此秒数得到或恢复一条鱼；自习模式也用这个节奏。">
          <input type="number" inputMode="numeric" step={1} min={3} max={120} value={form.fishEverySeconds} onChange={(e) => update('fishEverySeconds', Number(e.target.value))} />
        </Field>
        <Field label="守护模式初始鱼数" hint="开始会话时的鱼缸数量（0–24）。">
          <input type="number" inputMode="numeric" step={1} min={0} max={24} value={form.reverseInitialFish} onChange={(e) => update('reverseInitialFish', Number(e.target.value))} />
        </Field>

        <div className="settings-actions">
          <button type="submit">保存</button>
          <button type="button" className="secondary" onClick={onReset}>恢复默认</button>
        </div>
        {savedFlash && <p className="settings-saved">已保存</p>}
      </form>

      <div className="card" style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--text)' }}>默认值参考</strong>
        <ul style={{ margin: '0.45rem 0 0', paddingLeft: '1.1rem' }}>
          <li>朗读阈值：{DEFAULT_SETTINGS.activeThreshold}</li>
          <li>静音阈值：{DEFAULT_SETTINGS.quietThreshold}</li>
          <li>静音保持：{DEFAULT_SETTINGS.quietHoldMs} ms</li>
          <li>鱼节奏：{DEFAULT_SETTINGS.fishEverySeconds} s</li>
        </ul>
      </div>

      <Link to="/">
        <button type="button" className="secondary">回首页</button>
      </Link>
    </>
  )
}
