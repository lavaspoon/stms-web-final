/**
 * 날짜를 yyyy-MM-dd 형식으로 포맷팅
 * @param {string|Date} dateString - 포맷팅할 날짜 문자열 또는 Date 객체
 * @returns {string} yyyy-MM-dd 형식의 날짜 문자열
 */
export const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }

        const options = {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        
        return new Intl.DateTimeFormat('en-CA', options).format(date);
    } catch (error) {
        return '';
    }
};
