import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, TrendingUp, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sparkles, CheckCircle, Wand2, Clock, AlertCircle, XCircle } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { inputTaskActivity, getTaskActivity, getAllPreviousActivities } from '../api/taskApi';
import { checkSpelling, recommendActivity, improveContext } from '../api/aiApi';
import useUserStore from '../store/userStore';
import './TaskInputModal.css';

function TaskInputModal({ isOpen, onClose, task }) {
    const { user } = useUserStore();
    const isAdmin = user?.role === '관리자' || user?.role === '매니저';

    // 담당자 여부 확인
    const isTaskManager = () => {
        if (!task?.managers || task.managers.length === 0) return false;
        if (!user) return false;

        const currentUserId = user.userId || user.skid;
        if (!currentUserId) return false;

        return task.managers.some(manager => {
            const managerUserId = manager.userId || manager.mbId;
            return managerUserId === currentUserId;
        });
    };

    // 읽기 전용 모드: 관리자이지만 담당자가 아닌 경우
    const isReadOnly = isAdmin && !isTaskManager();

    const [formData, setFormData] = useState({
        activityContent: '',
        status: 'inProgress',
        actualValue: '' // 정량일 때 실적값
    });
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
    const [showPreviousActivitiesModal, setShowPreviousActivitiesModal] = useState(false);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 뷰어 모드용 현재 보고 있는 월 상태
    const [viewingMonth, setViewingMonth] = useState(currentMonth);

    // 기존 데이터 로드
    useEffect(() => {
        if (isOpen && task) {
            // 뷰어 모드일 때는 현재 월로 초기화
            if (isReadOnly) {
                setViewingMonth(currentMonth);
            } else {
                // selectedMonth가 currentMonth와 같으면 이전 월로 설정
                const current = new Date().getMonth() + 1;
                if (selectedMonth === current) {
                    setSelectedMonth(current === 1 ? 12 : current - 1);
                }
            }
            loadExistingData();
            loadPreviousActivities();
        } else {
            // 모달 닫을 때 초기화
            setFormData({
                activityContent: '',
                status: task?.status || 'inProgress',
                actualValue: ''
            });
            setPreviousActivities([]);
            setViewingMonth(currentMonth);
        }
    }, [isOpen, task]);

    const loadExistingData = async () => {
        try {
            setLoading(true);
            // 뷰어 모드: 현재 보고 있는 월의 활동 내역 로드
            if (isReadOnly) {
                const data = await getTaskActivity(task.id, currentYear, viewingMonth);
                if (data) {
                    setFormData({
                        activityContent: data.activityContent || '',
                        status: task.status || 'inProgress',
                        actualValue: data.actualValue || ''
                    });
                } else {
                    setFormData({
                        activityContent: '',
                        status: task.status || 'inProgress',
                        actualValue: ''
                    });
                }
            } else {
                // 일반 모드: 현재 월의 활동 내역 로드
                const data = await getTaskActivity(task.id);
                if (data) {
                    setFormData({
                        activityContent: data.activityContent || '',
                        status: task.status || 'inProgress',
                        actualValue: data.actualValue || ''
                    });
                } else {
                    setFormData({
                        activityContent: '',
                        status: task.status || 'inProgress',
                        actualValue: ''
                    });
                }
            }
        } catch (error) {
            console.error('활동내역 조회 실패:', error);
        } finally {
            setLoading(false);
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

    // 뷰어 모드에서 월이 변경될 때 해당 월의 활동내역 로드
    useEffect(() => {
        if (isReadOnly && isOpen && task) {
            const loadViewingMonthData = async () => {
                try {
                    setLoading(true);
                    const data = await getTaskActivity(task.id, currentYear, viewingMonth);
                    if (data) {
                        setFormData({
                            activityContent: data.activityContent || '',
                            status: task.status || 'inProgress',
                            actualValue: data.actualValue || ''
                        });
                    } else {
                        setFormData({
                            activityContent: '',
                            status: task.status || 'inProgress',
                            actualValue: ''
                        });
                    }
                } catch (error) {
                    console.error('활동내역 조회 실패:', error);
                    setFormData({
                        activityContent: '',
                        status: task.status || 'inProgress',
                        actualValue: ''
                    });
                } finally {
                    setLoading(false);
                }
            };
            loadViewingMonthData();
        }
    }, [viewingMonth, isReadOnly, isOpen, task, currentYear]);

    // 뷰어 모드에서 월 이동 함수
    const handleViewingMonthChange = (direction) => {
        if (direction === 'prev') {
            setViewingMonth(prev => {
                if (prev === 1) return 12;
                return prev - 1;
            });
        } else {
            setViewingMonth(prev => {
                if (prev === 12) return 1;
                return prev + 1;
            });
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 프로그레스바 드래그 핸들러 (0~100% 범위)
    const handleProgressChange = (value) => {
        const percentage = typeof value === 'number' ? value : parseFloat(value);
        // 100%를 초과하지 않도록 제한
        const clampedPercentage = Math.min(percentage, 100);
        const newActualValue = (targetValue * clampedPercentage) / 100;
        setFormData(prev => ({
            ...prev,
            actualValue: newActualValue.toFixed(taskMetric === 'percent' ? 2 : 0)
        }));
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

        // 평가기준 확인
        const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
        const isQuantitative = evaluationType === 'quantitative' || evaluationType === '정량';

        try {
            setSubmitting(true);

            // 활동내역 저장 (정량일 때만 actualValue 전송)
            await inputTaskActivity(task.id, user.skid, {
                activityContent: formData.activityContent,
                actualValue: isQuantitative && formData.actualValue ? parseFloat(formData.actualValue) : null,
                status: formData.status
            });

            alert('활동내역이 성공적으로 저장되었습니다.');
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
    console.log('TaskInputModal - task.targetValue:', task?.targetValue);
    console.log('TaskInputModal - task.actualValue:', task?.actualValue);
    console.log('TaskInputModal - rawMetric:', rawMetric);
    console.log('TaskInputModal - taskMetric (normalized):', taskMetric);
    console.log('TaskInputModal - metricUnit:', metricUnit);
    console.log('TaskInputModal - metricLabel:', metricLabel);

    // 목표값과 실적값 (task에서 가져옴)
    const targetValue = task?.targetValue != null && task.targetValue !== 0 ? parseFloat(task.targetValue) : 0;
    const actualValue = formData.actualValue ? parseFloat(formData.actualValue) : (task?.actualValue != null && task.actualValue !== 0 ? parseFloat(task.actualValue) : 0);
    const achievement = task?.achievement != null ? parseFloat(task.achievement) : 0;

    // 달성률 계산 (목표값이 있을 때만, 실시간 업데이트)
    const calculatedAchievement = targetValue > 0 && actualValue > 0
        ? (actualValue / targetValue) * 100
        : 0;

    // 달성률에 따라 색상 계산 (0-100%에 따라 파란색에서 초록색으로 점진적 변화)
    const getProgressColor = (achievement) => {
        const percentage = Math.min(Math.max(achievement, 0), 100);

        // 0-70%: 파란색 계열
        // 70-90%: 노란색 계열
        // 90-100%: 초록색 계열
        if (percentage < 70) {
            // 파란색에서 노란색으로 (0-70%)
            const ratio = percentage / 70;
            const r = Math.round(0 + (255 - 0) * ratio); // 0 -> 255
            const g = Math.round(122 + (193 - 122) * ratio); // 122 -> 193
            const b = Math.round(255 + (7 - 255) * ratio); // 255 -> 7
            return `rgb(${r}, ${g}, ${b})`;
        } else if (percentage < 90) {
            // 노란색에서 주황색으로 (70-90%)
            const ratio = (percentage - 70) / 20;
            const r = Math.round(255 + (255 - 255) * ratio); // 255 유지
            const g = Math.round(193 + (140 - 193) * ratio); // 193 -> 140
            const b = Math.round(7 + (0 - 7) * ratio); // 7 -> 0
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // 주황색에서 초록색으로 (90-100%)
            const ratio = (percentage - 90) / 10;
            const r = Math.round(255 + (34 - 255) * ratio); // 255 -> 34
            const g = Math.round(140 + (197 - 140) * ratio); // 140 -> 197
            const b = Math.round(0 + (94 - 0) * ratio); // 0 -> 94
            return `rgb(${r}, ${g}, ${b})`;
        }
    };

    const progressColor = getProgressColor(calculatedAchievement);

    // 부서별로 담당자를 그룹화하는 함수
    const getManagersByDept = (managers) => {
        if (!managers || managers.length === 0) return [];

        // 부서별로 그룹화
        const deptMap = {};
        managers.forEach(manager => {
            const deptName = manager.deptName || '-';

            if (!deptMap[deptName]) {
                deptMap[deptName] = [];
            }
            deptMap[deptName].push(manager);
        });

        // 배열로 변환: [{ deptName: 'IT팀', managers: [manager1, manager2] }, ...]
        return Object.entries(deptMap).map(([deptName, managerList]) => ({
            deptName,
            managers: managerList
        }));
    };

    // 담당자 정보를 텍스트 형식으로 변환
    const formatManagers = (managers) => {
        if (!managers || managers.length === 0) return '-';

        const deptGroups = getManagersByDept(managers);
        return deptGroups.map(deptGroup => {
            const managerNames = deptGroup.managers.map(m => m.mbName || '-').join(', ');
            return `${deptGroup.deptName} - ${managerNames}`;
        }).join('\n');
    };

    // 상태 정규화 함수
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

    // 상태 뱃지 생성
    const getStatusBadge = (status) => {
        const statusConfig = {
            inProgress: { text: '진행중', className: 'task-input-status-badge in-progress', icon: Clock },
            completed: { text: '완료', className: 'task-input-status-badge completed', icon: CheckCircle },
            delayed: { text: '지연', className: 'task-input-status-badge delayed', icon: AlertCircle },
            stopped: { text: '중단', className: 'task-input-status-badge stopped', icon: XCircle },
        };

        const normalizedStatus = normalizeStatus(status);
        const config = statusConfig[normalizedStatus] || statusConfig.inProgress;
        const Icon = config.icon;

        return (
            <span className={config.className}>
                <Icon size={14} />
                {config.text}
            </span>
        );
    };

    // 평가기준 확인
    const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
    const isQuantitative = evaluationType === 'quantitative' || evaluationType === '정량';
    // 평가기준 텍스트 변환 (영어 -> 한글)
    let evaluationText = '-';
    if (task?.performance?.evaluation) {
        evaluationText = task.performance.evaluation === 'quantitative' ? '정량' : 
                        task.performance.evaluation === 'qualitative' ? '정성' : 
                        task.performance.evaluation;
    } else if (task?.performanceOriginal?.evaluation) {
        evaluationText = task.performanceOriginal.evaluation === 'quantitative' ? '정량' : 
                        task.performanceOriginal.evaluation === 'qualitative' ? '정성' : 
                        task.performanceOriginal.evaluation;
    } else if (task?.evaluationType) {
        evaluationText = task.evaluationType === 'quantitative' ? '정량' : 
                        task.evaluationType === 'qualitative' ? '정성' : 
                        task.evaluationType;
    }

    return (
        <div className="task-input-modal-overlay">
            <div className="task-input-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-header-top">
                            <h2 className="task-name-header">{task.name || task.taskName}</h2>
                        </div>
                        <div className="modal-header-badges">
                            {getStatusBadge(task.status)}
                            <span className={`task-input-evaluation-badge ${isQuantitative ? 'quantitative' : 'qualitative'}`}>
                                {evaluationText}
                            </span>
                            {task.managers && task.managers.length > 0 && (
                                <div className="task-managers-info-inline">
                                    {getManagersByDept(task.managers).map((deptGroup, idx) => (
                                        <span key={idx} className="manager-dept-inline">
                                            <span className="dept-name-inline">{deptGroup.deptName}</span>
                                            <span className="dept-separator-inline">·</span>
                                            <span className="manager-names-inline">
                                                {deptGroup.managers.map((m, mIdx) => (
                                                    <span key={m.userId || mIdx}>
                                                        {m.mbName || '-'}
                                                        {mIdx < deptGroup.managers.length - 1 && ', '}
                                                    </span>
                                                ))}
                                            </span>
                                            {idx < getManagersByDept(task.managers).length - 1 && <span className="dept-separator-inline"> / </span>}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-header-right">
                        <button className="close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="input-form">
                    {/* 이달 활동내역 입력 */}
                    <section className="form-section activity-main-section">
                        <div className="activity-main-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} />
                                {isReadOnly ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3>활동내역 (읽기 전용)</h3>
                                        <div className="month-navigation-inline">
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleViewingMonthChange('prev')}
                                                title="이전 월"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="month-display-inline">
                                                {currentYear}년 {viewingMonth}월
                                            </span>
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleViewingMonthChange('next')}
                                                title="다음 월"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                        <span className="read-only-badge">읽기 전용</span>
                                    </div>
                                ) : (
                                    <h3>이번 달 활동내역 입력 (필수)</h3>
                                )}
                            </div>
                        </div>
                        <div className="activity-main-container">
                            <div className="form-group activity-main-group">
                                <textarea
                                    name="activityContent"
                                    value={formData.activityContent}
                                    onChange={handleChange}
                                    placeholder={isReadOnly ? "활동내역이 없습니다" : "이번 달 진행한 활동내역을 입력하세요"}
                                    rows="10"
                                    required={!isReadOnly}
                                    disabled={isReadOnly}
                                    readOnly={isReadOnly}
                                    className="activity-main-textarea"
                                />
                            </div>

                            {/* AI 기능 버튼 - 읽기 전용일 때 숨김 */}
                            {!isReadOnly && (
                                <div className="ai-actions">
                                    <button
                                        type="button"
                                        className="ai-btn reference-btn"
                                        onClick={() => setShowPreviousActivitiesModal(true)}
                                        title="다른 월 활동내역 참조"
                                    >
                                        <Calendar size={16} />
                                        <span>이전 활동내역 참조</span>
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
                                        onClick={handleSpellingCheck}
                                        disabled={aiProcessing || !formData.activityContent.trim()}
                                    >
                                        <CheckCircle size={16} />
                                        <span>맞춤법 검사</span>
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
                            )}

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


                    {/* 목표 대비 실적 - 정량 평가일 때만 표시 */}
                    {isQuantitative && (
                        <section className="performance-section-compact">
                            <div className="performance-compact-header">
                                <TrendingUp size={14} />
                                <h3>목표 대비 실적</h3>
                            </div>

                            <div className="performance-compact-row">
                                {/* 프로그레스바 - 작게 */}
                                <div className="performance-slider-wrapper">
                                    <div className="performance-slider-compact">
                                        {isReadOnly ? (
                                            <div className="progress-readonly-track-small">
                                                <div
                                                    className="progress-readonly-fill-small"
                                                    style={{
                                                        width: `${Math.min(calculatedAchievement, 100)}%`,
                                                        backgroundColor: progressColor
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <Slider
                                                min={0}
                                                max={100}
                                                step={taskMetric === 'percent' ? 0.1 : 0.5}
                                                value={targetValue > 0 ? Math.min((actualValue / targetValue) * 100, 100) : 0}
                                                onChange={handleProgressChange}
                                                trackStyle={{ backgroundColor: progressColor, height: '3px' }}
                                                handleStyle={{
                                                    borderColor: progressColor,
                                                    backgroundColor: progressColor,
                                                    width: '12px',
                                                    height: '12px',
                                                    marginTop: '-4.5px',
                                                    borderWidth: '2px'
                                                }}
                                                railStyle={{ height: '3px' }}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* 실적값 - 목표/달성률과 동일한 박스 스타일 */}
                                <div className="performance-actual-compact">
                                    <span className="performance-actual-label-compact">실적</span>
                                    {isReadOnly ? (
                                        <span className="performance-actual-value-compact">{actualValue ? parseFloat(actualValue).toLocaleString() : '0'}{metricUnit}</span>
                                    ) : (
                                        <input
                                            type="number"
                                            name="actualValue"
                                            value={formData.actualValue || ''}
                                            onChange={handleChange}
                                            placeholder="0"
                                            step={taskMetric === 'percent' ? '0.01' : '1'}
                                            min="0"
                                            max={targetValue || undefined}
                                            className="performance-actual-value-compact-input"
                                        />
                                    )}
                                </div>

                                {/* 목표값 */}
                                <div className="performance-target-compact">
                                    <span className="performance-target-label-compact">목표</span>
                                    <span className="performance-target-value-compact">{targetValue ? parseFloat(targetValue).toLocaleString() : '0'}{metricUnit}</span>
                                </div>

                                {/* 달성률 박스 */}
                                <div className="performance-achievement-compact">
                                    <span className="performance-achievement-label-compact">달성률</span>
                                    <span
                                        className="performance-achievement-value-compact"
                                        style={{ color: progressColor }}
                                    >
                                        {calculatedAchievement.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 버튼 - 읽기 전용일 때는 닫기 버튼만 표시 */}
                    <div className="form-actions">
                        {isReadOnly ? (
                            <button type="button" className="btn-submit" onClick={onClose}>
                                닫기
                            </button>
                        ) : (
                            <>
                                <button type="button" className="btn-cancel" onClick={onClose}>
                                    취소
                                </button>
                                <button type="submit" className="btn-submit" disabled={submitting || loading}>
                                    {submitting ? '저장 중...' : '저장하기'}
                                </button>
                            </>
                        )}
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
