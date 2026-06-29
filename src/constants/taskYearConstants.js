/** 조회용 연도 목록 (신규 연도는 이 배열에 추가, 최신 연도 우선) */
export const AVAILABLE_YEARS = [2027, 2026];

/** 과제 등록/수정 시 기준 연도 선택 항목 (전체 → 연도 오름차순) */
export const BASE_YEAR_OPTIONS = ['전체', ...[...AVAILABLE_YEARS].sort((a, b) => a - b).map(String)];

/** 분기 선택 항목 */
export const PERIOD_DIVISION_OPTIONS = ['전체', '상반기', '하반기'];

/** 테이블 '분기' 컬럼 필터 항목 */
export const PERIOD_FILTER_OPTIONS = ['전체', '상반기', '하반기'];

/** 테이블 '분기' 컬럼 표시값 (상반기/하반기, 그 외 '-') */
export const getPeriodDisplay = (periodDivision) => {
    if (periodDivision === '상반기' || periodDivision === '하반기') {
        return periodDivision;
    }
    return '-';
};

/** 분기 필터용 과제 값 (상반기/하반기 외는 '전체') */
export const getTaskPeriodFilterValue = (periodDivision) => {
    if (periodDivision === '상반기' || periodDivision === '하반기') {
        return periodDivision;
    }
    return '전체';
};

/** 분기 헤더 필터 매칭 */
export const matchesPeriodFilter = (periodDivision, selectedFilters) => {
    if (!selectedFilters || selectedFilters.length === 0) return true;
    return selectedFilters.includes(getTaskPeriodFilterValue(periodDivision));
};

/**
 * 분기 컬럼 정렬값 (comparePeriodSort 내부용)
 */
export const getPeriodSortValue = (periodDivision) => {
    if (periodDivision === '상반기') return 1;
    if (periodDivision === '하반기') return 2;
    return 3;
};

/**
 * 분기 컬럼 정렬 비교
 * asc: 상반기 → 하반기 → '-'(미지정)
 * desc: 하반기 → 상반기 → '-'(미지정)
 */
export const comparePeriodSort = (periodA, periodB, direction) => {
    const aOrder = getPeriodSortValue(periodA);
    const bOrder = getPeriodSortValue(periodB);

    // 미지정('-')은 asc/desc 모두 마지막
    if (aOrder === 3 && bOrder !== 3) return 1;
    if (bOrder === 3 && aOrder !== 3) return -1;
    if (aOrder === 3 && bOrder === 3) return 0;

    if (direction === 'asc') {
        return aOrder - bOrder;
    }
    return bOrder - aOrder;
};

/** 기본 조회 연도 (현재 연도가 목록에 있으면 사용, 없으면 최신 연도) */
export const getDefaultViewYear = () => {
    const currentYear = new Date().getFullYear();
    if (AVAILABLE_YEARS.includes(currentYear)) {
        return currentYear;
    }
    return AVAILABLE_YEARS[0];
};
