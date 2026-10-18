export function formatDueDate(dateStr?: string | null): { text: string; isOverdue: boolean; isToday: boolean } {
  if (!dateStr) return { text: '', isOverdue: false, isToday: false };

  try {
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `逾期 ${Math.abs(diffDays)} 天`, isOverdue: true, isToday: false };
    } else if (diffDays === 0) {
      return { text: '今天截止', isOverdue: false, isToday: true };
    } else if (diffDays === 1) {
      return { text: '明天截止', isOverdue: false, isToday: false };
    } else if (diffDays === 2) {
      return { text: '后天', isOverdue: false, isToday: false };
    } else if (diffDays <= 7) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return { text: `本${weekdays[due.getDay()]}`, isOverdue: false, isToday: false };
    } else {
      const month = due.getMonth() + 1;
      const day = due.getDate();
      return { text: `${month}月${day}日`, isOverdue: false, isToday: false };
    }
  } catch {
    return { text: dateStr, isOverdue: false, isToday: false };
  }
}
