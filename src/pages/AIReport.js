import React, { useState, useEffect } from 'react';
import { Target, Briefcase, FileText, Loader2, Download, AlertCircle, CheckSquare, Square, X, CheckCircle, Code, Edit, Eye, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import useUserStore from '../store/userStore';
import { getTasksByType, getTaskActivity, getAllPreviousActivities } from '../api/taskApi';
import { generateMonthlyReport, generateComprehensiveReport, generateCustomReport } from '../api/aiApi';
import { Skeleton, CardSkeleton } from '../components/Skeleton';
import './AIReport.css';
import './Dashboard.css';

function AIReport() {
    const { user } = useUserStore();
    const isAdmin = user?.role === '관리자';

    const [activeTab, setActiveTab] = useState('oi'); // 'oi' or 'key'
    const [tasks, setTasks] = useState([]);
    const [oiTaskCount, setOiTaskCount] = useState(0);
    const [keyTaskCount, setKeyTaskCount] = useState(0);
    const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
    const [reportType, setReportType] = useState(null); // null, 'monthly', or 'comprehensive'
    const [reportFormat, setReportFormat] = useState('text'); // 'html', 'text'
    const [isTaskSelectModalOpen, setIsTaskSelectModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [report, setReport] = useState('');
    const [reportFormatType, setReportFormatType] = useState('markdown'); // 실제 생성된 보고서의 형식
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [isEditingReport, setIsEditingReport] = useState(false);
    // 추가 프롬프트로 수정
    const [modifyPrompt, setModifyPrompt] = useState('');
    const [isModifying, setIsModifying] = useState(false);

    const taskType = activeTab === 'oi' ? 'OI' : '중점추진';

    // 모든 탭의 과제 수 조회 (초기 로드 시 한 번만)
    useEffect(() => {
        const loadAllTaskCounts = async () => {
            if (!user) return;

            try {
                const skid = !isAdmin ? (user?.skid || user?.userId) : null;

                // OI 과제 수 조회
                const oiData = await getTasksByType('OI', skid);
                setOiTaskCount(oiData.length);

                // 중점추진 과제 수 조회
                const keyData = await getTasksByType('중점추진', skid);
                setKeyTaskCount(keyData.length);
            } catch (error) {
                console.error('과제 수 조회 실패:', error);
            }
        };

        loadAllTaskCounts();
    }, [user, isAdmin]);

    // 과제 목록 조회 (기본 정보만)
    useEffect(() => {
        const loadTasks = async () => {
            try {
                setLoading(true);
                setError(null);
                const skid = !isAdmin ? (user?.skid || user?.userId) : null;

                // API 호출과 최소 딜레이를 병렬로 처리
                const [data] = await Promise.all([
                    getTasksByType(taskType, skid),
                    new Promise(resolve => setTimeout(resolve, 300)) // 최소 300ms 딜레이
                ]);

                // 과제 정보를 저장 (활동내역 정보는 나중에)
                const formattedTasks = data.map(task => ({
                    taskId: task.taskId,
                    taskName: task.taskName,
                    category1: task.category1 || '-',
                    category2: task.category2 || '-',
                    hasCurrentMonthActivity: null, // 나중에 확인
                }));

                setTasks(formattedTasks);
                setSelectedTaskIds(new Set()); // 탭 변경 시 선택 초기화
                setReport(''); // 보고서 초기화
                setReportType(null); // 보고서 유형 초기화
            } catch (error) {
                console.error('과제 목록 조회 실패:', error);
                setError('과제 목록을 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            loadTasks();
        }
    }, [activeTab, user, isAdmin, taskType]);

    // 보고서 유형 선택 시 모달 열기 및 이달 활동내역 확인
    const handleReportTypeSelect = async (type) => {
        setReportType(type);
        setSelectedTaskIds(new Set());
        setReport('');
        setReportFormat('text');
        setModifyPrompt('');
        setIsTaskSelectModalOpen(true);

        if (type === 'monthly' && tasks.length > 0) {
            try {
                setLoadingActivities(true);
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;

                // 각 과제의 이달 활동내역 확인과 최소 딜레이를 병렬로 처리
                const [tasksWithActivityStatus] = await Promise.all([
                    Promise.all(
                        tasks.map(async (task) => {
                            try {
                                const activity = await getTaskActivity(task.taskId, currentYear, currentMonth);
                                return {
                                    ...task,
                                    hasCurrentMonthActivity: activity && activity.activityContent && activity.activityContent.trim() !== ''
                                };
                            } catch (err) {
                                console.error(`과제 ${task.taskName} 활동내역 확인 실패:`, err);
                                return {
                                    ...task,
                                    hasCurrentMonthActivity: false
                                };
                            }
                        })
                    ),
                    new Promise(resolve => setTimeout(resolve, 300)) // 최소 300ms 딜레이
                ]);

                // 이달 입력된 과제 순으로 정렬
                const sortedTasks = [...tasksWithActivityStatus].sort((a, b) => {
                    if (a.hasCurrentMonthActivity === b.hasCurrentMonthActivity) return 0;
                    return a.hasCurrentMonthActivity ? -1 : 1;
                });

                setTasks(sortedTasks);
            } catch (error) {
                console.error('활동내역 확인 실패:', error);
            } finally {
                setLoadingActivities(false);
            }
        }
    };

    // 전체 선택/해제
    const handleSelectAll = () => {
        if (selectedTaskIds.size === tasks.length) {
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(tasks.map(t => t.taskId)));
        }
    };

    // 개별 과제 선택/해제
    const handleToggleTask = (taskId) => {
        const newSelected = new Set(selectedTaskIds);
        if (newSelected.has(taskId)) {
            newSelected.delete(taskId);
        } else {
            newSelected.add(taskId);
        }
        setSelectedTaskIds(newSelected);
    };

    // 보고서 생성
    const handleGenerateReport = async () => {
        if (selectedTaskIds.size === 0) {
            alert('보고서를 생성할 과제를 선택해주세요.');
            return;
        }

        try {
            setIsGenerating(true);
            setError(null);
            setReport('');

            // 선택한 과제들만 필터링
            const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.taskId));

            // 각 과제의 활동내역 가져오기
            const tasksWithActivities = await Promise.all(
                selectedTasks.map(async (task) => {
                    try {
                        let activities = [];

                        if (reportType === 'monthly') {
                            // 월간 보고서: 이번달 활동만
                            const now = new Date();
                            const currentYear = now.getFullYear();
                            const currentMonth = now.getMonth() + 1;

                            const activity = await getTaskActivity(task.taskId, currentYear, currentMonth);
                            if (activity && activity.activityContent) {
                                activities = [{
                                    activityYear: currentYear,
                                    activityMonth: currentMonth,
                                    activityContent: activity.activityContent
                                }];
                            }
                        } else {
                            // 종합 보고서: 모든 활동내역
                            const allActivities = await getAllPreviousActivities(task.taskId, 100);
                            activities = allActivities.map(act => ({
                                activityYear: act.activityYear,
                                activityMonth: act.activityMonth,
                                activityContent: act.activityContent || ''
                            }));
                        }

                        return {
                            taskName: task.taskName,
                            activities: activities,
                            activityContent: reportType === 'monthly'
                                ? (activities.length > 0 ? activities[0].activityContent : '')
                                : undefined
                        };
                    } catch (err) {
                        console.error(`과제 ${task.taskName} 활동내역 조회 실패:`, err);
                        return {
                            taskName: task.taskName,
                            activities: [],
                            activityContent: ''
                        };
                    }
                })
            );

            // 월간 보고서: 활동내역이 있는 과제만 필터링
            const filteredTasks = reportType === 'monthly'
                ? tasksWithActivities.filter(t => t.activityContent && t.activityContent.trim() !== '')
                : tasksWithActivities;

            if (filteredTasks.length === 0) {
                if (reportType === 'monthly') {
                    alert('이번달에 기입한 내용이 있는 과제가 없습니다.');
                } else {
                    alert('활동내역이 있는 과제가 없습니다.');
                }
                setIsGenerating(false);
                return;
            }

            // AI API 호출
            let generatedReport;
            const format = reportFormat === 'html' ? 'html' : 'markdown';

            // 기본 프롬프트로 보고서 생성
            if (reportType === 'monthly') {
                generatedReport = await generateMonthlyReport(taskType, filteredTasks, format);
            } else {
                generatedReport = await generateComprehensiveReport(taskType, filteredTasks, format);
            }
            setReportFormatType(format);
            setReport(generatedReport);
        } catch (error) {
            console.error('보고서 생성 실패:', error);
            setError('보고서 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsGenerating(false);
        }
    };


    // 추가 프롬프트로 보고서 수정
    const handleModifyReport = async () => {
        if (!modifyPrompt.trim()) {
            alert('수정할 내용을 입력해주세요.');
            return;
        }

        if (selectedTaskIds.size === 0) {
            alert('과제를 선택해주세요.');
            return;
        }

        try {
            setIsModifying(true);
            setError(null);

            const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.taskId));

            // 각 과제의 활동내역 가져오기
            const tasksWithActivities = await Promise.all(
                selectedTasks.map(async (task) => {
                    try {
                        let activities = [];
                        if (reportType === 'monthly') {
                            const now = new Date();
                            const currentYear = now.getFullYear();
                            const currentMonth = now.getMonth() + 1;
                            const activity = await getTaskActivity(task.taskId, currentYear, currentMonth);
                            if (activity && activity.activityContent) {
                                activities = [{
                                    activityYear: currentYear,
                                    activityMonth: currentMonth,
                                    activityContent: activity.activityContent
                                }];
                            }
                        } else {
                            const allActivities = await getAllPreviousActivities(task.taskId, 100);
                            activities = allActivities.map(act => ({
                                activityYear: act.activityYear,
                                activityMonth: act.activityMonth,
                                activityContent: act.activityContent || ''
                            }));
                        }
                        return {
                            taskName: task.taskName,
                            activities: activities,
                            activityContent: reportType === 'monthly'
                                ? (activities.length > 0 ? activities[0].activityContent : '')
                                : undefined
                        };
                    } catch (err) {
                        return {
                            taskName: task.taskName,
                            activities: [],
                            activityContent: ''
                        };
                    }
                })
            );

            const filteredTasks = reportType === 'monthly'
                ? tasksWithActivities.filter(t => t.activityContent && t.activityContent.trim() !== '')
                : tasksWithActivities;

            if (filteredTasks.length === 0) {
                alert('활동내역이 있는 과제가 없습니다.');
                setIsModifying(false);
                return;
            }

            // 현재 보고서와 추가 프롬프트를 결합하여 수정
            const combinedPrompt = `다음 보고서를 다음과 같이 수정해주세요:\n\n${modifyPrompt}\n\n기존 보고서:\n${report}`;
            const modifiedReport = await generateCustomReport(taskType, filteredTasks, combinedPrompt);
            setReport(modifiedReport);
            setModifyPrompt('');
        } catch (error) {
            console.error('보고서 수정 실패:', error);
            setError('보고서 수정에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsModifying(false);
        }
    };

    // 보고서 다운로드
    const handleDownloadReport = () => {
        let content = '';
        let filename = '';
        let mimeType = 'text/plain;charset=utf-8';

        if (report && reportFormatType === 'html') {
            content = report;
            mimeType = 'text/html;charset=utf-8';
            filename = `${taskType}_${reportType === 'monthly' ? '월간' : '종합'}_보고서_${new Date().toISOString().split('T')[0]}.html`;
        } else if (report) {
            content = report;
            filename = `${taskType}_${reportType === 'monthly' ? '월간' : '종합'}_보고서_${new Date().toISOString().split('T')[0]}.md`;
            mimeType = 'text/markdown;charset=utf-8';
        } else {
            return;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const allSelected = tasks.length > 0 && selectedTaskIds.size === tasks.length;
    const someSelected = selectedTaskIds.size > 0 && selectedTaskIds.size < tasks.length;

    return (
        <div className="dashboard">
            {/* 탭 네비게이션 - 브라우저 스타일 */}
            <div className="tab-navigation">
                <button
                    className={`tab-btn ${activeTab === 'oi' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('oi');
                        setReport('');
                        setError(null);
                    }}
                >
                    <Target size={16} />
                    <span>OI 과제</span>
                    <span className="tab-count">{oiTaskCount}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'key' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('key');
                        setReport('');
                        setError(null);
                    }}
                >
                    <Briefcase size={16} />
                    <span>중점추진과제</span>
                    <span className="tab-count">{keyTaskCount}</span>
                </button>
                <div className="tab-spacer"></div>
            </div>

            {/* 탭 컨텐츠 영역 */}
            <div className="tab-content">
                <div className="ai-report-main">
                    {/* 좌측: 설정 패널 */}
                    <div className="ai-report-sidebar">
                        <div className="ai-report-sidebar-content">
                            {/* Step 1: 보고서 유형 선택 */}
                            <div className="step-section">
                                <div className="step-header">
                                    <span className="step-number">1</span>
                                    <h4>보고서 유형</h4>
                                </div>
                                <div className="report-type-buttons">
                                    <button
                                        className={`report-type-btn ${reportType === 'monthly' ? 'active' : ''}`}
                                        onClick={() => handleReportTypeSelect('monthly')}
                                    >
                                        <FileText size={18} />
                                        <div>
                                            <span>월간 보고서</span>
                                            <small>이번달 활동내역</small>
                                        </div>
                                    </button>
                                    <button
                                        className={`report-type-btn ${reportType === 'comprehensive' ? 'active' : ''}`}
                                        onClick={() => handleReportTypeSelect('comprehensive')}
                                    >
                                        <FileText size={18} />
                                        <div>
                                            <span>종합 보고서</span>
                                            <small>전체 활동내역</small>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {reportType && (
                                <>
                                    {/* Step 2: 보고서 형식 선택 */}
                                    <div className="step-section">
                                        <div className="step-header">
                                            <span className="step-number">2</span>
                                            <h4>보고서 형식</h4>
                                        </div>
                                        <div className="report-format-buttons">
                                            <button
                                                className={`report-format-btn ${reportFormat === 'html' ? 'active' : ''}`}
                                                onClick={() => setReportFormat('html')}
                                            >
                                                <Code size={18} />
                                                <div>
                                                    <span>HTML</span>
                                                    <small>뉴스클립용</small>
                                                </div>
                                            </button>
                                            <button
                                                className={`report-format-btn ${reportFormat === 'text' ? 'active' : ''}`}
                                                onClick={() => setReportFormat('text')}
                                            >
                                                <FileText size={18} />
                                                <div>
                                                    <span>텍스트</span>
                                                    <small>편집 가능</small>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {!reportType && (
                                <div className="report-type-prompt">
                                    <FileText size={40} />
                                    <p>보고서 유형을 선택해주세요</p>
                                </div>
                            )}
                        </div>

                        {/* 좌측 하단: 선택된 과제 수 및 보고서 생성 버튼 */}
                        {reportType && (
                            <div className="ai-report-sidebar-footer">
                                <div className="selected-tasks-count">
                                    <span className="selected-count-label">선택된 과제</span>
                                    <span className="selected-count-number">{selectedTaskIds.size}</span>
                                </div>
                                <button
                                    className="generate-report-btn-sidebar"
                                    onClick={handleGenerateReport}
                                    disabled={isGenerating || loading || loadingActivities || selectedTaskIds.size === 0}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={18} className="spinning" />
                                            <span>생성 중...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileText size={18} />
                                            <span>보고서 생성</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 우측: 보고서 결과 */}
                    <div className="ai-report-result">
                        {loading ? (
                            <div className="ai-report-skeleton">
                                <CardSkeleton count={3} />
                            </div>
                        ) : error ? (
                            <div className="ai-report-error">
                                <AlertCircle size={32} />
                                <p>{error}</p>
                            </div>
                        ) : isGenerating ? (
                            <div className="ai-report-generating">
                                <div className="ai-generating-animation">
                                    <div className="ai-sparkle-container">
                                        <Sparkles className="ai-sparkle ai-sparkle-1" size={24} />
                                        <Sparkles className="ai-sparkle ai-sparkle-2" size={28} />
                                        <Sparkles className="ai-sparkle ai-sparkle-3" size={22} />
                                    </div>
                                    <div className="ai-generating-content">
                                        <h3>AI가 보고서를 생성하고 있습니다</h3>
                                        <p>선택하신 과제의 활동내역을 분석하여 보고서를 작성 중입니다...</p>
                                    </div>
                                </div>
                            </div>
                        ) : report ? (
                            <div className="ai-report-output">
                                <div className="ai-report-output-header">
                                    <h3>
                                        {reportType === 'monthly' ? '월간 보고서' : '종합 보고서'}
                                        <span className="format-badge">{reportFormatType === 'html' ? 'HTML' : '텍스트'}</span>
                                        {reportFormatType === 'markdown' && report && (
                                            <span className="markdown-length" style={{ marginLeft: '12px', fontSize: '12px', color: '#9ca3af', fontWeight: 'normal' }}>
                                                {report.length}자
                                            </span>
                                        )}
                                    </h3>
                                    {reportFormatType === 'html' && (
                                        <button
                                            className="report-header-download-btn"
                                            onClick={handleDownloadReport}
                                            title="다운로드"
                                        >
                                            <Download size={18} />
                                            <span>다운로드</span>
                                        </button>
                                    )}
                                </div>

                                {/* 프롬프트 수정 (텍스트 형식일 때만) */}
                                {reportFormatType === 'markdown' && (
                                    <div className="modify-prompt-section">
                                        <div className="modify-prompt-integrated">
                                            <div className="modify-prompt-label">
                                                <Edit size={16} />
                                                <span>프롬프트 수정</span>
                                            </div>
                                            <div className="modify-prompt-input-group">
                                                <textarea
                                                    className="modify-prompt-input"
                                                    placeholder="예: 더 간결하게 요약해주세요.&#10;예: 각 과제별로 성과 지표를 추가해주세요."
                                                    value={modifyPrompt}
                                                    onChange={(e) => setModifyPrompt(e.target.value)}
                                                    rows={2}
                                                    disabled={isModifying}
                                                />
                                                <button
                                                    className="modify-btn"
                                                    onClick={handleModifyReport}
                                                    disabled={isModifying || !modifyPrompt.trim()}
                                                >
                                                    {isModifying ? (
                                                        <>
                                                            <Loader2 size={16} className="spinning" />
                                                            <span>수정 중...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Edit size={16} />
                                                            <span>수정</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className={`ai-report-text ${reportFormatType === 'html' ? 'html-content' : reportFormatType === 'markdown' ? 'markdown-content' : ''}`}>
                                    {/* 리포트 내부 우측 상단 액션 버튼 (마크다운일 때만) */}
                                    {reportFormatType === 'markdown' && (
                                        <div className="report-inline-actions">
                                            <button
                                                className="report-action-icon-btn"
                                                onClick={() => setIsEditingReport(!isEditingReport)}
                                                title={isEditingReport ? '미리보기' : '편집'}
                                            >
                                                {isEditingReport ? (
                                                    <Eye size={18} />
                                                ) : (
                                                    <Edit size={18} />
                                                )}
                                            </button>
                                            <button
                                                className="report-action-icon-btn"
                                                onClick={handleDownloadReport}
                                                title="다운로드"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    )}

                                    {reportFormatType === 'html' ? (
                                        <div dangerouslySetInnerHTML={{ __html: report }} />
                                    ) : reportFormatType === 'markdown' ? (
                                        isEditingReport ? (
                                            <textarea
                                                className="markdown-editor"
                                                value={report}
                                                onChange={(e) => setReport(e.target.value)}
                                                placeholder="마크다운 텍스트를 편집하세요..."
                                            />
                                        ) : (
                                            <ReactMarkdown>{report}</ReactMarkdown>
                                        )
                                    ) : (
                                        <pre>{report}</pre>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="ai-report-empty">
                                <div className="empty-state-content">
                                    <div className="empty-state-icon-wrapper">
                                        <div className="empty-state-icon-bg">
                                            <FileText className="empty-state-icon" size={56} />
                                        </div>
                                        <div className="empty-state-glow"></div>
                                    </div>
                                    <div className="empty-state-text">
                                        <h3>AI 보고서 생성</h3>
                                        <p>과제 활동내역을 분석하여 전문적인 보고서를 자동으로 생성합니다</p>
                                    </div>
                                    <div className="empty-state-notice">
                                        <AlertCircle size={16} />
                                        <p>AI가 생성한 보고서는 참고용이며, 실수나 부정확한 내용이 포함될 수 있습니다. 최종 확인 후 사용해주세요.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 과제 선택 모달 */}
            {isTaskSelectModalOpen && (
                <div className="task-select-modal-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        setIsTaskSelectModalOpen(false);
                    }
                }}>
                    <div className="task-select-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="task-select-modal-header">
                            <h3>
                                {reportType === 'monthly' ? '월간 보고서' : '종합 보고서'} - 과제 선택
                            </h3>
                            <button
                                className="task-select-modal-close"
                                onClick={() => setIsTaskSelectModalOpen(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="task-select-modal-content">
                            {(loadingActivities || loading) ? (
                                <div className="task-select-modal-loading">
                                    <div className="task-select-skeleton">
                                        <div className="task-select-skeleton-actions">
                                            <Skeleton height="36px" width="100px" borderRadius="6px" />
                                            <Skeleton height="20px" width="120px" borderRadius="4px" />
                                        </div>
                                        <div className="task-select-skeleton-grid">
                                            {Array.from({ length: 8 }).map((_, idx) => (
                                                <div key={idx} className="task-select-skeleton-card">
                                                    <div className="task-select-skeleton-checkbox">
                                                        <Skeleton width="20px" height="20px" borderRadius="4px" />
                                                    </div>
                                                    <div className="task-select-skeleton-content">
                                                        <Skeleton height="18px" width="85%" borderRadius="4px" />
                                                        <Skeleton height="14px" width="65%" borderRadius="4px" style={{ marginTop: '8px' }} />
                                                        <Skeleton height="22px" width="50%" borderRadius="6px" style={{ marginTop: '12px' }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="task-select-modal-empty">
                                    <p>과제가 없습니다.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="task-select-modal-actions">
                                        <button
                                            className="task-select-all-btn"
                                            onClick={handleSelectAll}
                                        >
                                            {allSelected ? '전체 해제' : '전체 선택'}
                                        </button>
                                        <span className="task-select-count">
                                            선택: {selectedTaskIds.size} / {tasks.length}
                                        </span>
                                    </div>
                                    <div className="task-select-grid">
                                        {tasks.map((task) => {
                                            const isSelected = selectedTaskIds.has(task.taskId);
                                            const showActivityStatus = reportType === 'monthly' && task.hasCurrentMonthActivity !== null;
                                            return (
                                                <div
                                                    key={task.taskId}
                                                    className={`task-select-card ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => handleToggleTask(task.taskId)}
                                                >
                                                    <div className="task-select-card-checkbox">
                                                        {isSelected ? (
                                                            <CheckSquare size={20} className="checkbox-icon" />
                                                        ) : (
                                                            <Square size={20} className="checkbox-icon" />
                                                        )}
                                                    </div>
                                                    <div className="task-select-card-content">
                                                        <div className="task-select-card-name">{task.taskName}</div>
                                                        {(task.category1 && task.category1 !== '-') && (
                                                            <div className="task-select-card-category">
                                                                {task.category1}
                                                                {task.category2 && task.category2 !== '-' && ` > ${task.category2}`}
                                                            </div>
                                                        )}
                                                        {showActivityStatus && (
                                                            <div className="task-select-card-status">
                                                                {task.hasCurrentMonthActivity ? (
                                                                    <span className="activity-status inputted">
                                                                        <CheckCircle size={14} />
                                                                        이달 입력됨
                                                                    </span>
                                                                ) : (
                                                                    <span className="activity-status not-inputted">
                                                                        <AlertCircle size={14} />
                                                                        이달 미입력
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="task-select-modal-footer">
                            <button
                                className="task-select-modal-cancel"
                                onClick={() => setIsTaskSelectModalOpen(false)}
                            >
                                취소
                            </button>
                            <button
                                className="task-select-modal-confirm"
                                onClick={() => {
                                    if (selectedTaskIds.size === 0) {
                                        alert('과제를 최소 1개 이상 선택해주세요.');
                                        return;
                                    }
                                    setIsTaskSelectModalOpen(false);
                                }}
                                disabled={selectedTaskIds.size === 0}
                            >
                                확인 ({selectedTaskIds.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AIReport;
