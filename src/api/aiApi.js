import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/ai';
const LM_STUDIO_API_URL = 'http://localhost:1234/v1/chat/completions';

/**
 * LM Studio API 호출 헬퍼 함수
 * @param {String} prompt - 프롬프트
 * @param {Boolean} stream - 스트리밍 여부
 * @returns {Promise<String>} AI 응답
 */
const callAI = async (prompt, stream = false) => {
    try {
        const response = await fetch(LM_STUDIO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'a.x-4.0-light', // LM Studio에서 로드한 모델명
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: -1, // 무제한
                stream: stream
            })
        });

        if (!response.ok) {
            throw new Error(`LM Studio API 호출 실패: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // OpenAI 호환 응답 구조에서 content 추출
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        }

        throw new Error('응답 형식이 올바르지 않습니다.');
    } catch (error) {
        console.error('LM Studio API 호출 중 오류:', error);
        throw error;
    }
};

/**
 * 맞춤법 검사
 * @param {String} text - 검사할 텍스트
 * @returns {Promise<String>} 맞춤법이 교정된 텍스트
 */
export const checkSpelling = async (text) => {
    try {
        // 서버에서 프롬프트 받기
        const promptResponse = await axios.post(`${API_BASE_URL}/spelling-check`, {
            text
        });
        const prompt = promptResponse.data.prompt;

        // 프롬프트 콘솔 출력
        console.log('=== 맞춤법 검사 프롬프트 ===');
        console.log(prompt);
        console.log('===========================');

        // LM Studio API 호출
        return await callAI(prompt);
    } catch (error) {
        console.error('맞춤법 검사 실패:', error);
        throw error;
    }
};

/**
 * 활동내역 추천
 * @param {String} taskName - 과제명
 * @param {String} previousActivities - 이전 활동내역들
 * @returns {Promise<String>} 추천된 활동내역
 */
export const recommendActivity = async (taskName, previousActivities) => {
    try {
        // 서버에서 프롬프트 받기
        const promptResponse = await axios.post(`${API_BASE_URL}/recommend-activity`, {
            taskName,
            previousActivities
        });
        const prompt = promptResponse.data.prompt;

        // 프롬프트 콘솔 출력
        console.log('=== 활동내역 추천 프롬프트 ===');
        console.log(prompt);
        console.log('==============================');

        // LM Studio API 호출
        return await callAI(prompt);
    } catch (error) {
        console.error('활동내역 추천 실패:', error);
        throw error;
    }
};

/**
 * 문맥 교정
 * @param {String} text - 교정할 텍스트
 * @returns {Promise<String>} 문맥이 교정된 텍스트
 */
export const improveContext = async (text) => {
    try {
        // 서버에서 프롬프트 받기
        const promptResponse = await axios.post(`${API_BASE_URL}/improve-context`, {
            text
        });
        const prompt = promptResponse.data.prompt;

        // 프롬프트 콘솔 출력
        console.log('=== 문맥 교정 프롬프트 ===');
        console.log(prompt);
        console.log('========================');

        // LM Studio API 호출
        return await callAI(prompt);
    } catch (error) {
        console.error('문맥 교정 실패:', error);
        throw error;
    }
};

/**
 * 전체 과제 브리핑 생성
 * @param {Array} tasks - 전체 과제 목록
 * @returns {Promise<Object>} 브리핑 결과 { summary, highlights, concerns, recommendations }
 */
export const generateBriefing = async (tasks) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/generate-briefing`, {
            tasks
        });
        return response.data;
    } catch (error) {
        console.error('브리핑 생성 실패:', error);
        throw error;
    }
};

/**
 * HTML 응답에서 HTML 코드 추출
 */
const extractHTMLFromResponse = (response) => {
    if (!response || !response.trim()) {
        console.warn("응답이 비어있습니다.");
        return "";
    }

    // 1. ```html 코드 블록에서 추출 (가장 정확)
    const htmlCodeBlockPattern = /```html\s*\n?(.*?)```/s;
    const htmlMatch = response.match(htmlCodeBlockPattern);
    if (htmlMatch && htmlMatch[1]) {
        const extracted = htmlMatch[1].trim();
        if (extracted.includes("<!DOCTYPE") || extracted.includes("<html")) {
            console.log("HTML 코드 블록에서 추출 성공");
            return extracted;
        }
    }

    // 2. ``` 코드 블록에서 HTML 추출
    const codeBlockPattern = /```\s*\n?(.*?)```/s;
    const codeMatches = [...response.matchAll(new RegExp(codeBlockPattern, 'gs'))];
    for (const match of codeMatches) {
        if (match[1] && (match[1].includes("<!DOCTYPE") || match[1].includes("<html"))) {
            console.log("코드 블록에서 HTML 추출 성공");
            return match[1].trim();
        }
    }

    // 3. <!DOCTYPE html> 또는 <html>로 시작하는 완전한 HTML 문서 추출
    const htmlDocumentPattern = /<!DOCTYPE\s+html[^>]*>.*?<\/html>/is;
    const htmlDocMatch = response.match(htmlDocumentPattern);
    if (htmlDocMatch) {
        console.log("HTML 문서 패턴으로 추출 성공");
        return htmlDocMatch[0].trim();
    }

    // 4. <html>로 시작하는 HTML 문서 추출
    const htmlTagPattern = /<html[^>]*>.*?<\/html>/is;
    const htmlTagMatch = response.match(htmlTagPattern);
    if (htmlTagMatch) {
        console.log("HTML 태그 패턴으로 추출 성공");
        return htmlTagMatch[0].trim();
    }

    // 5. <!DOCTYPE로 시작하는 부분부터 추출 (마지막 </html>까지)
    const doctypeStart = response.indexOf("<!DOCTYPE");
    if (doctypeStart >= 0) {
        const htmlEnd = response.lastIndexOf("</html>");
        if (htmlEnd > doctypeStart) {
            const extracted = response.substring(doctypeStart, htmlEnd + 7).trim();
            console.log("<!DOCTYPE부터 추출 성공");
            return extracted;
        }
    }

    // 6. <html>로 시작하는 부분부터 추출
    const htmlStart = response.indexOf("<html");
    if (htmlStart >= 0) {
        const htmlEnd = response.lastIndexOf("</html>");
        if (htmlEnd > htmlStart) {
            const extracted = response.substring(htmlStart, htmlEnd + 7).trim();
            console.log("<html>부터 추출 성공");
            return extracted;
        }
    }

    // 7. HTML이 포함되어 있는지 확인하고 그대로 반환 (마지막 시도)
    if (response.includes("<!DOCTYPE") || response.includes("<html")) {
        console.warn("HTML이 포함되어 있지만 완전한 구조를 찾을 수 없습니다. 원본을 반환합니다.");
        return response;
    }

    console.warn("HTML 문서를 추출할 수 없습니다. 응답:", response.substring(0, 200));
    return "";
};

/**
 * HTML에 CSS를 인라인으로 주입
 */
const injectInlineCSS = async (html) => {
    if (!html || !html.trim()) {
        return html;
    }

    try {
        // 서버의 정적 리소스에서 CSS 파일 로드
        const cssResponse = await fetch('http://localhost:8080/news-clip.css');
        if (!cssResponse.ok) {
            console.warn('CSS 파일을 로드할 수 없습니다. 원본 HTML을 반환합니다.');
            return html;
        }
        const cssContent = await cssResponse.text();

        // <link rel="stylesheet" href="/news-clip.css"> 태그를 찾아서 <style> 태그로 교체
        const linkPattern = /<link[^>]*rel=['"]stylesheet['"][^>]*href=['"][^'"]*news-clip\.css['"][^>]*>/i;
        const styleTag = `<style>\n${cssContent}\n</style>`;

        if (linkPattern.test(html)) {
            return html.replace(linkPattern, styleTag);
        } else {
            // <head> 태그 내부에 <style> 태그 추가
            const headPattern = /(<head[^>]*>)/i;
            if (headPattern.test(html)) {
                return html.replace(headPattern, `$1\n    ${styleTag}`);
            } else {
                // <head> 태그가 없으면 <html> 태그 다음에 추가
                const htmlPattern = /(<html[^>]*>)/i;
                if (htmlPattern.test(html)) {
                    return html.replace(htmlPattern, `$1\n<head>\n    ${styleTag}\n</head>`);
                }
            }
        }

        return html;
    } catch (error) {
        console.error('CSS 파일 읽기 실패', error);
        // CSS 파일을 읽지 못하면 원본 HTML 반환
        return html;
    }
};

/**
 * 월간 보고서 생성
 * @param {String} taskType - 과제 유형 ('OI' 또는 '중점추진')
 * @param {Array} tasks - 과제 목록 (각 과제는 { taskName, activityContent } 형태)
 * @param {String} format - 보고서 형식 ('html', 'markdown', null=markdown)
 * @returns {Promise<String>} 생성된 월간 보고서
 */
export const generateMonthlyReport = async (taskType, tasks, format = 'markdown') => {
    try {
        // 서버에서 프롬프트 받기
        const promptResponse = await axios.post(`${API_BASE_URL}/generate-monthly-report`, {
            taskType,
            tasks,
            format
        });
        const prompt = promptResponse.data.prompt;

        // 프롬프트 콘솔 출력
        console.log('=== 월간 보고서 프롬프트 ===');
        console.log(prompt);
        console.log('============================');

        // LM Studio API 호출
        let result = await callAI(prompt);

        // HTML 형식인 경우 특별 처리
        if (format === 'html') {
            const htmlContent = extractHTMLFromResponse(result);
            if (htmlContent && htmlContent.trim()) {
                result = await injectInlineCSS(htmlContent);
            } else {
                console.warn('HTML 추출 실패, 원본 응답을 반환합니다.');
                // HTML 추출 실패 시 원본 응답 반환
                result = result;
            }
        }

        return result;
    } catch (error) {
        console.error('월간 보고서 생성 실패:', error);
        throw error;
    }
};

/**
 * 종합 보고서 생성
 * @param {String} taskType - 과제 유형 ('OI' 또는 '중점추진')
 * @param {Array} tasks - 과제 목록 (각 과제는 { taskName, activities } 형태)
 * @param {String} format - 보고서 형식 ('html', 'markdown', null=markdown)
 * @returns {Promise<String>} 생성된 종합 보고서
 */
export const generateComprehensiveReport = async (taskType, tasks, format = 'markdown') => {
    try {
        // 서버에서 프롬프트 받기
        const promptResponse = await axios.post(`${API_BASE_URL}/generate-comprehensive-report`, {
            taskType,
            tasks,
            format
        });
        const prompt = promptResponse.data.prompt;

        // 프롬프트 콘솔 출력
        console.log('=== 종합 보고서 프롬프트 ===');
        console.log(prompt);
        console.log('============================');

        // LM Studio API 호출
        let result = await callAI(prompt);

        // HTML 형식인 경우 특별 처리
        if (format === 'html') {
            const htmlContent = extractHTMLFromResponse(result);
            if (htmlContent && htmlContent.trim()) {
                result = await injectInlineCSS(htmlContent);
            } else {
                console.warn('HTML 추출 실패, 원본 응답을 반환합니다.');
                // HTML 추출 실패 시 원본 응답 반환
                result = result;
            }
        }

        return result;
    } catch (error) {
        console.error('종합 보고서 생성 실패:', error);
        throw error;
    }
};

/**
 * 커스텀 보고서 생성 (질문 기반)
 * @param {String} taskType - 과제 유형 ('OI', '중점추진', 'KPI' 또는 null)
 * @param {Array} tasks - 과제 목록 (null 가능)
 * @param {String} reportType - 보고서 유형 ('monthly', 'comprehensive' 또는 null)
 * @param {String} existingReport - 기존 보고서 내용 (수정 모드일 때)
 * @param {String} modifyPrompt - 수정 요청 프롬프트 (수정 모드일 때)
 * @returns {Promise<String>} 생성된 커스텀 보고서
 */
export const generateCustomReport = async (taskType, tasks, reportType, existingReport, modifyPrompt) => {
    try {
        // 서버에서 프롬프트 받기
        const promptResponse = await axios.post(`${API_BASE_URL}/generate-custom-report`, {
            taskType: taskType || null,
            tasks: tasks || null,
            reportType: reportType || null,
            existingReport: existingReport || null,
            customQuestion: modifyPrompt || null
        });
        const prompt = promptResponse.data.prompt;

        // 프롬프트 콘솔 출력
        console.log('=== 커스텀 보고서 프롬프트 ===');
        console.log(prompt);
        console.log('==============================');

        // LM Studio API 호출
        return await callAI(prompt);
    } catch (error) {
        console.error('커스텀 보고서 생성 실패:', error);
        throw error;
    }
};