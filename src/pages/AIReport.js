import React, { useState, useEffect } from 'react';
import { Target, Briefcase, FileText, Loader2, Download, AlertCircle, CheckSquare, Square, X, CheckCircle, Code, MessageCircle, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import useUserStore from '../store/userStore';
import { getTasksByType, getTaskActivity, getAllPreviousActivities } from '../api/taskApi';
import { generateMonthlyReport, generateComprehensiveReport, generateCustomReport } from '../api/aiApi';
import './AIReport.css';
import './Dashboard.css';

function AIReport() {
    const { user } = useUserStore();
    const isAdmin = user?.role === '관리자';
    
    const [activeTab, setActiveTab] = useState('oi'); // 'oi' or 'key'
    const [tasks, setTasks] = useState([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
    const [reportType, setReportType] = useState(null); // null, 'monthly', or 'comprehensive'
    const [reportFormat, setReportFormat] = useState('markdown'); // 'html', 'markdown', 'custom'
    const [isTaskSelectModalOpen, setIsTaskSelectModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [report, setReport] = useState('');
    const [reportFormatType, setReportFormatType] = useState('markdown'); // 실제 생성된 보고서의 형식
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    // 커스텀 대화형 인터페이스
    const [customQuestion, setCustomQuestion] = useState('');
    const [customConversations, setCustomConversations] = useState([]);
    const [isCustomMode, setIsCustomMode] = useState(false);

    const taskType = activeTab === 'oi' ? 'OI' : '중점추진';

    // 과제 목록 조회 (기본 정보만)
    useEffect(() => {
        const loadTasks = async () => {
            try {
                setLoading(true);
                setError(null);
                const skid = !isAdmin ? (user?.skid || user?.userId) : null;
                const data = await getTasksByType(taskType, skid);
                
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
        setReportFormat('markdown');
        setIsCustomMode(false);
        setCustomConversations([]);
        setIsTaskSelectModalOpen(true);
        
        if (type === 'monthly' && tasks.length > 0) {
            try {
                setLoadingActivities(true);
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;

                // 각 과제의 이달 활동내역 확인
                const tasksWithActivityStatus = await Promise.all(
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
                );

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
            if (reportFormat === 'custom') {
                // 커스텀 모드로 전환
                setIsCustomMode(true);
                setCustomConversations([{
                    role: 'system',
                    message: '안녕하세요! 보고서에 대해 질문해주세요. 선택한 과제들의 활동내역을 바탕으로 답변드리겠습니다.'
                }]);
                setReportFormatType('custom');
                return;
            } else {
                setIsCustomMode(false);
                const format = reportFormat === 'html' ? 'html' : 'markdown';
                if (reportType === 'monthly') {
                    generatedReport = await generateMonthlyReport(taskType, filteredTasks, format);
                } else {
                    generatedReport = await generateComprehensiveReport(taskType, filteredTasks, format);
                }
                setReportFormatType(format);
                setReport(generatedReport);
            }
        } catch (error) {
            console.error('보고서 생성 실패:', error);
            setError('보고서 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsGenerating(false);
        }
    };

    // 커스텀 질문 전송
    const handleCustomQuestion = async () => {
        if (!customQuestion.trim()) return;

        const question = customQuestion.trim();
        setCustomQuestion('');
        
        // 사용자 질문 추가
        setCustomConversations(prev => [...prev, {
            role: 'user',
            message: question
        }]);

        try {
            setIsGenerating(true);
            const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.taskId));
            
            // 활동내역 가져오기
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

            const answer = await generateCustomReport(taskType, filteredTasks, question);
            
            setCustomConversations(prev => [...prev, {
                role: 'assistant',
                message: answer
            }]);
        } catch (error) {
            console.error('질문 처리 실패:', error);
            setCustomConversations(prev => [...prev, {
                role: 'error',
                message: '질문 처리에 실패했습니다. 다시 시도해주세요.'
            }]);
        } finally {
            setIsGenerating(false);
        }
    };

    // 보고서 다운로드
    const handleDownloadReport = () => {
        if (!report && customConversations.length === 0) return;

        let content = '';
        let filename = '';
        let mimeType = 'text/plain;charset=utf-8';

        if (isCustomMode && customConversations.length > 0) {
            // 커스텀 대화 내보내기
            content = customConversations.map(c => 
                `${c.role === 'user' ? '질문' : c.role === 'assistant' ? '답변' : '시스템'}: ${c.message}\n\n`
            ).join('---\n\n');
            filename = `${taskType}_커스텀_대화_${new Date().toISOString().split('T')[0]}.txt`;
        } else if (reportFormatType === 'html') {
            content = report;
            mimeType = 'text/html;charset=utf-8';
            filename = `${taskType}_${reportType === 'monthly' ? '월간' : '종합'}_보고서_${new Date().toISOString().split('T')[0]}.html`;
        } else {
            content = report;
            filename = `${taskType}_${reportType === 'monthly' ? '월간' : '종합'}_보고서_${new Date().toISOString().split('T')[0]}.md`;
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
                    <span className="tab-count">{tasks.length}</span>
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
                    <span className="tab-count">{tasks.length}</span>
                </button>
                <div className="tab-spacer"></div>
            </div>

            {/* 탭 컨텐츠 영역 */}
            <div className="tab-content">
                <div className="ai-report-main">
                    {/* 좌측: 과제 목록 및 설정 */}
                    <div className="ai-report-sidebar">
                        {/* 보고서 유형 선택 */}
                        <div className="report-type-selection">
                            <h4>보고서 유형 선택</h4>
                            <div className="report-type-buttons">
                                <button
                                    className={`report-type-btn ${reportType === 'monthly' ? 'active' : ''}`}
                                    onClick={() => handleReportTypeSelect('monthly')}
                                >
                                    <FileText size={16} />
                                    <span>월간 보고서</span>
                                    <small>이번달 활동</small>
                                </button>
                                <button
                                    className={`report-type-btn ${reportType === 'comprehensive' ? 'active' : ''}`}
                                    onClick={() => handleReportTypeSelect('comprehensive')}
                                >
                                    <FileText size={16} />
                                    <span>종합 보고서</span>
                                    <small>전체 활동</small>
                                </button>
                            </div>
                        </div>

                        {!reportType && (
                            <div className="report-type-prompt">
                                <FileText size={48} />
                                <p>보고서 유형을 선택해주세요</p>
                            </div>
                        )}

                        {reportType && (
                            <>
                                <div className="selected-info">
                                    <p>선택된 과제: <strong>{selectedTaskIds.size}</strong>개</p>
                                </div>

                                {/* 보고서 형식 선택 */}
                                <div className="report-format-selection">
                                    <h4>보고서 형식</h4>
                                    <div className="report-format-buttons">
                                        <button
                                            className={`report-format-btn ${reportFormat === 'html' ? 'active' : ''}`}
                                            onClick={() => setReportFormat('html')}
                                        >
                                            <Code size={16} />
                                            <span>HTML</span>
                                            <small>뉴스클립</small>
                                        </button>
                                        <button
                                            className={`report-format-btn ${reportFormat === 'markdown' ? 'active' : ''}`}
                                            onClick={() => setReportFormat('markdown')}
                                        >
                                            <FileText size={16} />
                                            <span>Markdown</span>
                                            <small>문서</small>
                                        </button>
                                        <button
                                            className={`report-format-btn ${reportFormat === 'custom' ? 'active' : ''}`}
                                            onClick={() => setReportFormat('custom')}
                                        >
                                            <MessageCircle size={16} />
                                            <span>커스텀</span>
                                            <small>대화식</small>
                                        </button>
                                    </div>
                                </div>

                                {/* 보고서 생성 버튼 */}
                                <button
                                    className="generate-report-btn"
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
                            </>
                        )}
                    </div>

                    {/* 우측: 보고서 결과 */}
                    <div className="ai-report-result">
                        {loading ? (
                            <div className="ai-report-loading">
                                <Loader2 size={32} className="spinning" />
                                <p>과제 목록을 불러오는 중...</p>
                            </div>
                        ) : error ? (
                            <div className="ai-report-error">
                                <AlertCircle size={32} />
                                <p>{error}</p>
                            </div>
                        ) : isCustomMode ? (
                            <div className="ai-report-output custom-mode">
                                <div className="ai-report-output-header">
                                    <h3>커스텀 질문 모드</h3>
                                    <button
                                        className="download-btn"
                                        onClick={handleDownloadReport}
                                    >
                                        <Download size={18} />
                                        <span>대화 내보내기</span>
                                    </button>
                                </div>
                                <div className="custom-conversation">
                                    <div className="custom-conversation-list">
                                        {customConversations.map((conv, index) => (
                                            <div key={index} className={`custom-message ${conv.role}`}>
                                                <div className="custom-message-content">
                                                    {conv.role === 'assistant' ? (
                                                        <ReactMarkdown>{conv.message}</ReactMarkdown>
                                                    ) : (
                                                        conv.message
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {isGenerating && (
                                            <div className="custom-message assistant">
                                                <div className="custom-message-content">
                                                    <Loader2 size={16} className="spinning" />
                                                    <span>답변 생성 중...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="custom-input-area">
                                        <textarea
                                            className="custom-question-input"
                                            placeholder="질문을 입력하세요..."
                                            value={customQuestion}
                                            onChange={(e) => setCustomQuestion(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleCustomQuestion();
                                                }
                                            }}
                                            rows={3}
                                            disabled={isGenerating}
                                        />
                                        <button
                                            className="custom-send-btn"
                                            onClick={handleCustomQuestion}
                                            disabled={isGenerating || !customQuestion.trim()}
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : report ? (
                            <div className="ai-report-output">
                                <div className="ai-report-output-header">
                                    <h3>
                                        {reportType === 'monthly' ? '월간 보고서' : '종합 보고서'}
                                        <span className="format-badge">{reportFormatType === 'html' ? 'HTML' : 'Markdown'}</span>
                                    </h3>
                                    <button
                                        className="download-btn"
                                        onClick={handleDownloadReport}
                                    >
                                        <Download size={18} />
                                        <span>다운로드</span>
                                    </button>
                                </div>
                                <div className={`ai-report-text ${reportFormatType === 'html' ? 'html-content' : reportFormatType === 'markdown' ? 'markdown-content' : ''}`}>
                                    {reportFormatType === 'html' ? (
                                        <div dangerouslySetInnerHTML={{ __html: report }} />
                                    ) : reportFormatType === 'markdown' ? (
                                        <ReactMarkdown>{report}</ReactMarkdown>
                                    ) : (
                                        <pre>{report}</pre>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="ai-report-empty">
                                <FileText size={48} />
                                <h3>보고서 생성 준비 완료</h3>
                                <p>왼쪽에서 과제를 선택하고<br />보고서 유형을 선택한 후<br />"보고서 생성" 버튼을 클릭하세요.</p>
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
                            {loadingActivities ? (
                                <div className="task-select-modal-loading">
                                    <Loader2 size={24} className="spinning" />
                                    <p>활동내역 확인 중...</p>
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
