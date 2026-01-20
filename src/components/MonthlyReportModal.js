import React, { useRef } from 'react';
import { X, FileText, Download, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './MonthlyReportModal.css';

function MonthlyReportModal({ isOpen, onClose, report, loading, onRegenerate }) {
    const reportContentRef = useRef(null);

    const handleDownloadPDF = async () => {
        if (!reportContentRef.current || !report) return;

        try {
            // 로딩 표시를 위한 임시 메시지 (선택사항)
            const loadingElement = document.createElement('div');
            loadingElement.style.position = 'fixed';
            loadingElement.style.top = '50%';
            loadingElement.style.left = '50%';
            loadingElement.style.transform = 'translate(-50%, -50%)';
            loadingElement.style.background = 'rgba(0, 0, 0, 0.8)';
            loadingElement.style.color = 'white';
            loadingElement.style.padding = '20px';
            loadingElement.style.borderRadius = '8px';
            loadingElement.style.zIndex = '10000';
            loadingElement.textContent = 'PDF 생성 중...';
            document.body.appendChild(loadingElement);

            // 현재 날짜 가져오기
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const date = String(now.getDate()).padStart(2, '0');
            const fileName = `월간보고서_${year}${month}${date}.pdf`;

            // HTML을 캔버스로 변환
            const canvas = await html2canvas(reportContentRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            // 캔버스를 이미지로 변환
            const imgData = canvas.toDataURL('image/png');

            // PDF 생성
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgScaledWidth = imgWidth * ratio;
            const imgScaledHeight = imgHeight * ratio;

            // 이미지가 한 페이지를 넘어가는 경우 여러 페이지로 나누기
            let heightLeft = imgScaledHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgScaledWidth, imgScaledHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgScaledHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgScaledWidth, imgScaledHeight);
                heightLeft -= pdfHeight;
            }

            // PDF 다운로드
            pdf.save(fileName);

            // 로딩 메시지 제거
            document.body.removeChild(loadingElement);
        } catch (error) {
            console.error('PDF 생성 실패:', error);
            alert('PDF 생성 중 오류가 발생했습니다.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="monthly-report-modal-overlay" onClick={onClose}>
            <div className="monthly-report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="monthly-report-header">
                    <div className="monthly-report-header-left">
                        <FileText size={20} />
                        <h2>월간 보고서</h2>
                    </div>
                    <button className="monthly-report-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="monthly-report-content">
                    {loading ? (
                        <div className="monthly-report-loading">
                            <div className="loading-spinner"></div>
                            <p>월간 보고서를 생성하는 중입니다...</p>
                        </div>
                    ) : report ? (
                        <div className="monthly-report-text" ref={reportContentRef}>
                            <ReactMarkdown>{report}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="monthly-report-empty">
                            <p>보고서가 생성되지 않았습니다.</p>
                        </div>
                    )}
                </div>

                <div className="monthly-report-actions">
                    {report && !loading && onRegenerate && (
                        <button className="monthly-report-btn-regenerate" onClick={onRegenerate}>
                            <RefreshCw size={16} />
                            다시 생성
                        </button>
                    )}
                    {report && !loading && (
                        <button className="monthly-report-btn-download" onClick={handleDownloadPDF}>
                            <Download size={16} />
                            PDF 다운로드
                        </button>
                    )}
                    <button className="monthly-report-btn-close" onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default MonthlyReportModal;
