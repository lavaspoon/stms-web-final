import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Target, TrendingUp, ChevronRight, ChevronDown } from 'lucide-react';
import { getAllDepts, getDeptMembers } from '../api/deptApi';
import { createTask, updateTask } from '../api/taskApi';
import './TaskRegisterModal.css';

function TaskRegisterModal({ isOpen, onClose, taskType, editData = null }) {
    const [formData, setFormData] = useState({
        category1: '',
        category2: '',
        taskName: '',
        description: '',
        startDate: '',
        endDate: '',
        department: '',
        managers: [], // 배열로 변경
        performanceType: 'nonFinancial',
        evaluationType: 'quantitative',
        metric: 'count',
        status: 'inProgress',
    });

    const [departments, setDepartments] = useState([]);
    const [availableManagers, setAvailableManagers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [expandedDepts, setExpandedDepts] = useState(new Set());

    // 부서 목록 조회 및 폼 초기화/설정
    useEffect(() => {
        if (isOpen) {
            loadDepartments();

            // 수정 모드일 때 데이터 설정
            if (editData) {
                console.log('수정 모드 - editData:', editData);

                setFormData({
                    category1: editData.category1 || '',
                    category2: editData.category2 || '',
                    taskName: editData.name || '',
                    description: editData.description || '',
                    startDate: editData.startDate || '',
                    endDate: editData.endDate || '',
                    department: editData.deptId ? String(editData.deptId) : '',
                    managers: editData.managers || [],
                    performanceType: editData.performance?.type || 'nonFinancial',
                    evaluationType: editData.performance?.evaluation || 'quantitative',
                    metric: editData.performance?.metric || 'count',
                    status: editData.status || 'inProgress',
                });

                // 해당 부서의 담당자 목록 로드
                if (editData.deptId) {
                    loadManagers(editData.deptId);
                }
            }
        } else {
            // 모달이 닫힐 때 폼 초기화
            setFormData({
                category1: '',
                category2: '',
                taskName: '',
                description: '',
                startDate: '',
                endDate: '',
                department: '',
                managers: [],
                performanceType: 'nonFinancial',
                evaluationType: 'quantitative',
                metric: 'count',
            });
            setAvailableManagers([]);
            setExpandedDepts(new Set());
        }
    }, [isOpen, editData]);

    const loadDepartments = async () => {
        try {
            const data = await getAllDepts();
            setDepartments(data);
            // 최상위 부서는 기본으로 펼침
            const topLevelDepts = data.filter(d => !d.parentDeptId).map(d => d.id);
            setExpandedDepts(new Set(topLevelDepts));
        } catch (error) {
            console.error('부서 목록 조회 실패:', error);
        }
    };

    // 부서 선택 시 담당자 목록 조회
    const loadManagers = async (deptId) => {
        if (!deptId) {
            setAvailableManagers([]);
            return;
        }

        try {
            setLoading(true);
            const data = await getDeptMembers(deptId);
            setAvailableManagers(data);
        } catch (error) {
            console.error('담당자 목록 조회 실패:', error);
            setAvailableManagers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // 부서 선택 시 담당자 목록 로드
        if (name === 'department') {
            loadManagers(value);
        }
    };

    const handleDeptSelect = (deptId) => {
        setFormData(prev => ({
            ...prev,
            department: deptId
        }));
        loadManagers(deptId);
    };

    const toggleDeptExpand = (deptId) => {
        setExpandedDepts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(deptId)) {
                newSet.delete(deptId);
            } else {
                newSet.add(deptId);
            }
            return newSet;
        });
    };

    // 부서 트리 구조 생성
    const buildDeptTree = (parentId = null) => {
        return departments
            .filter(dept => dept.parentDeptId === parentId)
            .map(dept => ({
                ...dept,
                children: buildDeptTree(dept.id)
            }));
    };

    const renderDeptTree = (deptTree, level = 0) => {
        return deptTree.map(dept => {
            const hasChildren = dept.children && dept.children.length > 0;
            const isExpanded = expandedDepts.has(dept.id);
            const isSelected = formData.department === dept.id;

            return (
                <div key={dept.id} className="dept-tree-item">
                    <div
                        className={`dept-tree-node ${isSelected ? 'selected' : ''}`}
                        style={{ paddingLeft: `${level * 20}px` }}
                    >
                        {hasChildren ? (
                            <button
                                type="button"
                                className="dept-toggle-btn"
                                onClick={() => toggleDeptExpand(dept.id)}
                            >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        ) : (
                            <span className="dept-spacer"></span>
                        )}
                        <div
                            className="dept-label"
                            onClick={() => handleDeptSelect(dept.id)}
                        >
                            <span className="dept-name">{dept.deptName}</span>
                        </div>
                    </div>
                    {hasChildren && isExpanded && (
                        <div className="dept-tree-children">
                            {renderDeptTree(dept.children, level + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    const handleManagerToggle = (manager) => {
        setFormData(prev => {
            const isSelected = prev.managers.some(m => m.userId === manager.userId);
            if (isSelected) {
                return {
                    ...prev,
                    managers: prev.managers.filter(m => m.userId !== manager.userId)
                };
            } else {
                return {
                    ...prev,
                    managers: [...prev.managers, manager]
                };
            }
        });
    };

    const handleRemoveManager = (userId) => {
        setFormData(prev => ({
            ...prev,
            managers: prev.managers.filter(m => m.userId !== userId)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 유효성 검사
        if (formData.managers.length === 0) {
            alert('담당자를 최소 1명 이상 선택해주세요.');
            return;
        }

        if (!formData.department) {
            alert('부서를 선택해주세요.');
            return;
        }

        if (!formData.taskName || !formData.category1 || !formData.category2) {
            alert('필수 항목을 모두 입력해주세요.');
            return;
        }

        if (!formData.startDate || !formData.endDate) {
            alert('과제 기간을 입력해주세요.');
            return;
        }

        try {
            setSubmitting(true);

            // 백엔드 API 형식에 맞게 데이터 변환
            const taskData = {
                category1: formData.category1,
                category2: formData.category2,
                taskName: formData.taskName,
                description: formData.description || null,
                startDate: formData.startDate,
                endDate: formData.endDate,
                deptId: parseInt(formData.department),
                managerIds: formData.managers.map(m => m.userId),
                performanceType: formData.performanceType,
                evaluationType: formData.evaluationType,
                metric: formData.metric,
                status: formData.status
            };

            if (editData) {
                // 수정 모드
                console.log('수정 요청 - taskId:', editData.id);
                console.log('수정 요청 - taskData:', taskData);
                const result = await updateTask(editData.id, taskData);
                console.log('수정 응답:', result);
                alert('과제가 성공적으로 수정되었습니다.');
            } else {
                // 등록 모드
                taskData.taskType = taskType === 'OI' ? 'OI' : '중점추진';
                console.log('등록 요청 - taskData:', taskData);
                const result = await createTask(taskData);
                console.log('등록 응답:', result);
                alert('과제가 성공적으로 등록되었습니다.');
            }

            // 폼 초기화
            setFormData({
                category1: '',
                category2: '',
                taskName: '',
                description: '',
                startDate: '',
                endDate: '',
                department: '',
                managers: [],
                performanceType: 'nonFinancial',
                evaluationType: 'quantitative',
                metric: 'count',
                status: 'inProgress',
            });

            onClose();
        } catch (error) {
            console.error(editData ? '과제 수정 실패:' : '과제 등록 실패:', error);
            const errorMessage = error.response?.data?.message || error.message ||
                (editData ? '과제 수정 중 오류가 발생했습니다.' : '과제 등록 중 오류가 발생했습니다.');
            alert(`${editData ? '과제 수정' : '과제 등록'} 실패: ${errorMessage}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="task-register-modal-overlay" onClick={onClose}>
            <div className="task-register-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {editData
                            ? `${taskType === 'OI' ? 'OI 과제' : '중점추진과제'} 수정`
                            : `${taskType === 'OI' ? 'OI 과제' : '중점추진과제'} 등록`
                        }
                    </h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="task-form">
                    {/* 과제 기본정보 */}
                    <section className="form-section">
                        <div className="section-header">
                            <Target size={18} />
                            <h3>과제 정보</h3>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>대주제 <span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="category1"
                                    value={formData.category1}
                                    onChange={handleChange}
                                    placeholder="예: 디지털 혁신"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>중주제 <span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="category2"
                                    value={formData.category2}
                                    onChange={handleChange}
                                    placeholder="예: AI 기술"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>과제명 <span className="required">*</span></label>
                            <input
                                type="text"
                                name="taskName"
                                value={formData.taskName}
                                onChange={handleChange}
                                placeholder="과제명을 입력하세요"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>과제 설명</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="과제에 대한 간단한 설명을 입력하세요"
                                rows="2"
                            />
                        </div>
                    </section>

                    {/* 기간 */}
                    <section className="form-section">
                        <div className="section-header">
                            <Calendar size={18} />
                            <h3>과제 기간</h3>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>시작일 <span className="required">*</span></label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>종료일 <span className="required">*</span></label>
                                <input
                                    type="date"
                                    name="endDate"
                                    value={formData.endDate}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                    </section>

                    {/* 담당자 */}
                    <section className="form-section">
                        <div className="section-header">
                            <User size={18} />
                            <h3>담당자 지정</h3>
                        </div>

                        <div className="form-group">
                            <label>부서 <span className="required">*</span></label>
                            <div className="dept-tree-container">
                                {departments.length > 0 ? (
                                    renderDeptTree(buildDeptTree())
                                ) : (
                                    <div className="empty-state-text">부서 정보를 불러오는 중...</div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>
                                담당자 <span className="required">*</span>
                                <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>
                                    (여러 명 선택 가능)
                                </span>
                            </label>

                            {formData.department ? (
                                <>
                                    {loading ? (
                                        <div className="empty-state-text">로딩 중...</div>
                                    ) : availableManagers.length > 0 ? (
                                        <>
                                            <div className="manager-select-container">
                                                {availableManagers.map(manager => (
                                                    <div key={manager.userId} className="manager-checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            id={`manager-${manager.userId}`}
                                                            checked={formData.managers.some(m => m.userId === manager.userId)}
                                                            onChange={() => handleManagerToggle(manager)}
                                                        />
                                                        <label htmlFor={`manager-${manager.userId}`}>
                                                            <div className="manager-info">
                                                                <span>{manager.mbName}</span>
                                                                <span className="manager-position">{manager.mbPositionName}</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>

                                            {formData.managers.length > 0 && (
                                                <div className="selected-managers">
                                                    {formData.managers.map(manager => (
                                                        <span key={manager.userId} className="manager-tag">
                                                            {manager.mbName}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveManager(manager.userId)}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="empty-state-text">해당 부서에 담당자가 없습니다</div>
                                    )}
                                </>
                            ) : (
                                <div className="empty-state-text">부서를 먼저 선택해주세요</div>
                            )}
                        </div>
                    </section>

                    {/* 성과 기준 */}
                    <section className="form-section">
                        <div className="section-header">
                            <TrendingUp size={18} />
                            <h3>성과 기준</h3>
                        </div>

                        <div className="form-group">
                            <label>성과 분류 <span className="required">*</span></label>
                            <div className="radio-group">
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="performanceType"
                                        value="financial"
                                        checked={formData.performanceType === 'financial'}
                                        onChange={handleChange}
                                    />
                                    <span>재무</span>
                                </label>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="performanceType"
                                        value="nonFinancial"
                                        checked={formData.performanceType === 'nonFinancial'}
                                        onChange={handleChange}
                                    />
                                    <span>비재무</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>평가 방법 <span className="required">*</span></label>
                            <div className="radio-group">
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="evaluationType"
                                        value="quantitative"
                                        checked={formData.evaluationType === 'quantitative'}
                                        onChange={handleChange}
                                    />
                                    <span>정량</span>
                                </label>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="evaluationType"
                                        value="qualitative"
                                        checked={formData.evaluationType === 'qualitative'}
                                        onChange={handleChange}
                                    />
                                    <span>정성</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>성과 지표 <span className="required">*</span></label>
                            <div className="radio-group">
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="metric"
                                        value="count"
                                        checked={formData.metric === 'count'}
                                        onChange={handleChange}
                                    />
                                    <span>건수</span>
                                </label>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="metric"
                                        value="amount"
                                        checked={formData.metric === 'amount'}
                                        onChange={handleChange}
                                    />
                                    <span>금액</span>
                                </label>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="metric"
                                        value="percent"
                                        checked={formData.metric === 'percent'}
                                        onChange={handleChange}
                                    />
                                    <span>%</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* 진행상태 */}
                    {editData && (
                        <section className="form-section">
                            <div className="section-header">
                                <Target size={18} />
                                <h3>진행상태</h3>
                            </div>

                            <div className="form-group">
                                <label>진행상태</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className={`status-select status-${formData.status}`}
                                >
                                    <option value="inProgress">진행중</option>
                                    <option value="completed">완료</option>
                                    <option value="delayed">지연</option>
                                    <option value="stopped">중단</option>
                                </select>
                            </div>
                        </section>
                    )}

                    {/* 버튼 */}
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>
                            취소
                        </button>
                        <button type="submit" className="btn-submit" disabled={submitting}>
                            {submitting
                                ? (editData ? '수정 중...' : '등록 중...')
                                : (editData ? '수정하기' : '등록하기')
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default TaskRegisterModal;
