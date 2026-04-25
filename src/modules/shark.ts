// 鲨鱼生命周期状态
export type SharkState = 'dormant' | 'awakening' | 'hunting' | 'dying' | 'egg' | 'hatching'

// 鲨鱼技能
type SharkSkill = 'none' | 'dash' | 'shield' | 'devour' | 'ranged'

// 技能配置
export const SHARK_SKILL_CONFIG: Record<SharkSkill, { name: string; desc: string }> = {
  none: { name: '无', desc: '普通鲨鱼' },
  dash: { name: '疾速冲刺', desc: '移动速度+30%，嗅觉范围+20%' },
  shield: { name: '虚空护盾', desc: '受到伤害-40%，每3秒自动恢复1点生命' },
  devour: { name: '吞噬治疗', desc: '每次进食恢复2点生命，有概率连击' },
  ranged: { name: '怨念冲击', desc: '远程打击：每2秒发射一道冲击波，可击中远处敌人' },
}

// 完整鲨鱼对象（用于实时渲染和状态机）
export type LiveShark = {
  id: string
  x: number
  y: number
  vx: number
  phase: number
  state: SharkState
  stateTimer: number   // 当前状态已持续时间（秒）
  level: number        // 1~5
  exp: number
  size: number         // 当前实际尺寸（含等级加成）
  hp: number
  maxHp: number
  bitePulse: number    // 咬合脉冲 0-1
  targetX: number
  targetY: number
  eyeOpen: number      // 0=闭眼 1=睁眼
  dormantX: number     // 睡觉固定位置
  dormantY: number
  levelUpPulse: number // 升级光环脉冲 0-1
  eggSize: number      // 仅 egg/hatching 状态使用
  rotation: number     // 死亡翻身角度
  // 技能相关
  skillCooldown: number // 技能冷却/计时器
  comboCount: number   // 连击计数（devour技能）
  shieldActive: boolean // 护盾是否激活
  lastHealTime: number // 上次自动回血时间
}

// 等级配置表
export type SharkLevelConfig = {
  level: number
  expRequired: number  // 升到该等级所需累计 exp（从0起算）
  sizeMultiplier: number
  hp: number
  speedMultiplier: number
  smellRange: number   // 嗅觉范围（像素）
  skill: SharkSkill
}

export const SHARK_LEVEL_TABLE: SharkLevelConfig[] = [
  { level: 1, expRequired: 0,  sizeMultiplier: 1.0,  hp: 10, speedMultiplier: 1.0,  smellRange: 350, skill: 'none' },
  { level: 2, expRequired: 4,  sizeMultiplier: 1.2,  hp: 14, speedMultiplier: 1.15, smellRange: 450, skill: 'dash' },
  { level: 3, expRequired: 10, sizeMultiplier: 1.45, hp: 20, speedMultiplier: 1.3,  smellRange: 560, skill: 'shield' },
  { level: 4, expRequired: 20, sizeMultiplier: 1.75, hp: 28, speedMultiplier: 1.45, smellRange: 680, skill: 'devour' },
  { level: 5, expRequired: 35, sizeMultiplier: 2.1,  hp: 38, speedMultiplier: 1.6,  smellRange: 900, skill: 'ranged' },
]

export const SHARK_BASE_SIZE = 78
export const SHARK_EGG_HATCH_SECONDS = 30
export const SHARK_AWAKENING_SECONDS = 2
export const SHARK_DYING_SECONDS = 3
export const SHARK_HATCHING_SECONDS = 2

// exp 收益表
export const SHARK_EXP_TABLE: Record<'dead' | 'normal' | 'good' | 'rare' | 'superRare', number> = {
  dead: 1,
  normal: 1,
  good: 2,
  rare: 4,
  superRare: 6,
}

// 根据总 exp 获取等级配置
export function getSharkLevelByExp(exp: number): SharkLevelConfig {
  let cfg = SHARK_LEVEL_TABLE[0]!
  for (const c of SHARK_LEVEL_TABLE) {
    if (exp >= c.expRequired) cfg = c
    else break
  }
  return cfg
}

// 根据等级获取配置
export function getSharkStatsByLevel(level: number): SharkLevelConfig {
  return SHARK_LEVEL_TABLE.find(c => c.level === level) ?? SHARK_LEVEL_TABLE[0]!
}

// 创建新鲨鱼（dormant 状态）
export function makeLiveShark(id: string, canvasW: number, canvasH: number): LiveShark {
  const dormantX = Math.random() * (canvasW - 160) + 80
  const dormantY = canvasH * 0.84
  const cfg = SHARK_LEVEL_TABLE[0]!
  return {
    id,
    x: dormantX,
    y: dormantY,
    vx: 0,
    phase: Math.random() * Math.PI * 2,
    state: 'dormant',
    stateTimer: 0,
    level: 1,
    exp: 0,
    size: SHARK_BASE_SIZE * cfg.sizeMultiplier,
    hp: cfg.hp,
    maxHp: cfg.hp,
    bitePulse: 0,
    targetX: dormantX,
    targetY: dormantY,
    eyeOpen: 0,
    dormantX,
    dormantY,
    levelUpPulse: 0,
    eggSize: 32,
    rotation: 0,
    skillCooldown: 0,
    comboCount: 0,
    shieldActive: false,
    lastHealTime: 0,
  }
}

// 鲨鱼升级检测：返回是否升级
export function checkSharkLevelUp(shark: LiveShark): boolean {
  const newCfg = getSharkLevelByExp(shark.exp)
  if (newCfg.level > shark.level) {
    shark.level = newCfg.level
    shark.size = SHARK_BASE_SIZE * newCfg.sizeMultiplier
    shark.maxHp = newCfg.hp
    shark.hp = Math.min(shark.hp + 5, newCfg.hp) // 升级回5血
    shark.levelUpPulse = 1
    shark.shieldActive = newCfg.skill === 'shield'
    return true
  }
  return false
}

// 计算实际速度（含技能加成）
export function getSharkSpeed(shark: LiveShark): number {
  const cfg = getSharkStatsByLevel(shark.level)
  let speed = 150 * cfg.speedMultiplier
  if (cfg.skill === 'dash') speed *= 1.3
  return speed
}

// 计算实际受到伤害（含技能减免）
export function calcSharkDamage(shark: LiveShark, rawDamage: number): number {
  const cfg = getSharkStatsByLevel(shark.level)
  let dmg = rawDamage
  if (cfg.skill === 'shield') dmg *= 0.6
  return dmg
}

// 计算吞噬恢复（devour技能）
export function calcSharkHealOnEat(shark: LiveShark): number {
  const cfg = getSharkStatsByLevel(shark.level)
  return cfg.skill === 'devour' ? 2 : 0
}

// 计算连击概率（devour技能）
export function calcSharkComboChance(shark: LiveShark): number {
  const cfg = getSharkStatsByLevel(shark.level)
  return cfg.skill === 'devour' ? 0.25 : 0
}
