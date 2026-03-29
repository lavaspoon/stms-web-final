/**
 * 과제 기간과 '이번 달 활동 입력 필요' 판별 (진행중 + 미입력 + 기간이 현재 달과 겹침)
 */

function parseDateOnlyLocal(dateString) {
    if (!dateString) return null;
    const s = String(dateString).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * 과제 시작~종료가 현재 달(로컬)과 하루라도 겹치는지
 */
export function taskPeriodOverlapsCurrentMonth(task, now = new Date()) {
    const y = now.getFullYear();
    const mo = now.getMonth();
    const monthStart = new Date(y, mo, 1);
    const monthEnd = new Date(y, mo + 1, 0, 23, 59, 59, 999);

    let taskStart = task.startDate ? parseDateOnlyLocal(task.startDate) : null;
    let taskEnd = task.endDate ? parseDateOnlyLocal(task.endDate) : null;

    if (!taskStart && !taskEnd) return true;

    if (!taskStart) taskStart = new Date(1970, 0, 1);
    if (!taskEnd) taskEnd = new Date(2100, 11, 31);

    if (taskEnd < taskStart) return false;

    const ts = new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate());
    const te = new Date(taskEnd.getFullYear(), taskEnd.getMonth(), taskEnd.getDate(), 23, 59, 59, 999);

    return te >= monthStart && ts <= monthEnd;
}

/**
 * @param {object} task
 * @param {(status: string) => string} normalizeStatus - 페이지의 normalizeStatus (영어 키 반환)
 */
export function needsMonthlyActivityInput(task, normalizeStatus) {
    const normalized = normalizeStatus(task.status);
    if (normalized !== 'inProgress') return false;
    if (task.isInputted) return false;
    return taskPeriodOverlapsCurrentMonth(task);
}
