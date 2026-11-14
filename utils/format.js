function pad(value) {
    return value < 10 ? '0' + value : String(value);
}

function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return '';
    return Number(match[2]) + '月' + Number(match[3]) + '日';
}

function formatFullDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return '';
    return match[1] + '年' + Number(match[2]) + '月' + Number(match[3]) + '日';
}

function weekday(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[date.getDay()] || '';
}

function formatDateTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value || ''));
    if (!match) return '';
    return match[1] + '-' + match[2] + '-' + match[3] + ' ' + match[4] + ':' + match[5];
}

function splitLines(value) {
    return String(value || '')
        .split('|')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

module.exports = { pad, formatDate, formatFullDate, weekday, formatDateTime, splitLines };
