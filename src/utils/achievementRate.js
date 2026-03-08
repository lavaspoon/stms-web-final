/**
 * 실적 대비 목표 달성률을 한 곳에서 계산하는 유틸리티.
 * - 일반: 달성률 = 실적값 / 목표값 * 100
 * - 역계산: 달성률 = 목표값 / 실적값 * 100 (실적이 낮을수록 달성률이 높아짐)
 *
 * @param {number} targetVal - 목표값 (0이면 0 반환)
 * @param {number} actualVal - 실적값
 * @param {boolean} isReverse - 역계산 여부
 * @param {boolean} rounded - true면 정수로 반올림, false면 소수 그대로 (기본 true)
 * @returns {number} 달성률(%)
 */
export function calcAchievementRate(targetVal, actualVal, isReverse = false, rounded = true) {
  const target = targetVal != null ? Number(targetVal) : 0;
  const actual = actualVal != null ? Number(actualVal) : 0;

  if (!target || target === 0) return 0;
  if (isReverse) {
    if (!actual || actual === 0) return 0;
    const rate = (target / actual) * 100;
    return rounded ? Math.round(rate) : rate;
  }
  const rate = (actual / target) * 100;
  return rounded ? Math.round(rate) : rate;
}
