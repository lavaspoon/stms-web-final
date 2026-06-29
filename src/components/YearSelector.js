import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AVAILABLE_YEARS } from '../constants/taskYearConstants';
import './YearSelector.css';

function YearSelector({ selectedYear, onChange }) {
    const currentIndex = AVAILABLE_YEARS.indexOf(selectedYear);
    const canGoPrev = currentIndex < AVAILABLE_YEARS.length - 1;
    const canGoNext = currentIndex > 0;

    const handlePrev = () => {
        if (canGoPrev) {
            onChange(AVAILABLE_YEARS[currentIndex + 1]);
        }
    };

    const handleNext = () => {
        if (canGoNext) {
            onChange(AVAILABLE_YEARS[currentIndex - 1]);
        }
    };

    return (
        <div className="year-selector">
            <button
                type="button"
                className="year-nav-btn"
                onClick={handlePrev}
                disabled={!canGoPrev}
                title="이전 연도"
                aria-label="이전 연도"
            >
                <ChevronLeft size={18} />
            </button>
            <select
                className="year-select"
                value={selectedYear}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label="조회 연도"
            >
                {AVAILABLE_YEARS.map((year) => (
                    <option key={year} value={year}>
                        {year}년
                    </option>
                ))}
            </select>
            <button
                type="button"
                className="year-nav-btn"
                onClick={handleNext}
                disabled={!canGoNext}
                title="다음 연도"
                aria-label="다음 연도"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );
}

export default YearSelector;
