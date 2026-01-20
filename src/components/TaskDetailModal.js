import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, ChevronDown, ChevronUp, User, Building, Clock, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTask, getAllPreviousActivities, getYearlyGoals } from '../api/taskApi';
import { formatDate } from '../utils/dateUtils';
import { ModalContentSkeleton, TableSkeleton } from './Skeleton';
import './TaskDetailModal.css';

function TaskDetailModal({ isOpen, onClose, taskId }) {
    const [task, setTask] = useState(null);
    const [yearlyGoals, setYearlyGoals] = useState([]);
    const [previousActivities, setPreviousActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showYearlyGoals, setShowYearlyGoals] = useState(true);
    const [showPreviousActivities, setShowPreviousActivities] = useState(true); // 기본적으로 열어둠
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedMonthActivity, setSelectedMonthActivity] = useState('');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 데이터 로드
    useEffect(() => {
        if (isOpen && taskId) {
            loadTaskDetail();
            loadYearlyGoals();
            loadPreviousActivities();
        } else {
            // 모달 닫을 때 초기화
            setTask(null);
            setYearlyGoals([]);
            setPreviousActivities([]);
        }
    }, [isOpen, taskId]);

    const loadTaskDetail = async () => {
        try {
            setLoading(true);
            const [data] = await Promise.all([
                getTask(taskId),
                new Promise(resolve => setTimeout(resolve, 300)) // 최소 300ms 딜레이
            ]);
            setTask(data);
        } catch (error) {
            console.error('과제 상세 조회 실패:', error);
            alert('과제 상세 정보를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const loadYearlyGoals = async () => {
        try {
            const data = await getYearlyGoals(taskId, currentYear);
            setYearlyGoals(data.monthlyGoals || []);
        } catch (error) {
            console.error('1년치 목표/실적 조회 실패:', error);
            setYearlyGoals(Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                targetValue: 0,
                actualValue: 0,
                achievementRate: 0
            })));
        }
    };

    const loadPreviousActivities = async () => {
        try {
            const data = await getAllPreviousActivities(taskId, 12);
            setPreviousActivities(data);

            // 선택된 월의 활동내역 로드
            if (selectedMonth !== currentMonth) {
                const selectedActivity = data.find(
                    a => a.activityYear === currentYear && a.activityMonth === selectedMonth
                );
                setSelectedMonthActivity(selectedActivity?.activityContent || '');
            }
        } catch (error) {
            console.error('이전 활동내역 조회 실패:', error);
        }
    };

    // 선택된 월이 변경될 때 해당 월의 활동내역 로드
    useEffect(() => {
        if (previousActivities.length > 0) {
            const selectedActivity = previousActivities.find(
                a => a.activityYear === currentYear && a.activityMonth === selectedMonth
            );
            setSelectedMonthActivity(selectedActivity?.activityContent || '');
        } else if (selectedMonth === currentMonth) {
            // 현재 월이고 활동내역이 없으면 빈 문자열
            setSelectedMonthActivity('');
        }
    }, [selectedMonth, previousActivities, currentMonth, currentYear]);

    // 월 이동 함수
    const handleMonthChange = (direction) => {
        if (direction === 'prev') {
            setSelectedMonth(prev => prev > 1 ? prev - 1 : 12);
        } else {
            setSelectedMonth(prev => prev < 12 ? prev + 1 : 1);
        }
    };

    if (!isOpen || !taskId) return null;

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    // 영어 metric 값으로 변환
    const normalizeMetric = (metric) => {
        const metricMap = {
            '건수': 'count',
            '금액': 'amount',
            '%': 'percent',
            'count': 'count',
            'amount': 'amount',
            'percent': 'percent'
        };
        return metricMap[metric] || 'percent';
    };

    // 성과지표에 따른 단위 설정
    const getMetricUnit = (normalizedMetric) => {
        const unitMap = {
            'count': '건',
            'amount': '원',
            'percent': '%'
        };
        return unitMap[normalizedMetric] || '%';
    };

    const getMetricLabel = (normalizedMetric) => {
        const labelMap = {
            'count': '건수',
            'amount': '금액',
            'percent': '%'
        };
        return labelMap[normalizedMetric] || '%';
    };

    // 성과지표 변환
    const translatePerformanceType = (type) => {
        const map = {
            'financial': '재무',
            'nonFinancial': '비재무'
        };
        return map[type] || type;
    };

    const translateEvaluationType = (type) => {
        const map = {
            'quantitative': '정량',
            'qualitative': '정성'
        };
        return map[type] || type;
    };

    const translateMetric = (metric) => {
        const map = {
            'count': '건수',
            'amount': '금액',
            'percent': '%'
        };
        return map[metric] || metric;
    };

    // status 변환
    const normalizeStatus = (status) => {
        if (!status) return 'inProgress';
        const statusMap = {
            '진행중': 'inProgress',
            '완료': 'completed',
            '지연': 'delayed',
            '중단': 'stopped',
            'inProgress': 'inProgress',
            'completed': 'completed',
            'delayed': 'delayed',
            'stopped': 'stopped'
        };
        return statusMap[status] || 'inProgress';
    };

    const getStatusText = (status) => {
        const statusMap = {
            'inProgress': '진행중',
            'completed': '완료',
            'delayed': '지연',
            'stopped': '중단'
        };
        return statusMap[normalizeStatus(status)] || '진행중';
    };

    // task의 metric 확인
    const rawMetric = task?.metric || 'percent';
    const taskMetric = normalizeMetric(rawMetric);
    const metricUnit = getMetricUnit(taskMetric);
    const metricLabel = getMetricLabel(taskMetric);

    // 총합 계산
    const totalTarget = yearlyGoals.reduce((sum, goal) => sum + goal.targetValue, 0);
    const totalActual = yearlyGoals.reduce((sum, goal) => sum + goal.actualValue, 0);

    // 달성률 계산 (모든 경우 %로 계산)
    const totalAchievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    // 담당자 부서 추출
    const getManagerDepts = (managers) => {
        if (!managers || managers.length === 0) return ['-'];
        const depts = managers
            .map(m => m.deptName)
            .filter(dept => dept && dept.trim() !== '');
        if (depts.length === 0) return ['-'];
        const uniqueDepts = [...new Set(depts)];
        return uniqueDepts;
    };

    if (loading) {
        return (
            <div className="task-detail-modal-overlay" onClick={onClose}>
                <div className="task-detail-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="header-content">
                            <div className="task-header-info">
                                <div className="task-status-badges">
                                    <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '4px' }} />
                                    <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '4px' }} />
                                </div>
                                <div className="skeleton" style={{ width: '70%', height: '28px', borderRadius: '4px', marginTop: '12px' }} />
                            </div>
                        </div>
                        <button className="close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                    <ModalContentSkeleton />
                    <div className="form-actions">
                        <button type="button" className="btn-close" onClick={onClose}>
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!task) return null;

    return (
        <div className="task-detail-modal-overlay" onClick={onClose}>
            <div className="task-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-content">
                        <div className="task-header-info">
                            <div className="task-status-badges">
                                <span className={`status-badge ${normalizeStatus(task.status)}`}>
                                    {getStatusText(task.status)}
                                </span>
                                <span className="achievement-badge">{task.achievement || 0}%</span>
                            </div>
                            <h2 className="task-path-header">
                                {task.category1} &gt; {task.category2} &gt; <strong>{task.taskName}</strong>
                            </h2>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="detail-content">
                    {/* 과제 기본 정보 */}
                    <section className="detail-section">
                        <h3 className="section-title">과제 기본 정보</h3>
                        <div className="detail-grid-compact">
                            {/* 과제 개요 */}
                            {task.description && task.description.trim() !== '' && (
                                <div className="detail-item-full">
                                    <label>과제 개요</label>
                                    <div className="detail-value detail-description">
                                        {task.description}
                                    </div>
                                </div>
                            )}

                            {/* 기간 및 성과지표 */}
                            <div className="detail-item-row">
                                <div className="detail-item-inline">
                                    <label>기간</label>
                                    <div className="detail-value">
                                        <Clock size={16} className="detail-icon" />
                                        {formatDate(task.startDate)} ~ {formatDate(task.endDate)}
                                    </div>
                                </div>
                                <div className="detail-item-inline">
                                    <label>성과지표</label>
                                    <div className="detail-value">
                                        <TrendingUp size={16} className="detail-icon" />
                                        {translatePerformanceType(task.performanceType)} · {translateEvaluationType(task.evaluationType)} · {translateMetric(task.metric)}
                                    </div>
                                </div>
                            </div>

                            {/* 담당 정보 */}
                            <div className="detail-item-full">
                                <label>담당</label>
                                <div className="detail-value">
                                    <Building size={18} className="detail-icon" />
                                    <span className="detail-path">
                                        {task.deptName || '-'}
                                    </span>
                                    {task.managers && task.managers.length > 0 && (
                                        <>
                                            <span className="detail-separator">&gt;</span>
                                            <div className="managers-inline">
                                                {task.managers.map((manager, idx) => (
                                                    <span key={idx} className="manager-tag">
                                                        <User size={14} />
                                                        {manager.mbName}
                                                        {manager.mbPositionName && (
                                                            <span className="manager-position">({manager.mbPositionName})</span>
                                                        )}
                                                        {manager.deptName && manager.deptName !== task.deptName && (
                                                            <span className="manager-dept">[{manager.deptName}]</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 월별 활동내역 */}
                    <section className="collapsible-section">
                        <div
                            className="section-header clickable"
                            onClick={() => setShowPreviousActivities(!showPreviousActivities)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={16} />
                                <h3>월별 활동내역</h3>
                            </div>
                            {showPreviousActivities ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>

                        {showPreviousActivities && (
                            <div className="collapsible-content">
                                <div className="form-group">
                                    <label>월 선택</label>
                                    <div className="month-navigation">
                                        <button
                                            type="button"
                                            className="month-nav-btn"
                                            onClick={() => handleMonthChange('prev')}
                                            aria-label="이전 월"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <div className="month-display">
                                            <span className="month-label">{currentYear}년 {selectedMonth}월</span>
                                            {selectedMonth === currentMonth && (
                                                <span className="current-month-badge">현재</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="month-nav-btn"
                                            onClick={() => handleMonthChange('next')}
                                            aria-label="다음 월"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{currentYear}년 {selectedMonth}월 활동내역 (읽기 전용)</label>
                                    <textarea
                                        value={selectedMonthActivity}
                                        placeholder="해당 월의 활동내역이 없습니다"
                                        rows="12"
                                        className="reference-textarea"
                                        disabled
                                        readOnly
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 월별 목표/실적 - 정량 평가일 때만 표시 */}
                    {task.evaluationType !== 'qualitative' && (
                        <section className="collapsible-section">
                            <div
                                className="section-header clickable"
                                onClick={() => setShowYearlyGoals(!showYearlyGoals)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TrendingUp size={16} />
                                    <h3>{currentYear}년 월별 목표 및 실적 ({metricLabel})</h3>
                                </div>
                                {showYearlyGoals ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>

                            {showYearlyGoals && (
                                <div className="collapsible-content">
                                    <div className="yearly-goals-table-container">
                                        <table className="yearly-goals-table">
                                            <thead>
                                                <tr>
                                                    <th className="row-header">구분</th>
                                                    {monthNames.map((month, idx) => (
                                                        <th key={idx} className={idx + 1 === currentMonth ? 'current-month' : ''}>
                                                            {month}
                                                        </th>
                                                    ))}
                                                    <th className="total-header">합계</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="row-header">목표({metricUnit})</td>
                                                    {yearlyGoals.map((goal) => (
                                                        <td key={`target-${goal.month}`} className={goal.month === currentMonth ? 'current-month' : ''}>
                                                            {goal.targetValue.toLocaleString()}{metricUnit}
                                                        </td>
                                                    ))}
                                                    <td className="total-cell">
                                                        <span className="total-value">{totalTarget.toLocaleString()}{metricUnit}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="row-header">실적({metricUnit})</td>
                                                    {yearlyGoals.map((goal) => (
                                                        <td key={`actual-${goal.month}`} className={goal.month === currentMonth ? 'current-month' : ''}>
                                                            {goal.actualValue.toLocaleString()}{metricUnit}
                                                        </td>
                                                    ))}
                                                    <td className="total-cell">
                                                        <span className="total-value">{totalActual.toLocaleString()}{metricUnit}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="row-header">달성률(%)</td>
                                                    {yearlyGoals.map((goal) => (
                                                        <td key={`achievement-${goal.month}`} className={goal.month === currentMonth ? 'current-month' : ''}>
                                                            {goal.achievementRate}%
                                                        </td>
                                                    ))}
                                                    <td className="total-cell">
                                                        <span className="total-value">
                                                            {totalAchievement}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* 닫기 버튼 */}
                <div className="form-actions">
                    <button type="button" className="btn-close" onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TaskDetailModal;
