/** 만 단위 숫자 → 천/백/십/일 한글 표기 (예: 1234 → "1천2백3십4만") */
function formatMan(man) {
    const chun = Math.floor(man / 1000);
    const baek = Math.floor((man % 1000) / 100);
    const sip = Math.floor((man % 100) / 10);
    const il = man % 10;

    let result = '';
    if (chun > 0) result += `${chun}천`;
    if (baek > 0) result += `${baek}백`;
    if (sip > 0) result += `${sip}십`;
    if (il > 0) result += `${il}`;

    return result + '만';
}

/**
 * 금액을 억/만 단위 한글 표기로 변환
 * - 천만원 미만: 숫자 그대로 (예: 9,500,000 → "9,500,000원")
 * - 천만원 이상: 억 + 만 (예: 210,000,000 → "2억 1천만원")
 * @param {number} amount - 원 단위 금액
 * @returns {string} 한글 표기 + "원"
 */
export function formatKoreanUnit(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0원';
    const n = Math.floor(Number(amount));
    if (n === 0) return '0원';

    if (n < 10_000_000) {
        return new Intl.NumberFormat('ko-KR').format(n) + '원';
    }

    const eok = Math.floor(n / 100_000_000);
    const man = Math.floor((n % 100_000_000) / 10_000);

    let result = '';
    if (eok > 0) result += `${eok}억`;
    if (man > 0) result += ` ${formatMan(man)}`;

    return result.trim() + '원';
}

/** @deprecated formatKoreanUnit 사용 권장 */
export function formatAmountKorean(value) {
    return formatKoreanUnit(value);
}

/**
 * 테이블용 목표/실적 포맷 (소수 불필요 시 제거, 금액은 한글 단위)
 * @param {number|string} value - 값
 * @param {string} metric - 'count' | 'amount' | 'percent'
 * @returns {string}
 */
export function formatTableValue(value, metric) {
    if (value === null || value === undefined) return '0';
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) return '0';
    const isAmount = metric === 'amount' || metric === '금액' || metric === 'monthly_avg_amount' || metric === '월 평균 금액';
    const isPercent = metric === 'percent' || metric === '%';
    const isMonthlyAvgCount = metric === 'monthly_avg_count';
    const isMonthlyAvgHeadcount = metric === 'monthly_avg_head';
    const isCount = metric === 'count' || metric === '건수';
    const isHeadcount = metric === 'headcount' || metric === '명(인원)' || metric === '명';
    const isMinutes = metric === 'minutes'
        || metric === '분(시간)'
        || metric === '분(min)'
        || metric === '분'
        || metric === 'monthly_avg_minutes';

    if (isAmount) {
        return formatKoreanUnit(numValue);
    }
    if (isCount || isHeadcount || isMinutes || isMonthlyAvgCount || isMonthlyAvgHeadcount) {
        if (isMonthlyAvgCount) {
            const rounded = Math.round(numValue * 100) / 100;
            return (rounded % 1 === 0
                ? rounded.toLocaleString('ko-KR')
                : rounded.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })) + '건';
        }
        if (isMonthlyAvgHeadcount) {
            const rounded = Math.round(numValue * 100) / 100;
            return (rounded % 1 === 0
                ? rounded.toLocaleString('ko-KR')
                : rounded.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })) + '명';
        }
        if (isMinutes) {
            const totalMinutes = Math.round(numValue);
            if (totalMinutes < 60) {
                return totalMinutes.toLocaleString('ko-KR') + '분';
            }

            const hours = Math.floor(totalMinutes / 60);
            const remainingMinutes = totalMinutes - (hours * 60);

            if (remainingMinutes === 0) {
                return hours.toLocaleString('ko-KR') + '시간';
            }

            return `${hours.toLocaleString('ko-KR')}시간 ${remainingMinutes.toLocaleString('ko-KR')}분`;
        }

        const suffix = isHeadcount ? '명' : '건';
        return Math.round(numValue).toLocaleString('ko-KR') + suffix;
    }

    if (isPercent) {
        const rounded = Math.round(numValue * 10) / 10;
        return (rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1)) + '%';
    }
    return numValue.toLocaleString('ko-KR');
}
