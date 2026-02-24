import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Target, TrendingUp, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { getAllDepts, getDeptMembers, getAllMembers } from '../api/deptApi';
import { createTask, updateTask } from '../api/taskApi';
import './TaskRegisterModal.css';

function TaskRegisterModal({ isOpen, onClose, taskType, editData = null }) {
    const [formData, setFormData] = useState({
        category1: '',
        category2: '',
        taskName: '',
        description: '',
        targetDescription: '',
        startDate: '',
        endDate: '',
        department: '',
        managers: [], // 배열로 변경
        performanceType: 'nonFinancial',
        evaluationType: 'quantitative',
        metric: 'count',
        targetValue: '', // 목표값 (정량일 때만)
        status: 'inProgress',
        visibleYn: 'Y', // 공개여부 (기본값 Y)
        reverseYn: 'N', // 역계산 여부 (기본값 N)
    });

    const [departments, setDepartments] = useState([]);
    const [availableManagers, setAvailableManagers] = useState([]);
    const [allManagers, setAllManagers] = useState([]); // 모든 부서의 구성원 (검색용)
    const [managerSearchTerm, setManagerSearchTerm] = useState(''); // 구성원 검색어
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [expandedDepts, setExpandedDepts] = useState(new Set());

    // 부서 목록 조회
    useEffect(() => {
        if (isOpen) {
            loadDepartments();
        }
    }, [isOpen]);

    // 모든 부서의 구성원 조회 (검색용)
    useEffect(() => {
        if (isOpen && departments.length > 0) {
            loadAllManagers();
        }
    }, [isOpen, departments.length]);

    // allManagers가 로드된 후 수정 모드의 담당자 부서 정보 업데이트
    useEffect(() => {
        if (isOpen && editData && allManagers.length > 0 && formData.managers.length > 0) {
            // 담당자들의 부서 정보를 allManagers에서 찾아서 업데이트
            const updatedManagers = formData.managers.map(manager => {
                const foundInAll = allManagers.find(m => m.userId === manager.userId);
                if (foundInAll && foundInAll.deptName) {
                    return {
                        ...manager,
                        deptName: foundInAll.deptName,
                        deptId: foundInAll.deptId
                    };
                }
                return manager;
            });

            // 부서 정보가 업데이트된 경우에만 상태 업데이트
            const hasChanges = updatedManagers.some((m, idx) =>
                m.deptName !== formData.managers[idx]?.deptName
            );

            if (hasChanges) {
                setFormData(prev => ({
                    ...prev,
                    managers: updatedManagers
                }));
            }
        }
    }, [allManagers.length, isOpen, editData]);

    const loadAllManagers = async () => {
        try {
            // 모든 활성 구성원을 한 번에 조회 (단일 API 호출)
            const allMembers = await getAllMembers();

            // 부서 정보를 각 구성원에 추가 (deptIdx를 사용하여 부서 ID 매핑)
            const membersWithDept = allMembers.map(member => {
                // deptIdx를 deptId로 사용 (이미 부서 ID가 포함되어 있음)
                return {
                    ...member,
                    deptId: member.deptIdx,
                    deptName: member.deptName
                };
            });

            setAllManagers(membersWithDept);
        } catch (error) {
            console.error('전체 구성원 조회 실패:', error);
            setAllManagers([]);
        }
    };

    // 수정 모드일 때 폼 데이터 설정 (부서 목록이 로드된 후 실행)
    useEffect(() => {
        if (isOpen && editData && departments.length > 0) {
            console.log('수정 모드 - editData:', editData);

            // 날짜 형식 변환 (YYYY-MM-DD 형식으로 변환)
            const formatDate = (dateString) => {
                if (!dateString) return '';
                // 이미 YYYY-MM-DD 형식이면 그대로 반환
                if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return dateString;
                }
                // 다른 형식이면 변환 시도
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return '';
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // 목표값 변환 (숫자일 경우 문자열로 변환)
            const formatTargetValue = (value) => {
                if (value === null || value === undefined) return '';
                if (typeof value === 'number') return String(value);
                return String(value || '');
            };

            // 담당자가 있으면 첫 번째 담당자의 부서 이름으로 부서 ID 찾기
            let initialDeptId = '';
            if (editData.managers && editData.managers.length > 0) {
                const firstManager = editData.managers[0];
                const managerDeptName = firstManager.deptName || firstManager.topDeptName;

                if (managerDeptName) {
                    // 부서 목록에서 부서 이름으로 부서 ID 찾기
                    const foundDept = departments.find(dept =>
                        dept.deptName === managerDeptName ||
                        dept.deptName === firstManager.topDeptName
                    );
                    if (foundDept) {
                        initialDeptId = foundDept.id;
                    }
                }
            }

            setFormData(prev => ({
                ...prev,
                category1: editData.category1 || '',
                category2: editData.category2 || '',
                taskName: editData.name || editData.taskName || '',
                description: editData.description || '',
                targetDescription: editData.targetDescription || '',
                startDate: formatDate(editData.startDate),
                endDate: formatDate(editData.endDate),
                department: initialDeptId, // 첫 번째 담당자의 부서 ID 설정
                managers: editData.managers || [],
                performanceType: editData.performance?.type || editData.performanceType || 'nonFinancial',
                evaluationType: editData.performance?.evaluation || editData.evaluationType || 'quantitative',
                metric: editData.performance?.metric || editData.metric || 'count',
                targetValue: formatTargetValue(editData.targetValue || editData.target),
                status: editData.status || 'inProgress',
                visibleYn: editData.visibleYn || 'Y', // 공개여부
                reverseYn: editData.reverseYn || 'N', // 역계산 여부
            }));

            // 부서 ID가 있으면 해당 부서의 담당자 목록 로드
            if (initialDeptId) {
                loadManagers(initialDeptId);
            }
        } else if (isOpen && !editData) {
            // 등록 모드일 때 폼 초기화
            setFormData({
                category1: '',
                category2: '',
                taskName: '',
                description: '',
                targetDescription: '',
                startDate: '',
                endDate: '',
                department: '',
                managers: [],
                performanceType: 'nonFinancial',
                evaluationType: 'quantitative',
                metric: 'count',
                targetValue: '',
                status: 'inProgress',
                visibleYn: 'Y',
                reverseYn: 'N',
            });
            setAvailableManagers([]);
            setManagerSearchTerm('');
        } else if (!isOpen) {
            // 모달이 닫힐 때 폼 초기화
            setFormData({
                category1: '',
                category2: '',
                taskName: '',
                description: '',
                targetDescription: '',
                startDate: '',
                endDate: '',
                department: '',
                managers: [],
                performanceType: 'nonFinancial',
                evaluationType: 'quantitative',
                metric: 'count',
                targetValue: '',
                status: 'inProgress',
                visibleYn: 'Y',
                reverseYn: 'N',
            });
            setAvailableManagers([]);
            setManagerSearchTerm('');
            setExpandedDepts(new Set());
        }
    }, [isOpen, editData, departments]);

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

        // 부서가 선택되지 않았지만 담당자가 있으면 첫 번째 담당자의 부서를 자동 설정
        let departmentToUse = formData.department;
        if (!departmentToUse && formData.managers.length > 0) {
            const firstManager = formData.managers[0];
            if (firstManager.deptId) {
                departmentToUse = firstManager.deptId;
            }
        }

        if (!formData.taskName || !formData.category1 || !formData.category2) {
            alert('필수 항목을 모두 입력해주세요.');
            return;
        }

        if (!formData.startDate || !formData.endDate) {
            alert('과제 기간을 입력해주세요.');
            return;
        }

        // 정량일 때 목표값 필수 체크
        if (formData.evaluationType === 'quantitative' && !formData.targetValue) {
            alert('목표값을 입력해주세요.');
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
                targetDescription: formData.targetDescription || null,
                startDate: formData.startDate,
                endDate: formData.endDate,
                managerIds: formData.managers.map(m => m.userId),
                performanceType: formData.performanceType,
                evaluationType: formData.evaluationType,
                metric: formData.evaluationType === 'quantitative' ? formData.metric : null, // 정성일 때는 null
                targetValue: formData.evaluationType === 'quantitative' ? formData.targetValue : null, // 정량일 때만 목표값
                status: formData.status,
                visibleYn: formData.visibleYn || 'Y', // 공개여부
                reverseYn: formData.evaluationType === 'quantitative' ? (formData.reverseYn || 'N') : 'N', // 역계산 여부 (정량일 때만 적용)
                deptId: departmentToUse // 자동 설정된 부서 ID 사용
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
                // taskType이 전달된 그대로 사용 (OI, 중점추진, KPI)
                taskData.taskType = taskType || '중점추진';
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
                targetDescription: '',
                startDate: '',
                endDate: '',
                department: '',
                managers: [],
                performanceType: 'nonFinancial',
                evaluationType: 'quantitative',
                metric: 'count',
                targetValue: '',
                status: 'inProgress',
                visibleYn: 'Y',
                reverseYn: 'N',
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
        <div className="task-register-modal-overlay">
            <div className="task-register-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {editData
                            ? `${taskType === 'OI' ? 'OI 과제' : taskType === 'KPI' ? 'KPI 과제' : '중점추진과제'} 수정`
                            : `${taskType === 'OI' ? 'OI 과제' : taskType === 'KPI' ? 'KPI 과제' : '중점추진과제'} 등록`
                        }
                    </h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="task-form">
                    {/* 과제 기본정보 */}
                    <section className="form-section">
                        <div className="task-register-section-header">
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
                                style={{ minHeight: '50px' }}
                            />
                        </div>

                        <div className={`form-row ${editData ? 'compact-three-columns' : ''}`}>
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
                            {editData && (
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
                            )}
                        </div>
                    </section>

                    {/* 성과 기준 */}
                    <section className="form-section performance-criteria-section">
                        <div className="task-register-section-header">
                            <TrendingUp size={18} />
                            <h3>성과 기준</h3>
                        </div>

                        <div className="performance-criteria-compact">
                            <div className="form-group-compact">
                                <label>성과 분류 <span className="required">*</span></label>
                                <div className="radio-group-compact">
                                    <label className="radio-label-compact">
                                        <input
                                            type="radio"
                                            name="performanceType"
                                            value="financial"
                                            checked={formData.performanceType === 'financial'}
                                            onChange={handleChange}
                                        />
                                        <span>재무</span>
                                    </label>
                                    <label className="radio-label-compact">
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

                            <div className="form-group-compact">
                                <label>평가 방법 <span className="required">*</span></label>
                                <div className="radio-group-compact">
                                    <label className="radio-label-compact">
                                        <input
                                            type="radio"
                                            name="evaluationType"
                                            value="quantitative"
                                            checked={formData.evaluationType === 'quantitative'}
                                            onChange={handleChange}
                                        />
                                        <span>정량</span>
                                    </label>
                                    <label className="radio-label-compact">
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

                            {formData.evaluationType === 'quantitative' && (
                                <>
                                    <div className="form-group-compact">
                                        <label>성과 지표 <span className="required">*</span></label>
                                        <div className="radio-group-compact">
                                            <label className="radio-label-compact">
                                                <input
                                                    type="radio"
                                                    name="metric"
                                                    value="count"
                                                    checked={formData.metric === 'count'}
                                                    onChange={handleChange}
                                                />
                                                <span>건수</span>
                                            </label>
                                            <label className="radio-label-compact">
                                                <input
                                                    type="radio"
                                                    name="metric"
                                                    value="amount"
                                                    checked={formData.metric === 'amount'}
                                                    onChange={handleChange}
                                                />
                                                <span>금액</span>
                                            </label>
                                            <label className="radio-label-compact">
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
                                    <div className="target-value-description-row">
                                        <div className="form-group-compact">
                                            <label>목표값 <span className="required">*</span></label>
                                            <div className="target-input-row">
                                                <label className="reverse-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        name="reverseYn"
                                                        checked={formData.reverseYn === 'Y'}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            reverseYn: e.target.checked ? 'Y' : 'N'
                                                        }))}
                                                        className="reverse-checkbox"
                                                    />
                                                    <span className="reverse-checkbox-text">역계산</span>
                                                </label>
                                                <div className="target-input-wrapper">
                                                    <input
                                                        type="text"
                                                        name="targetValue"
                                                        value={formData.targetValue}
                                                        onChange={handleChange}
                                                        placeholder={formData.metric === 'count' ? '목표 건수를 입력하세요' : formData.metric === 'amount' ? '목표 금액을 입력하세요' : '목표 %를 입력하세요'}
                                                        required={formData.evaluationType === 'quantitative'}
                                                        className="target-input"
                                                    />
                                                    <span className="target-unit">
                                                        {formData.metric === 'count' ? '건' : formData.metric === 'amount' ? '원' : '%'}
                                                    </span>
                                                </div>
                                            </div>
                                            {formData.reverseYn === 'Y' && (
                                                <div className="reverse-hint">
                                                    ↓ 실적이 목표보다 낮을수록 달성률이 높아집니다
                                                </div>
                                            )}
                                        </div>
                                        <div className="form-group-compact">
                                            <label>목표 설명 (선택)</label>
                                            <input
                                                type="text"
                                                name="targetDescription"
                                                value={formData.targetDescription}
                                                onChange={handleChange}
                                                placeholder="목표 설명"
                                                className="target-description-input"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* 공개여부 */}
                    <section className="form-section performance-criteria-section">
                        <div className="task-register-section-header">
                            <Target size={18} />
                            <h3>공개 설정</h3>
                        </div>

                        <div className="form-group-compact">
                            <label>공개여부 <span className="required">*</span></label>
                            <div className="radio-group-compact">
                                <label className="radio-label-compact">
                                    <input
                                        type="radio"
                                        name="visibleYn"
                                        value="Y"
                                        checked={formData.visibleYn === 'Y'}
                                        onChange={handleChange}
                                    />
                                    <span>공개</span>
                                </label>
                                <label className="radio-label-compact">
                                    <input
                                        type="radio"
                                        name="visibleYn"
                                        value="N"
                                        checked={formData.visibleYn === 'N'}
                                        onChange={handleChange}
                                    />
                                    <span>비공개 (관리자와 담당자만 조회 가능)</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* 담당자 */}
                    <section className="form-section">
                        <div className="task-register-section-header">
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

                            {/* 구성원 검색 입력 */}
                            <div className="manager-search-box" style={{ marginBottom: '12px' }}>
                                <Search size={16} style={{ color: '#9ca3af' }} />
                                <input
                                    type="text"
                                    placeholder="구성원 이름으로 검색..."
                                    value={managerSearchTerm}
                                    onChange={(e) => setManagerSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px 8px 32px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {/* 선택된 담당자 목록 - 항상 표시 */}
                            {formData.managers.length > 0 && (
                                <div className="selected-managers" style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>
                                        선택된 담당자 ({formData.managers.length}명)
                                    </div>
                                    {formData.managers.map(manager => (
                                        <span key={manager.userId} className="manager-tag">
                                            {manager.mbName}
                                            {manager.deptName && (
                                                <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
                                                    ({manager.deptName})
                                                </span>
                                            )}
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

                            {managerSearchTerm ? (
                                // 검색어가 있으면 모든 부서의 구성원에서 검색
                                <>
                                    {(() => {
                                        const filteredManagers = allManagers.filter(manager => {
                                            const name = manager.mbName || '';
                                            const position = manager.mbPositionName || '';
                                            const deptName = manager.deptName || '';
                                            const searchLower = managerSearchTerm.toLowerCase();
                                            return name.toLowerCase().includes(searchLower) ||
                                                position.toLowerCase().includes(searchLower) ||
                                                deptName.toLowerCase().includes(searchLower);
                                        });

                                        return filteredManagers.length > 0 ? (
                                            <div className="manager-select-container">
                                                {filteredManagers.map(manager => (
                                                    <div key={manager.userId} className="manager-checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            id={`manager-search-${manager.userId}`}
                                                            checked={formData.managers.some(m => m.userId === manager.userId)}
                                                            onChange={() => handleManagerToggle(manager)}
                                                        />
                                                        <label htmlFor={`manager-search-${manager.userId}`}>
                                                            <div className="manager-info">
                                                                <span>{manager.mbName}</span>
                                                                <span className="manager-position">{manager.mbPositionName}</span>
                                                                <span className="manager-dept" style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                                                                    ({manager.deptName})
                                                                </span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="empty-state-text">검색 결과가 없습니다.</div>
                                        );
                                    })()}
                                </>
                            ) : formData.department ? (
                                // 검색어가 없으면 선택된 부서의 구성원만 표시
                                <>
                                    {loading ? (
                                        <div className="empty-state-text">로딩 중...</div>
                                    ) : availableManagers.length > 0 ? (
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
                                    ) : (
                                        <div className="empty-state-text">해당 부서에 담당자가 없습니다</div>
                                    )}
                                </>
                            ) : (
                                // 부서가 선택되지 않았을 때
                                <>
                                    {formData.managers.length > 0 ? (
                                        // 수정 모드이고 담당자가 있으면 안내 메시지 표시
                                        <div className="empty-state-text" style={{ color: '#6b7280', fontSize: '13px' }}>
                                            부서를 선택하면 해당 부서의 구성원을 추가할 수 있습니다.
                                        </div>
                                    ) : (
                                        <div className="empty-state-text">부서를 먼저 선택해주세요</div>
                                    )}
                                </>
                            )}
                        </div>
                    </section>

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
