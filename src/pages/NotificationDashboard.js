import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Send, RefreshCw, CheckCircle, XCircle, ChevronLeft, ChevronRight, CheckSquare, Square, Clock } from 'lucide-react';
import useUserStore from '../store/userStore';
import { getAllNotifications, sendNotifications, getNotInputtedTasks } from '../api/notificationApi';
import { formatDate } from '../utils/dateUtils';
import { TableSkeleton, ListItemSkeleton } from '../components/Skeleton';
import './NotificationDashboard.css';

function NotificationDashboard() {
    const navigate = useNavigate();
    const { user } = useUserStore();
    const isAdmin = user?.role === '관리자';

    const [notInputtedTasks, setNotInputtedTasks] = useState([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [selectedGubun, setSelectedGubun] = useState('OI');

    // 페이징 상태
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const pageSize = 10;

    // 관리자만 접근 가능
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (!isAdmin) {
            alert('알림 대시보드는 관리자만 접근할 수 있습니다.');
            navigate('/key-tasks');
        }
    }, [user, isAdmin, navigate]);

    // 미입력 과제 목록 조회
    const loadNotInputtedTasks = async () => {
        try {
            setTasksLoading(true);
            const [data] = await Promise.all([
                getNotInputtedTasks(selectedGubun),
                new Promise(resolve => setTimeout(resolve, 300)) // 최소 300ms 딜레이
            ]);
            setNotInputtedTasks(data);
            setSelectedTaskIds(new Set()); // 선택 초기화
        } catch (error) {
            console.error('미입력 과제 목록 조회 실패:', error);
            alert('미입력 과제 목록을 불러오는데 실패했습니다.');
        } finally {
            setTasksLoading(false);
        }
    };

    // 알림 목록 조회 (페이징)
    const loadNotifications = async (page = 0) => {
        try {
            setLoading(true);
            const [data] = await Promise.all([
                getAllNotifications(page, pageSize),
                new Promise(resolve => setTimeout(resolve, 600)) // 최소 600ms 딜레이
            ]);
            setNotifications(data.content || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
            setCurrentPage(data.currentPage || 0);
        } catch (error) {
            console.error('알림 목록 조회 실패:', error);
            alert('알림 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 과제 선택/해제
    const handleTaskToggle = (taskId) => {
        const newSelected = new Set(selectedTaskIds);
        if (newSelected.has(taskId)) {
            newSelected.delete(taskId);
        } else {
            newSelected.add(taskId);
        }
        setSelectedTaskIds(newSelected);
    };

    // 전체 선택/해제
    const handleSelectAll = () => {
        if (selectedTaskIds.size === notInputtedTasks.length) {
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(notInputtedTasks.map(task => task.taskId)));
        }
    };

    // 알림 전송
    const handleSendNotifications = async () => {
        if (selectedTaskIds.size === 0) {
            alert('알림을 전송할 과제를 선택해주세요.');
            return;
        }

        if (!window.confirm(`선택한 ${selectedTaskIds.size}개의 과제에 대해 담당자에게 알림을 전송하시겠습니까?`)) {
            return;
        }

        try {
            setSending(true);
            const response = await sendNotifications({
                gubun: selectedGubun,
                taskIds: Array.from(selectedTaskIds)
            });
            if (response.success) {
                alert(`${response.count}개의 알림이 전송되었습니다.`);
                setSelectedTaskIds(new Set()); // 선택 초기화
                loadNotInputtedTasks(); // 미입력 과제 목록 새로고침
                loadNotifications(currentPage); // 알림 목록 새로고침
            } else {
                alert(`알림 전송 실패: ${response.message}`);
            }
        } catch (error) {
            console.error('알림 전송 실패:', error);
            const errorMessage = error.response?.data?.message || error.message || '알림 전송 중 오류가 발생했습니다.';
            alert(`알림 전송 실패: ${errorMessage}`);
        } finally {
            setSending(false);
        }
    };

    // 구분 변경 시 미입력 과제 목록 다시 로드
    useEffect(() => {
        if (isAdmin) {
            loadNotInputtedTasks();
        }
    }, [selectedGubun, isAdmin]);

    // 컴포넌트 마운트 시 알림 목록 로드
    useEffect(() => {
        if (isAdmin) {
            loadNotifications(0);
        }
    }, [isAdmin]);

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="notification-dashboard">
            <div className="dashboard-header">
                <div className="header-content">
                    <div className="header-title">
                        <Bell size={24} />
                        <h1>알림 관리 대시보드</h1>
                    </div>
                    <p className="header-subtitle">이번 달 미입력된 과제를 선택하여 담당자에게 알림을 전송할 수 있습니다.</p>
                </div>
            </div>

            {/* 알림 전송 섹션 */}
            <div className="send-section">
                <div className="send-card">
                    <div className="send-card-header">
                        <div className="send-card-title">
                            <Bell size={22} />
                            <h2>알림 전송</h2>
                        </div>
                        <div className="send-card-badge">
                            {notInputtedTasks.length}개 과제
                        </div>
                    </div>
                    <div className="send-form">
                        <div className="form-group-modern">
                            <label className="form-label-modern">알림 유형 선택</label>
                            <div className="radio-group-modern">
                                <label className={`radio-label-modern ${selectedGubun === 'OI' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="gubun"
                                        value="OI"
                                        checked={selectedGubun === 'OI'}
                                        onChange={(e) => setSelectedGubun(e.target.value)}
                                    />
                                    <div className="radio-content">
                                        <span className="radio-title">OI 과제</span>
                                        <span className="radio-subtitle">Operational Innovation</span>
                                    </div>
                                </label>
                                <label className={`radio-label-modern ${selectedGubun === '중점추진' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="gubun"
                                        value="중점추진"
                                        checked={selectedGubun === '중점추진'}
                                        onChange={(e) => setSelectedGubun(e.target.value)}
                                    />
                                    <div className="radio-content">
                                        <span className="radio-title">중점추진과제</span>
                                        <span className="radio-subtitle">Key Tasks</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div className="tasks-selection-modern">
                            <div className="tasks-header-modern">
                                <div className="tasks-header-left">
                                    <h3>미입력 과제 목록</h3>
                                    <span className="tasks-count">{selectedTaskIds.size}개 선택됨</span>
                                </div>
                                <div className="tasks-actions-modern">
                                    <button
                                        className="action-btn-modern"
                                        onClick={handleSelectAll}
                                        disabled={tasksLoading || notInputtedTasks.length === 0}
                                    >
                                        {selectedTaskIds.size === notInputtedTasks.length && notInputtedTasks.length > 0 ? (
                                            <>
                                                <CheckSquare size={16} />
                                                <span>전체 해제</span>
                                            </>
                                        ) : (
                                            <>
                                                <Square size={16} />
                                                <span>전체 선택</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        className="action-btn-modern icon-only"
                                        onClick={loadNotInputtedTasks}
                                        disabled={tasksLoading}
                                        title="새로고침"
                                    >
                                        <RefreshCw size={16} className={tasksLoading ? 'spinning' : ''} />
                                    </button>
                                </div>
                            </div>
                            {tasksLoading ? (
                                <div className="tasks-list-modern">
                                    <ListItemSkeleton count={5} />
                                </div>
                            ) : notInputtedTasks.length === 0 ? (
                                <div className="empty-state-modern">
                                    <Bell size={32} />
                                    <p>미입력된 과제가 없습니다.</p>
                                </div>
                            ) : (
                                <div className="tasks-list-modern">
                                    {notInputtedTasks.map((task) => (
                                        <div
                                            key={task.taskId}
                                            className={`task-item-modern ${selectedTaskIds.has(task.taskId) ? 'selected' : ''}`}
                                            onClick={() => handleTaskToggle(task.taskId)}
                                        >
                                            <div className="task-checkbox-modern">
                                                {selectedTaskIds.has(task.taskId) ? (
                                                    <CheckSquare size={20} />
                                                ) : (
                                                    <Square size={20} />
                                                )}
                                            </div>
                                            <div className="task-info-modern">
                                                <div className="task-name-modern">{task.taskName}</div>
                                                <div className="task-details-modern">
                                                    <span className="task-managers-modern">
                                                        {task.managers?.map(m => m.mbName).join(', ') || '담당자 없음'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="send-btn-container">
                            <button
                                className="send-btn-modern"
                                onClick={handleSendNotifications}
                                disabled={sending || selectedTaskIds.size === 0}
                            >
                                {sending ? (
                                    <>
                                        <RefreshCw size={20} className="spinning" />
                                        <span>전송 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={20} />
                                        <span>알림 전송하기</span>
                                        {selectedTaskIds.size > 0 && (
                                            <span className="send-count">{selectedTaskIds.size}</span>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 알림 목록 섹션 */}
            <div className="notifications-section">
                <div className="notification-section-header">
                    <h2>알림 내역 ({totalElements}개)</h2>
                    <button className="refresh-btn" onClick={() => loadNotifications(currentPage)} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                        <span>새로고침</span>
                    </button>
                </div>

                {loading ? (
                    <TableSkeleton rows={10} columns={7} />
                ) : notifications.length === 0 ? (
                    <div className="notification-empty-state">
                        <Bell size={48} />
                        <p>알림 내역이 없습니다.</p>
                    </div>
                ) : (
                    <>
                        <div className="notifications-table-container">
                            <table className="notifications-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>담당자 이름</th>
                                        <th>구분</th>
                                        <th>과제명</th>
                                        <th>전송 여부</th>
                                        <th>읽음 여부</th>
                                        <th>전송일시</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notifications.map((notification) => (
                                        <tr key={notification.id}>
                                            <td>{notification.id}</td>
                                            <td>{notification.managerName || notification.skid}</td>
                                            <td>
                                                <span className={`gubun-badge ${notification.gubun === 'OI' ? 'oi' : 'key'}`}>
                                                    {notification.gubun}
                                                </span>
                                            </td>
                                            <td className="project-name">{notification.projectNm}</td>
                                            <td>
                                                {notification.sendYn === 'Y' ? (
                                                    <span className="notification-status-badge sent">
                                                        <CheckCircle size={14} />
                                                        <span>전송완료</span>
                                                    </span>
                                                ) : (
                                                    <span className="notification-status-badge waiting">
                                                        <Clock size={14} />
                                                        <span>전송대기</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {notification.readYn === 'Y' ? (
                                                    <span className="notification-status-badge read">
                                                        <CheckCircle size={14} />
                                                        <span>읽음</span>
                                                    </span>
                                                ) : (
                                                    <span className="notification-status-badge unread">
                                                        <XCircle size={14} />
                                                        <span>미읽음</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td>{formatDate(notification.createAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 페이징 */}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="page-btn"
                                    onClick={() => loadNotifications(currentPage - 1)}
                                    disabled={currentPage === 0}
                                >
                                    <ChevronLeft size={18} />
                                    <span>이전</span>
                                </button>
                                <div className="page-info">
                                    <span>{currentPage + 1} / {totalPages}</span>
                                    <span className="page-total">(총 {totalElements}개)</span>
                                </div>
                                <button
                                    className="page-btn"
                                    onClick={() => loadNotifications(currentPage + 1)}
                                    disabled={currentPage >= totalPages - 1}
                                >
                                    <span>다음</span>
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default NotificationDashboard;
