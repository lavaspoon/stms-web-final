import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, TrendingUp, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sparkles, CheckCircle, Wand2 } from 'lucide-react';
import { inputTaskActivity, getTaskActivity, getAllPreviousActivities, getYearlyGoals, saveYearlyGoals } from '../api/taskApi';
import { checkSpelling, recommendActivity, improveContext } from '../api/aiApi';
import useUserStore from '../store/userStore';
import './TaskInputModal.css';

function TaskInputModal({ isOpen, onClose, task }) {
    const { user } = useUserStore();
    const [formData, setFormData] = useState({
        activityContent: '',
        status: 'inProgress'
    });
    const [yearlyGoals, setYearlyGoals] = useState([]);
    const [previousActivities, setPreviousActivities] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showAllActivities, setShowAllActivities] = useState(false);
    // 초기값: 현재 월이 1월이면 12월, 아니면 현재 월 - 1
    const getInitialMonth = () => {
        const current = new Date().getMonth() + 1;
        return current === 1 ? 12 : current - 1;
    };
    const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
    const [selectedMonthActivity, setSelectedMonthActivity] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [aiSuggestionType, setAiSuggestionType] = useState(null);
    const [showYearlyGoals, setShowYearlyGoals] = useState(true);
    const [showPreviousActivitiesModal, setShowPreviousActivitiesModal] = useState(false);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 기존 데이터 로드
    useEffect(() => {
        if (isOpen && task) {
            // selectedMonth가 currentMonth와 같으면 이전 월로 설정
            const current = new Date().getMonth() + 1;
            if (selectedMonth === current) {
                setSelectedMonth(current === 1 ? 12 : current - 1);
            }
            loadExistingData();
            loadYearlyGoals();
            loadPreviousActivities();
        } else {
            // 모달 닫을 때 초기화
            setFormData({
                activityContent: '',
                status: task?.status || 'inProgress'
            });
            setYearlyGoals([]);
            setPreviousActivities([]);
        }
    }, [isOpen, task]);

    const loadExistingData = async () => {
        try {
            setLoading(true);
            const data = await getTaskActivity(task.id);
            if (data) {
                setFormData({
                    activityContent: data.activityContent || '',
                    status: task.status || 'inProgress'
                });
            } else {
                setFormData({
                    activityContent: '',
                    status: task.status || 'inProgress'
                });
            }
        } catch (error) {
            console.error('활동내역 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadYearlyGoals = async () => {
        try {
            const data = await getYearlyGoals(task.id, currentYear);
            setYearlyGoals(data.monthlyGoals || []);
        } catch (error) {
            console.error('1년치 목표/실적 조회 실패:', error);
            // 데이터가 없으면 빈 배열로 초기화
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
            const data = await getAllPreviousActivities(task.id, 12);
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
        if (previousActivities.length > 0 && selectedMonth !== currentMonth) {
            const selectedActivity = previousActivities.find(
                a => a.activityYear === currentYear && a.activityMonth === selectedMonth
            );
            setSelectedMonthActivity(selectedActivity?.activityContent || '');
        }
    }, [selectedMonth, previousActivities, currentMonth, currentYear]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleGoalChange = (month, field, value) => {
        // task의 metric 확인 (영어 값으로 정규화)
        const rawMetric = task?.performanceOriginal?.metric || task?.performance?.metric || 'percent';
        const normalizedMetric = normalizeMetric(rawMetric);
        const maxValue = normalizedMetric === 'percent' ? 100 : undefined;
        const numValue = maxValue
            ? Math.min(maxValue, Math.max(0, parseInt(value) || 0))
            : Math.max(0, parseInt(value) || 0);

        setYearlyGoals(prev => {
            const newGoals = [...prev];
            const goalIndex = newGoals.findIndex(g => g.month === month);
            if (goalIndex >= 0) {
                const updatedGoal = {
                    ...newGoals[goalIndex],
                    [field]: numValue
                };

                // 달성률 계산 (모든 경우 %로 계산)
                if (field === 'targetValue') {
                    updatedGoal.achievementRate = updatedGoal.actualValue > 0 && numValue > 0
                        ? Math.round((updatedGoal.actualValue / numValue) * 100)
                        : 0;
                } else {
                    updatedGoal.achievementRate = updatedGoal.targetValue > 0 && numValue > 0
                        ? Math.round((numValue / updatedGoal.targetValue) * 100)
                        : 0;
                }

                newGoals[goalIndex] = updatedGoal;
            }
            return newGoals;
        });
    };

    const handleStatusChange = (status) => {
        setFormData(prev => ({ ...prev, status }));
    };


    // AI 기능 핸들러
    const handleSpellingCheck = async () => {
        if (!formData.activityContent.trim()) {
            alert('활동내역을 먼저 입력해주세요.');
            return;
        }

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
            const correctedText = await checkSpelling(formData.activityContent);
            setAiSuggestion(correctedText);
            setAiSuggestionType('spelling');
        } catch (error) {
            console.error('맞춤법 검사 실패:', error);
            alert('맞춤법 검사 중 오류가 발생했습니다.');
        } finally {
            setAiProcessing(false);
        }
    };

    const handleRecommendActivity = async () => {
        const recentActivities = previousActivities.slice(0, 3)
            .map(a => `${a.activityYear}년 ${a.activityMonth}월: ${a.activityContent}`)
            .join('\n');

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
            const recommendedText = await recommendActivity(task.name, recentActivities);
            setAiSuggestion(recommendedText);
            setAiSuggestionType('recommend');
        } catch (error) {
            console.error('활동내역 추천 실패:', error);
            alert('활동내역 추천 중 오류가 발생했습니다.');
        } finally {
            setAiProcessing(false);
        }
    };

    const handleImproveContext = async () => {
        if (!formData.activityContent.trim()) {
            alert('활동내역을 먼저 입력해주세요.');
            return;
        }

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
            const improvedText = await improveContext(formData.activityContent);
            setAiSuggestion(improvedText);
            setAiSuggestionType('improve');
        } catch (error) {
            console.error('문맥 교정 실패:', error);
            alert('문맥 교정 중 오류가 발생했습니다.');
        } finally {
            setAiProcessing(false);
        }
    };

    // AI 제안 수락
    const handleAcceptSuggestion = () => {
        if (aiSuggestion) {
            setFormData(prev => ({ ...prev, activityContent: aiSuggestion }));
            setAiSuggestion(null);
            setAiSuggestionType(null);
        }
    };

    // AI 제안 거부
    const handleRejectSuggestion = () => {
        setAiSuggestion(null);
        setAiSuggestionType(null);
    };

    // AI 재생성
    const handleRegenerateSuggestion = () => {
        if (aiSuggestionType === 'spelling') {
            handleSpellingCheck();
        } else if (aiSuggestionType === 'recommend') {
            handleRecommendActivity();
        } else if (aiSuggestionType === 'improve') {
            handleImproveContext();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.activityContent.trim()) {
            alert('활동내역을 입력해주세요.');
            return;
        }

        // 현재 월의 목표/실적 확인 (필수 아님)
        const currentMonthGoal = yearlyGoals.find(g => g.month === currentMonth);

        try {
            setSubmitting(true);

            // 1. 1년치 목표/실적 저장
            await saveYearlyGoals(task.id, {
                year: currentYear,
                monthlyGoals: yearlyGoals
            });

            // 2. 현재 월 활동내역 저장
            await inputTaskActivity(task.id, user.userId, {
                activityContent: formData.activityContent,
                targetValue: currentMonthGoal?.targetValue || 0,
                actualValue: currentMonthGoal?.actualValue || 0,
                status: formData.status
            });

            alert('활동내역과 목표/실적이 성공적으로 저장되었습니다.');
            onClose();
        } catch (error) {
            console.error('저장 실패:', error);
            const errorMessage = error.response?.data?.message || error.message || '저장 중 오류가 발생했습니다.';
            alert(`저장 실패: ${errorMessage}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !task) return null;

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    // 영어 metric 값으로 변환 (한글이든 영어든 영어로 정규화)
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

    // 성과지표에 따른 단위 설정 (정규화된 영어 값 받음)
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

    // task의 metric 확인 (performanceOriginal.metric을 우선 사용)
    const rawMetric = task.performanceOriginal?.metric || task.performance?.metric || 'percent';
    const taskMetric = normalizeMetric(rawMetric);
    const metricUnit = getMetricUnit(taskMetric);
    const metricLabel = getMetricLabel(taskMetric);

    // 디버깅 로그
    console.log('TaskInputModal - task:', task);
    console.log('TaskInputModal - rawMetric:', rawMetric);
    console.log('TaskInputModal - taskMetric (normalized):', taskMetric);
    console.log('TaskInputModal - metricUnit:', metricUnit);
    console.log('TaskInputModal - metricLabel:', metricLabel);

    // 총합 계산
    const totalTarget = yearlyGoals.reduce((sum, goal) => sum + goal.targetValue, 0);
    const totalActual = yearlyGoals.reduce((sum, goal) => sum + goal.actualValue, 0);

    // 달성률 계산 (모든 경우 %로 계산)
    const totalAchievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    return (
        <div className="task-input-modal-overlay">
            <div className="task-input-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{task.name}</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="input-form">
                    {/* 이달 활동내역 입력 */}
                    <section className="form-section activity-main-section">
                        <div className="activity-main-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} />
                                <h3>이번 달 활동내역 입력 (필수)</h3>
                            </div>
                            <button
                                type="button"
                                className="reference-btn"
                                onClick={() => setShowPreviousActivitiesModal(true)}
                                title="다른 월 활동내역 참조"
                            >
                                <Calendar size={14} />
                                <span>이전 활동내역 참조</span>
                            </button>
                        </div>
                        <div className="activity-main-container">
                            <div className="form-group activity-main-group">
                                <textarea
                                    name="activityContent"
                                    value={formData.activityContent}
                                    onChange={handleChange}
                                    placeholder="이번 달 진행한 활동내역을 입력하세요"
                                    rows="10"
                                    required
                                    className="activity-main-textarea"
                                />
                            </div>

                            {/* AI 기능 버튼 */}
                            <div className="ai-actions">
                                <button
                                    type="button"
                                    className="ai-btn"
                                    onClick={handleSpellingCheck}
                                    disabled={aiProcessing || !formData.activityContent.trim()}
                                >
                                    <CheckCircle size={16} />
                                    <span>맞춤법 검사</span>
                                </button>
                                <button
                                    type="button"
                                    className="ai-btn"
                                    onClick={handleRecommendActivity}
                                    disabled={aiProcessing}
                                >
                                    <Sparkles size={16} />
                                    <span>활동내역 추천</span>
                                </button>
                                <button
                                    type="button"
                                    className="ai-btn"
                                    onClick={handleImproveContext}
                                    disabled={aiProcessing || !formData.activityContent.trim()}
                                >
                                    <Wand2 size={16} />
                                    <span>문맥 교정</span>
                                </button>
                            </div>

                            {aiProcessing && (
                                <div className="ai-processing">
                                    <Sparkles size={16} className="ai-icon-spin" />
                                    <span>AI가 처리 중입니다...</span>
                                </div>
                            )}

                            {/* AI 제안 표시 */}
                            {aiSuggestion && !aiProcessing && (
                                <div className="ai-suggestion-panel">
                                    <div className="ai-suggestion-header">
                                        <Sparkles size={16} />
                                        <span>
                                            {aiSuggestionType === 'spelling' && 'AI 맞춤법 검사 결과'}
                                            {aiSuggestionType === 'recommend' && 'AI 활동내역 추천'}
                                            {aiSuggestionType === 'improve' && 'AI 문맥 교정 결과'}
                                        </span>
                                    </div>
                                    <div className="ai-suggestion-content">
                                        <div className="suggestion-text suggested">
                                            {aiSuggestion}
                                        </div>
                                    </div>
                                    <div className="ai-suggestion-actions">
                                        <button
                                            type="button"
                                            className="suggestion-btn accept"
                                            onClick={handleAcceptSuggestion}
                                        >
                                            <CheckCircle size={16} />
                                            <span>수락</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="suggestion-btn regenerate"
                                            onClick={handleRegenerateSuggestion}
                                        >
                                            <Sparkles size={16} />
                                            <span>재생성</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="suggestion-btn reject"
                                            onClick={handleRejectSuggestion}
                                        >
                                            <X size={16} />
                                            <span>거부</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>


                    {/* 연간 목표/실적 - 정량 평가일 때만 표시 */}
                    {task.evaluationType !== 'qualitative' && (
                        <section className="collapsible-section">
                            <div
                                className="section-header clickable"
                                onClick={() => setShowYearlyGoals(!showYearlyGoals)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TrendingUp size={16} />
                                    <h3>월별 목표 및 실적</h3>
                                </div>
                                {showYearlyGoals ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>

                            {showYearlyGoals && (
                                <div className="collapsible-content">
                                    <div className="yearly-goals-summary">
                                        <div className="summary-item">
                                            <span className="summary-label">전체 목표</span>
                                            <span className="summary-value">{totalTarget.toLocaleString()}{metricUnit}</span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-label">전체 실적</span>
                                            <span className="summary-value">{totalActual.toLocaleString()}{metricUnit}</span>
                                        </div>
                                        <div className="summary-item highlight">
                                            <span className="summary-label">전체 달성률</span>
                                            <span className="summary-value-large">{totalAchievement}%</span>
                                        </div>
                                    </div>
                                    
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
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={goal.targetValue}
                                                                onChange={(e) => handleGoalChange(goal.month, 'targetValue', e.target.value)}
                                                                className="table-input"
                                                                placeholder="0"
                                                            />
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
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={goal.actualValue}
                                                                onChange={(e) => handleGoalChange(goal.month, 'actualValue', e.target.value)}
                                                                className="table-input"
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="total-cell">
                                                        <span className="total-value">{totalActual.toLocaleString()}{metricUnit}</span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* 버튼 */}
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>
                            취소
                        </button>
                        <button type="submit" className="btn-submit" disabled={submitting || loading}>
                            {submitting ? '저장 중...' : '저장하기'}
                        </button>
                    </div>
                </form>
            </div>

            {/* 이전 활동내역 참조 모달 */}
            {showPreviousActivitiesModal && (
                <div className="previous-activities-modal-overlay">
                    <div className="previous-activities-modal">
                        <div className="previous-activities-modal-header">
                            <h3>이전 활동내역 참조</h3>
                            <button className="close-btn" onClick={() => setShowPreviousActivitiesModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="previous-activities-modal-content">
                            <div className="form-group">
                                <label>월 선택</label>
                                <div className="month-navigation">
                                    <button
                                        type="button"
                                        className="month-nav-btn"
                                        onClick={() => {
                                            // 현재 월을 건너뛰면서 이전 월 찾기
                                            let prevMonth = selectedMonth > 1 ? selectedMonth - 1 : 12;
                                            while (prevMonth === currentMonth) {
                                                prevMonth = prevMonth > 1 ? prevMonth - 1 : 12;
                                            }
                                            setSelectedMonth(prevMonth);
                                        }}
                                        disabled={(() => {
                                            // 선택 가능한 이전 월이 있는지 확인
                                            let prevMonth = selectedMonth > 1 ? selectedMonth - 1 : 12;
                                            let attempts = 0;
                                            while (prevMonth === currentMonth && attempts < 12) {
                                                prevMonth = prevMonth > 1 ? prevMonth - 1 : 12;
                                                attempts++;
                                            }
                                            return prevMonth === currentMonth;
                                        })()}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <div className="month-display">
                                        <span className="month-label">{currentYear}년 {selectedMonth}월</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="month-nav-btn"
                                        onClick={() => {
                                            // 현재 월을 건너뛰면서 다음 월 찾기
                                            let nextMonth = selectedMonth < 12 ? selectedMonth + 1 : 1;
                                            while (nextMonth === currentMonth) {
                                                nextMonth = nextMonth < 12 ? nextMonth + 1 : 1;
                                            }
                                            setSelectedMonth(nextMonth);
                                        }}
                                        disabled={(() => {
                                            // 선택 가능한 다음 월이 있는지 확인
                                            let nextMonth = selectedMonth < 12 ? selectedMonth + 1 : 1;
                                            let attempts = 0;
                                            while (nextMonth === currentMonth && attempts < 12) {
                                                nextMonth = nextMonth < 12 ? nextMonth + 1 : 1;
                                                attempts++;
                                            }
                                            return nextMonth === currentMonth;
                                        })()}
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default TaskInputModal;
