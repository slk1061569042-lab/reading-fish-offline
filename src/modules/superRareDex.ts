// 超级稀有鱼图鉴数据 - 12条，技能多样化
export type SuperRareSkillType =
  | 'beam'      // 光束射击：对鲨鱼造成伤害
  | 'shield'    // 护盾：为鱼格挡一次伤害
  | 'freeze'    // 冰冻：冻结鲨鱼
  | 'summon'    // 召唤：召唤小弟
  | 'heal'      // 治疗：恢复其他鱼血量
  | 'explosion' // 爆炸：范围伤害
  | 'mirror'    // 反射：反弹伤害
  | 'void'      // 虚空：减速鲨鱼
  | 'regen'     // 再生：持续回血光环
  | 'haste'     // 急速：群体提速
  | 'taunt'     // 嘲讽：吸引鲨鱼仇恨
  | 'revive'    // 复活：死亡时复活一次

export type UnlockDifficulty = 'rare' | 'epic' | 'legendary' | 'hidden'

export type SuperRareFishEntry = {
  id: string
  name: string
  order: number
  hue: number
  glowColor: string
  skill: SuperRareSkillType
  skillName: string
  skillDesc: string
  description: string
  unlockHint: string
  unlockCondition: string
  difficulty: UnlockDifficulty
  hidden: boolean
}

// 技能冷却时间（秒）
export const SUPER_RARE_SKILL_COOLDOWN: Record<SuperRareSkillType, number> = {
  beam: 2,
  shield: 8,
  freeze: 12,
  summon: 15,
  heal: 3,
  explosion: 10,
  mirror: 6,
  void: 20,
  regen: 2,   // 每2秒触发一次光环回血
  haste: 10,  // 持续5秒的群体加速
  taunt: 5,
  revive: 30, // 被动，触发后进入CD
}

export const SUPER_RARE_DEX: SuperRareFishEntry[] = [
  // ===== RARE 级（基础强力技能）=====
  {
    id: 'nebula-veil',
    name: '星云纱鳍',
    order: 1, hue: 255,
    glowColor: 'rgba(167,139,250,0.7)',
    skill: 'beam', skillName: '星屑光刃',
    skillDesc: '向最近的鲨鱼发射三道追踪光束，每道造成3点伤害。',
    description: '深紫星云孕育的鱼类，鳍膜半透明，游动时如星屑散落。',
    unlockHint: '在一次朗读中积累足够多的稀有鱼。',
    unlockCondition: 'single_session_rare_ge_5',
    difficulty: 'rare', hidden: false,
  },
  {
    id: 'aurora-monarch',
    name: '极光帝鳞',
    order: 2, hue: 186,
    glowColor: 'rgba(103,232,249,0.7)',
    skill: 'freeze', skillName: '极光禁锢',
    skillDesc: '释放极光波动，冻结所有鲨鱼4秒，期间无法移动或攻击。',
    description: '北极深海的统治者，全身覆盖极光色鳞片，每次挥鳍都会折射出七色光晕。',
    unlockHint: '连续多天保持朗读习惯。',
    unlockCondition: 'consecutive_days_ge_3',
    difficulty: 'rare', hidden: false,
  },
  {
    id: 'crimson-empress',
    name: '赤炎皇后',
    order: 3, hue: 0,
    glowColor: 'rgba(248,113,113,0.7)',
    skill: 'explosion', skillName: '业火爆裂',
    skillDesc: '在血量最低的鲨鱼周围引爆，造成10点范围伤害。',
    description: '炽热岩浆海域的霸主，鳞片呈深红熔岩纹路，愤怒时体温能融化周围水体。',
    unlockHint: '在极度专注的状态下完成一次零失误朗读。',
    unlockCondition: 'single_session_no_dead_fish',
    difficulty: 'rare', hidden: false,
  },

  // ===== EPIC 级（战术技能）=====
  {
    id: 'void-leviathan',
    name: '虚空海皇',
    order: 4, hue: 270,
    glowColor: 'rgba(139,92,246,0.8)',
    skill: 'void', skillName: '虚空领域',
    skillDesc: '开启虚空领域6秒，所有鲨鱼速度降低70%，攻击力减半。',
    description: '存在于维度裂缝中的古老生命，目击者描述它像是一个会移动的深渊。',
    unlockHint: '让超级稀有鱼和稀有鱼同时在鱼缸共存。',
    unlockCondition: 'coexist_rare_and_superRare',
    difficulty: 'epic', hidden: false,
  },
  {
    id: 'celestial-guardian',
    name: '天穹守护者',
    order: 5, hue: 46,
    glowColor: 'rgba(253,224,71,0.8)',
    skill: 'shield', skillName: '圣盾庇护',
    skillDesc: '为所有普通鱼添加护盾，可完全格挡一次鲨鱼攻击。',
    description: '传说中守护鱼族的神明化身，金色光芒永远环绕全身。',
    unlockHint: '在历史记录中积累大量的优质鱼。',
    unlockCondition: 'total_good_fish_ge_50',
    difficulty: 'epic', hidden: false,
  },
  {
    id: 'mirror-specter',
    name: '镜影幽灵',
    order: 6, hue: 200,
    glowColor: 'rgba(148,163,184,0.7)',
    skill: 'mirror', skillName: '镜面反射',
    skillDesc: '将受到的伤害完全反弹给攻击者，持续3秒。',
    description: '由无数破碎镜面构成的幽灵鱼，没有实体，只有倒影。',
    unlockHint: '让鲨鱼死亡后孵化新生。',
    unlockCondition: 'shark_hatched_ge_1',
    difficulty: 'epic', hidden: false,
  },

  // ===== LEGENDARY 级（团队辅助）=====
  {
    id: 'soul-weaver',
    name: '织魂者',
    order: 7, hue: 300,
    glowColor: 'rgba(232,121,249,0.85)',
    skill: 'regen', skillName: '生命织网',
    skillDesc: '持续治疗光环：每2秒为所有受伤的鱼恢复2点生命。',
    description: '以生命力为丝线的神秘编织者，它的出现意味着这片海域不愿放弃任何生命。',
    unlockHint: '在一次朗读中保护大量鱼不被鲨鱼吃掉。',
    unlockCondition: 'save_fish_from_shark_ge_10',
    difficulty: 'legendary', hidden: false,
  },
  {
    id: 'storm-caller',
    name: '风暴呼唤者',
    order: 8, hue: 45,
    glowColor: 'rgba(250,204,21,0.85)',
    skill: 'haste', skillName: '风暴涌动',
    skillDesc: '激活所有鱼的潜能，5秒内游动速度翻倍，极难被捕捉。',
    description: '闪电是它的信使，雷鸣是它的号角，当它摆尾时，整片海域都会加速。',
    unlockHint: '连续多次在鲨鱼威胁下存活。',
    unlockCondition: 'survive_shark_encounter_ge_3',
    difficulty: 'legendary', hidden: false,
  },
  {
    id: 'abyssal-knight',
    name: '深渊骑士',
    order: 9, hue: 220,
    glowColor: 'rgba(59,130,246,0.85)',
    skill: 'taunt', skillName: '深渊嘲讽',
    skillDesc: '强制吸引所有鲨鱼仇恨，自身受到伤害减半，持续8秒。',
    description: '身披深渊铠甲的孤独守护者，它存在的意义就是成为敌人的目标。',
    unlockHint: '主动吸引鲨鱼注意力保护其他鱼。',
    unlockCondition: 'tank_shark_damage_ge_20',
    difficulty: 'legendary', hidden: false,
  },

  // ===== HIDDEN 隐藏（终极技能）=====
  {
    id: 'abyssal-sovereign',
    name: '深渊主权',
    order: 10, hue: 240,
    glowColor: 'rgba(99,102,241,0.9)',
    skill: 'summon', skillName: '深渊召唤',
    skillDesc: '召唤3条虚空幻影鱼协助战斗，每条继承本体50%攻击力。',
    description: '深渊的最终形态，那些见过它的人都无法准确描述——只记得无尽的黑暗和一双金色的眼睛。',
    unlockHint: '历史稀有鱼极多，且连续朗读从未中断超过一周。',
    unlockCondition: 'total_rare_ge_30_and_consecutive_7',
    difficulty: 'legendary', hidden: false,
  },
  {
    id: 'time-fragment',
    name: '时光碎片',
    order: 11, hue: 320,
    glowColor: 'rgba(244,114,182,0.8)',
    skill: 'revive', skillName: '时光回溯',
    skillDesc: '死亡时立即复活，恢复全部生命，每场战斗限一次。',
    description: '时间的旁观者，它的鳞片记录着这片海域所有生命的命运。',
    unlockHint: '在极其完美的单次朗读中出现，极其罕见。',
    unlockCondition: 'perfect_session_score',
    difficulty: 'legendary', hidden: false,
  },
  {
    id: 'origin-echo',
    name: '创世回响',
    order: 12, hue: 160,
    glowColor: 'rgba(52,211,153,0.9)',
    skill: 'void', skillName: '创世之力',
    skillDesc: '将场内所有鲨鱼转化为稀有鱼，每场战斗限一次。',
    description: '它是最初的鱼，也是最后的鱼。只有极少数人有幸目睹它的存在。',
    unlockHint: '???',
    unlockCondition: 'total_sessions_ge_100_and_perfect_3',
    difficulty: 'hidden', hidden: true,
  },
]

// ===== 解锁统计类型 =====
export type UnlockStats = {
  totalRareFish: number
  totalGoodFish: number
  totalSessions: number
  consecutiveDays: number
  sharkHatchedCount: number
  singleSessionRareCount: number
  singleSessionHasNoDeadFish: boolean
  coexistRareAndSuperRare: boolean
  perfectSessionCount: number
  // 新增
  fishSavedFromShark: number
  sharkEncounterSurvived: number
  sharkDamageTanked: number
}

export function checkSuperRareUnlock(entry: SuperRareFishEntry, stats: UnlockStats, unlockedIds: string[]): boolean {
  if (unlockedIds.includes(entry.id)) return true
  switch (entry.unlockCondition) {
    case 'single_session_rare_ge_5': return stats.singleSessionRareCount >= 5
    case 'consecutive_days_ge_3': return stats.consecutiveDays >= 3
    case 'single_session_no_dead_fish': return stats.singleSessionHasNoDeadFish && stats.singleSessionRareCount >= 1
    case 'coexist_rare_and_superRare': return stats.coexistRareAndSuperRare
    case 'total_good_fish_ge_50': return stats.totalGoodFish >= 50
    case 'shark_hatched_ge_1': return stats.sharkHatchedCount >= 1
    case 'total_rare_ge_30_and_consecutive_7': return stats.totalRareFish >= 30 && stats.consecutiveDays >= 7
    case 'perfect_session_score': return stats.perfectSessionCount >= 1
    case 'total_sessions_ge_100_and_perfect_3': return stats.totalSessions >= 100 && stats.perfectSessionCount >= 3
    // 新增
    case 'save_fish_from_shark_ge_10': return stats.fishSavedFromShark >= 10
    case 'survive_shark_encounter_ge_3': return stats.sharkEncounterSurvived >= 3
    case 'tank_shark_damage_ge_20': return stats.sharkDamageTanked >= 20
    default: return false
  }
}

// ===== localStorage 持久化 =====
const STORAGE_KEY = 'superRareUnlocked'
export function getUnlockedSuperRareIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
  } catch { return [] }
}
export function unlockSuperRareId(id: string): void {
  const ids = getUnlockedSuperRareIds()
  if (!ids.includes(id)) {
    ids.push(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }
}

// 根据已解锁ID随机选择一条超稀有鱼（用于生成时）
export function pickRandomSuperRare(unlockedIds: string[]): SuperRareFishEntry | null {
  const available = SUPER_RARE_DEX.filter(e => unlockedIds.includes(e.id) && !e.hidden)
  if (available.length === 0) return SUPER_RARE_DEX[0] // 保底给第一条
  return available[Math.floor(Math.random() * available.length)]
}
