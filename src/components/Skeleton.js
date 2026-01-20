import React from 'react';
import './Skeleton.css';

// 기본 스켈레톤 컴포넌트
export function Skeleton({ width, height, borderRadius, className = '' }) {
    const style = {
        width: width || '100%',
        height: height || '1rem',
        borderRadius: borderRadius || '4px',
    };

    return <div className={`skeleton ${className}`} style={style} />;
}

// 테이블 행 스켈레톤
export function TableRowSkeleton({ columns = 7 }) {
    return (
        <tr className="skeleton-table-row">
            {Array.from({ length: columns }).map((_, idx) => (
                <td key={idx} className="skeleton-table-cell">
                    <Skeleton height="20px" borderRadius="4px" />
                </td>
            ))}
        </tr>
    );
}

// 테이블 스켈레톤 (헤더 포함)
export function TableSkeleton({ rows = 5, columns = 7, showHeader = true }) {
    return (
        <div className="skeleton-table-container">
            <table className="skeleton-table">
                {showHeader && (
                    <thead>
                        <tr>
                            {Array.from({ length: columns }).map((_, idx) => (
                                <th key={idx}>
                                    <Skeleton height="16px" width="80%" borderRadius="4px" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <TableRowSkeleton key={rowIdx} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// 카드 스켈레톤
export function CardSkeleton({ count = 1 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="skeleton-card">
                    <Skeleton height="24px" width="60%" borderRadius="4px" />
                    <Skeleton height="16px" width="100%" borderRadius="4px" />
                    <Skeleton height="16px" width="80%" borderRadius="4px" />
                    <Skeleton height="40px" width="100%" borderRadius="8px" style={{ marginTop: '12px' }} />
                </div>
            ))}
        </>
    );
}

// 리스트 아이템 스켈레톤
export function ListItemSkeleton({ count = 1 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="skeleton-list-item">
                    <Skeleton width="24px" height="24px" borderRadius="4px" />
                    <div className="skeleton-list-content">
                        <Skeleton height="18px" width="70%" borderRadius="4px" />
                        <Skeleton height="14px" width="50%" borderRadius="4px" />
                    </div>
                </div>
            ))}
        </>
    );
}

// 통계 박스 스켈레톤
export function StatBoxSkeleton({ count = 4 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="skeleton-stat-box">
                    <Skeleton width="48px" height="48px" borderRadius="8px" />
                    <div className="skeleton-stat-content">
                        <Skeleton height="14px" width="60px" borderRadius="4px" />
                        <Skeleton height="24px" width="40px" borderRadius="4px" />
                    </div>
                </div>
            ))}
        </>
    );
}

// 모달 콘텐츠 스켈레톤
export function ModalContentSkeleton() {
    return (
        <div className="skeleton-modal-content">
            <div className="skeleton-modal-header">
                <Skeleton height="28px" width="60%" borderRadius="4px" />
                <Skeleton height="20px" width="80px" borderRadius="4px" />
            </div>
            <div className="skeleton-modal-body">
                <Skeleton height="20px" width="100%" borderRadius="4px" />
                <Skeleton height="20px" width="90%" borderRadius="4px" />
                <Skeleton height="20px" width="95%" borderRadius="4px" />
                <Skeleton height="120px" width="100%" borderRadius="8px" style={{ marginTop: '16px' }} />
                <Skeleton height="200px" width="100%" borderRadius="8px" style={{ marginTop: '16px' }} />
            </div>
        </div>
    );
}
