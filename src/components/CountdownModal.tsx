import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Timer,
  Calendar,
  Pin,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  Sparkles,
  Clock,
  Flame,
  Layers,
  ChevronRight,
  Heart,
  TrendingUp,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { CountdownItem, CountdownCategory, CountdownMilestone } from '../types';
import {
  COUNTDOWN_CATEGORIES,
  getCategoryMeta,
  calculateCountdownStats,
} from '../utils/countdown';

interface CountdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  countdowns: CountdownItem[];
  onSaveCountdown: (item: CountdownItem) => void;
  onDeleteCountdown: (id: string) => void;
  onToggleMilestone: (countdownId: string, milestoneId: string) => void;
  onAddMilestone: (countdownId: string, milestoneTitle: string) => void;
  onTogglePin: (id: string) => void;
}

export const CountdownModal: React.FC<CountdownModalProps> = ({
  isOpen,
  onClose,
  countdowns,
  onSaveCountdown,
  onDeleteCountdown,
  onToggleMilestone,
  onAddMilestone,
  onTogglePin,
}) => {
  // Filter states
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'passed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CountdownCategory | 'all'>('all');

  // Edit / Create Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CountdownItem | null>(null);

  // Form input states
  const [formTitle, setFormTitle] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formCategory, setFormCategory] = useState<CountdownCategory>('life');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [formMilestones, setFormMilestones] = useState<CountdownMilestone[]>([]);
  const [newMilestoneInput, setNewMilestoneInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Quick add milestone inline in card
  const [inlineMilestoneInput, setInlineMilestoneInput] = useState<{ [id: string]: string }>({});
  const [showInlineInput, setShowInlineInput] = useState<{ [id: string]: boolean }>({});

  // Open Form for Creating New Item
  const handleOpenCreate = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultTarget = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    setEditingItem(null);
    setFormTitle('');
    setFormTargetDate(defaultTarget);
    setFormStartDate(todayStr);
    setFormCategory('life');
    setFormIsPinned(false);
    setFormNotes('');
    setFormMilestones([]);
    setNewMilestoneInput('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Form for Editing Existing Item
  const handleOpenEdit = (item: CountdownItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormTargetDate(item.targetDate);
    setFormStartDate(item.startDate || new Date(item.createdAt).toISOString().split('T')[0]);
    setFormCategory(item.category);
    setFormIsPinned(Boolean(item.isPinned));
    setFormNotes(item.notes || '');
    setFormMilestones(item.milestones ? [...item.milestones] : []);
    setNewMilestoneInput('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Save Form handler
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('请输入目标或纪念日名称');
      return;
    }
    if (!formTargetDate) {
      setFormError('请选择目标日期');
      return;
    }

    const now = Date.now();
    const itemToSave: CountdownItem = {
      id: editingItem ? editingItem.id : `cd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: formTitle.trim(),
      targetDate: formTargetDate,
      startDate: formStartDate || null,
      category: formCategory,
      isPinned: formIsPinned,
      notes: formNotes.trim(),
      milestones: formMilestones,
      createdAt: editingItem ? editingItem.createdAt : now,
      updatedAt: now,
    };

    onSaveCountdown(itemToSave);
    setIsFormOpen(false);
  };

  // Add milestone to form state
  const handleAddMilestoneToForm = () => {
    if (!newMilestoneInput.trim()) return;
    setFormMilestones(prev => [
      ...prev,
      {
        id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        title: newMilestoneInput.trim(),
        completed: false,
      },
    ]);
    setNewMilestoneInput('');
  };

  const handleRemoveMilestoneFromForm = (id: string) => {
    setFormMilestones(prev => prev.filter(m => m.id !== id));
  };

  // Inline milestone submission from card
  const handleInlineMilestoneSubmit = (countdownId: string) => {
    const text = (inlineMilestoneInput[countdownId] || '').trim();
    if (!text) return;
    onAddMilestone(countdownId, text);
    setInlineMilestoneInput(prev => ({ ...prev, [countdownId]: '' }));
    setShowInlineInput(prev => ({ ...prev, [countdownId]: false }));
  };

  // Filter and sort items
  const filteredCountdowns = useMemo(() => {
    return countdowns.filter(item => {
      const stats = calculateCountdownStats(item);
      if (activeTab === 'upcoming' && stats.status === 'passed') return false;
      if (activeTab === 'passed' && stats.status !== 'passed') return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      return true;
    }).sort((a, b) => {
      // Pinned items first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      const statsA = calculateCountdownStats(a);
      const statsB = calculateCountdownStats(b);

      // Upcoming: nearest first
      if (statsA.status !== 'passed' && statsB.status !== 'passed') {
        return statsA.daysDiff - statsB.daysDiff;
      }
      // Passed: most recent first
      if (statsA.status === 'passed' && statsB.status === 'passed') {
        return Math.abs(statsA.daysDiff) - Math.abs(statsB.daysDiff);
      }
      return statsA.status === 'passed' ? 1 : -1;
    });
  }, [countdowns, activeTab, selectedCategory]);

  // Pinned or top hero item
  const heroItem = useMemo(() => {
    const pinned = countdowns.find(c => c.isPinned);
    if (pinned) return pinned;
    // Otherwise return nearest upcoming
    const upcoming = countdowns
      .filter(c => calculateCountdownStats(c).status !== 'passed')
      .sort((a, b) => calculateCountdownStats(a).daysDiff - calculateCountdownStats(b).daysDiff);
    return upcoming[0] || countdowns[0] || null;
  }, [countdowns]);

  const heroStats = heroItem ? calculateCountdownStats(heroItem) : null;
  const heroCategoryMeta = heroItem ? getCategoryMeta(heroItem.category) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Top Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-sm shadow-amber-500/20">
              <Timer className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  倒数日 & 目标进度看板
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                  {countdowns.length} 个目标
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                追踪关键节点倒数天数、时光流逝与阶段目标完成度
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenCreate}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新建倒数日</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Hero Feature Billboard (Pinned or Nearest Upcoming) */}
          {heroItem && heroStats && heroCategoryMeta && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-xl border border-indigo-700/40">
              {/* Background ambient glow circles */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Info & Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2.5 mb-1.5">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-amber-300 border border-white/10">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{heroItem.isPinned ? '📌 置顶关注' : '⏳ 最近倒数'}</span>
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                      {heroCategoryMeta.label}
                    </span>
                    <span className="text-xs text-indigo-200/80 flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>目标日：{heroItem.targetDate}</span>
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm truncate">
                    {heroItem.title}
                  </h3>

                  {heroItem.notes && (
                    <p className="text-xs text-indigo-200/90 mt-1 line-clamp-1 italic">
                      “{heroItem.notes}”
                    </p>
                  )}

                  {/* Dual Progress: Time Progress & Milestones Progress */}
                  <div className="mt-4 space-y-2 max-w-lg">
                    {/* Time Elapsed Bar */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] text-indigo-200 mb-1">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          <span>时光流逝进度</span>
                        </span>
                        <span className="font-bold text-amber-300">
                          {heroStats.timeProgressPercent}% · 已过 {heroStats.passedDays} 天 / 共 {heroStats.totalDays} 天
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-indigo-400 rounded-full transition-all duration-500 shadow-sm"
                          style={{ width: `${heroStats.timeProgressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Milestones bar (if configured) */}
                    {heroStats.milestonesTotal > 0 && (
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-indigo-200 mb-1">
                          <span className="flex items-center space-x-1">
                            <Layers className="w-3 h-3 text-emerald-400" />
                            <span>阶段目标达成率</span>
                          </span>
                          <span className="font-bold text-emerald-300">
                            {heroStats.milestonesCompleted}/{heroStats.milestonesTotal} 达成 ({heroStats.milestoneProgressPercent}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500 shadow-sm"
                            style={{ width: `${heroStats.milestoneProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Big Numeric Counter Pill */}
                <div className="flex md:flex-col items-center justify-between md:justify-center p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shrink-0 min-w-[150px] text-center">
                  <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">
                    {heroStats.status === 'upcoming'
                      ? '距离目标还剩'
                      : heroStats.status === 'today'
                      ? '精彩时刻'
                      : '已经相伴度过'}
                  </span>
                  <div className="flex items-baseline justify-center space-x-1 my-1">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-amber-300 drop-shadow-md">
                      {Math.abs(heroStats.daysDiff)}
                    </span>
                    <span className="text-sm font-semibold text-indigo-200">天</span>
                  </div>
                  <span className="text-[11px] text-indigo-300/80">
                    {heroStats.status === 'today' ? '就在今天！' : heroStats.daysLabel}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Tabs: 全部 / 倒数中 / 累计日 */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold w-fit">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                全部目标
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'upcoming'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                ⏳ 倒数中
              </button>
              <button
                onClick={() => setActiveTab('passed')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'passed'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                🎉 累计纪念日
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/70 dark:border-indigo-700 dark:text-indigo-300 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                全部分类
              </button>
              {COUNTDOWN_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.key
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/70 dark:border-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {filteredCountdowns.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Timer className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                暂无符合条件的倒数日
              </p>
              <p className="text-xs text-slate-400 mt-1">
                点击上方“新建倒数日”添加你的第一个目标或纪念日
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>立即创建</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCountdowns.map(item => {
                const stats = calculateCountdownStats(item);
                const catMeta = getCategoryMeta(item.category);

                return (
                  <div
                    key={item.id}
                    className={`relative flex flex-col justify-between p-4.5 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-800/90 shadow-2xs ${
                      item.isPinned
                        ? 'border-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-300/40 dark:ring-indigo-800/40'
                        : 'border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div>
                      {/* Card Top Row: Category, Pin, Actions */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${catMeta.badgeBg} ${catMeta.badgeText} flex items-center space-x-1`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dotColor}`} />
                            <span>{catMeta.label}</span>
                          </span>

                          {item.isPinned && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 flex items-center space-x-0.5">
                              <Pin className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              <span>置顶</span>
                            </span>
                          )}
                        </div>

                        {/* Top-right card actions */}
                        <div className="flex items-center space-x-1 text-slate-400">
                          <button
                            onClick={() => onTogglePin(item.id)}
                            className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer ${
                              item.isPinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'
                            }`}
                            title={item.isPinned ? '取消置顶' : '置顶展示'}
                          >
                            <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            title="编辑"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`确定删除倒数日“${item.title}”吗？`)) {
                                onDeleteCountdown(item.id);
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors cursor-pointer"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Title & Days Display */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug truncate">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>目标：{item.targetDate}</span>
                          </p>
                        </div>

                        {/* Big Day Count Badge */}
                        <div
                          className={`text-right px-3 py-1.5 rounded-xl border shrink-0 ${
                            stats.status === 'upcoming'
                              ? 'bg-amber-50/70 border-amber-200/80 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300'
                              : stats.status === 'today'
                              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
                              : 'bg-slate-50/80 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="text-[10px] font-semibold opacity-80">
                            {stats.status === 'upcoming'
                              ? '还剩'
                              : stats.status === 'today'
                              ? '当天'
                              : '已过去'}
                          </div>
                          <div className="text-2xl font-black leading-none my-0.5">
                            {Math.abs(stats.daysDiff)}
                            <span className="text-xs font-normal ml-0.5">天</span>
                          </div>
                        </div>
                      </div>

                      {/* Notes / Memo */}
                      {item.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 line-clamp-2">
                          {item.notes}
                        </p>
                      )}

                      {/* Progress Section */}
                      <div className="mt-3 space-y-1.5">
                        {/* Time Progress Bar */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>时光进度</span>
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            已过 {stats.timeProgressPercent}% · {stats.passedDays}/{stats.totalDays} 天
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              stats.status === 'passed'
                                ? 'bg-slate-400'
                                : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                            }`}
                            style={{ width: `${stats.timeProgressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Milestones / Checklist */}
                      {item.milestones && item.milestones.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-[11px] mb-2">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                              <Layers className="w-3 h-3 text-indigo-500" />
                              <span>阶段小目标 ({stats.milestonesCompleted}/{stats.milestonesTotal})</span>
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                              达成 {stats.milestoneProgressPercent}%
                            </span>
                          </div>

                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {item.milestones.map(m => (
                              <div
                                key={m.id}
                                onClick={() => onToggleMilestone(item.id, m.id)}
                                className={`flex items-center space-x-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  m.completed
                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-900/40 text-slate-400 dark:text-slate-500 line-through'
                                    : 'bg-white dark:bg-slate-800 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                                }`}
                              >
                                {m.completed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                                <span className="truncate flex-1">{m.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Add Milestone Footer in Card */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      {showInlineInput[item.id] ? (
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            placeholder="输入子阶段目标..."
                            value={inlineMilestoneInput[item.id] || ''}
                            onChange={e =>
                              setInlineMilestoneInput(prev => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleInlineMilestoneSubmit(item.id);
                              }
                            }}
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleInlineMilestoneSubmit(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                          >
                            添加
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setShowInlineInput(prev => ({ ...prev, [item.id]: false }))
                            }
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setShowInlineInput(prev => ({ ...prev, [item.id]: true }))
                          }
                          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>添加阶段子目标</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            支持数据云端自动同步与多端备份
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>

      {/* Nested Form Modal: Create / Edit Countdown */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Timer className="w-4 h-4 text-indigo-600" />
                <span>{editingItem ? '编辑倒数日 / 目标' : '新建倒数日 / 目标'}</span>
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  目标名称 / 纪念日 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如：2027考研初试、宝贝1周岁、项目交付..."
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  autoFocus
                />
              </div>

              {/* Date pickers (Target Date & Start Date) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    目标日期 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formTargetDate}
                    onChange={e => setFormTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    起始日期 <span className="text-slate-400 font-normal">(用于计算时光进度)</span>
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Category picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  分类标签
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {COUNTDOWN_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setFormCategory(cat.key)}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-medium flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                        formCategory === cat.key
                          ? `${cat.badgeBg} ${cat.badgeText} border-indigo-400 font-bold ring-1 ring-indigo-400/50`
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${cat.dotColor}`} />
                      <span>{cat.label.slice(0, 2)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pinned toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center space-x-2">
                  <Pin className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      置顶看板推荐
                    </span>
                    <span className="text-[11px] text-slate-400">
                      置顶后会在倒数日看板首位醒目放大展示
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formIsPinned}
                  onChange={e => setFormIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Notes input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  寄语 / 备注说明
                </label>
                <input
                  type="text"
                  placeholder="写一句激励自己或纪念的文字..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Milestones checklist builder */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  阶段子目标 / 关卡清单 <span className="text-slate-400 font-normal">(可选，自动计算打卡进度)</span>
                </label>

                {formMilestones.length > 0 && (
                  <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto pr-1">
                    {formMilestones.map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs"
                      >
                        <span className="truncate flex-1 mr-2 text-slate-700 dark:text-slate-200">
                          {idx + 1}. {m.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestoneFromForm(m.id)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="输入阶段小目标，如“完成第一轮复习”..."
                    value={newMilestoneInput}
                    onChange={e => setNewMilestoneInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMilestoneToForm();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddMilestoneToForm}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
                  >
                    添加关卡
                  </button>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {editingItem ? '保存修改' : '立即创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
