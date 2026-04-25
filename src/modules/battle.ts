import type { BattleReport } from './storage'

export type GeneratedFishCounts = {
  normal: number
  good: number
  rare: number
  superRare: number
  dead: number
  shark: number
}

export function createEmptyFishCounts(): GeneratedFishCounts {
  return {
    normal: 0,
    good: 0,
    rare: 0,
    superRare: 0,
    dead: 0,
    shark: 0,
  }
}

export function sumGeneratedFish(counts: GeneratedFishCounts): number {
  return counts.normal + counts.good + counts.rare + counts.dead
}

export function countTankPopulation(counts: GeneratedFishCounts): number {
  return counts.normal + counts.good + counts.rare + counts.superRare + counts.dead + counts.shark
}

export function buildBattle(generatedCounts: GeneratedFishCounts): BattleReport {
  const log: string[] = []
  const fishEaten = { normal: 0, good: 0, rare: 0, superRare: 0 }

  // 死鱼不再直接合成鲨鱼，鲨鱼由实时状态机管理
  const deadFishCombined = 0
  const deadLeft = generatedCounts.dead

  let normal = generatedCounts.normal
  let good = generatedCounts.good
  let rare = generatedCounts.rare
  let superRare = generatedCounts.superRare + Math.floor(rare / 10)
  const rareFishCombined = Math.floor(generatedCounts.rare / 10) * 10
  rare -= rareFishCombined
  const superRareSummoned = superRare - generatedCounts.superRare

  // shark 数量由状态机维护，结算层不再生成鲨鱼
  const shark = generatedCounts.shark
  const sharksSummoned = 0
  const sharksDefeated = 0
  const superRareDefeated = 0

  if (superRareSummoned > 0) log.push(`10 条稀有鱼合体，生成 ${superRareSummoned} 条超级稀有鱼，并从稀有鱼数量中真实扣除 ${rareFishCombined} 条`)

  return {
    deadFishCombined,
    rareFishCombined,
    sharksSummoned,
    superRareSummoned,
    sharksDefeated,
    superRareDefeated,
    fishEaten,
    finalCounts: {
      normal,
      good,
      rare,
      superRare,
      dead: deadLeft,
      shark,
    },
    log,
  }
}
