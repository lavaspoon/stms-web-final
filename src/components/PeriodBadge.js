import React from 'react';
import { getPeriodDisplay } from '../constants/taskYearConstants';
import './PeriodBadge.css';

function PeriodBadge({ periodDivision }) {
    const display = getPeriodDisplay(periodDivision);

    if (display === '-') {
        return <span className="period-badge period-badge-empty">-</span>;
    }

    const variant = periodDivision === '상반기' ? 'first' : 'second';
    return <span className={`period-badge period-badge-${variant}`}>{display}</span>;
}

export default PeriodBadge;
