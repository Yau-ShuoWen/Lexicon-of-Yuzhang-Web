export const MACHINE_SC = 'sc'
export const MACHINE_TC = 'tc'

export function unpackPair(pair = {}) {
  const machineSide = pair.machineSide ?? ''
  if (machineSide && machineSide !== MACHINE_SC && machineSide !== MACHINE_TC) throw new Error('未知机翻状态')
  return { sc: pair.sc ?? '', tc: pair.tc ?? '', machineSide }
}

export function packPair(pair, machineSide = '') {
  if (machineSide && machineSide !== MACHINE_SC && machineSide !== MACHINE_TC) throw new Error('未知机翻状态')
  if (Array.from(pair.sc).length !== Array.from(pair.tc).length) throw new Error('简繁字数不一致')
  return machineSide ? { sc: pair.sc, tc: pair.tc, machineSide } : { sc: pair.sc, tc: pair.tc }
}

// 在同一段输入中找出多处改动，未改动区间直接取已校对的另一侧。
export function retainTranslated(oldSource, newSource, oldTarget, translated) {
  const before = Array.from(oldSource)
  const after = Array.from(newSource)
  const target = Array.from(oldTarget)
  const machine = Array.from(translated)
  if (before.length !== target.length || after.length !== machine.length) throw new Error('机翻后简繁字数不一致')
  if (before.length * after.length > 4_000_000) throw new Error('本次改动过长，请分段同步')
  const dp = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1))
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const result = []
  let i = 0, j = 0
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) { result.push(target[i]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else { result.push(machine[j]); j++ }
  }
  while (j < after.length) result.push(machine[j++])
  return result.join('')
}
