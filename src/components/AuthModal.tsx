import React, { useState } from 'react';
import { X, User, Lock, ArrowRight, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react';
import { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: UserType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleExecuteAuth = async (autoRegister: boolean = false) => {
    setError(null);
    setErrorCode(null);

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    const endpoint = (isLogin && !autoRegister) ? '/api/v1/auth/login' : '/api/v1/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password,
          autoRegister,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.token, data.user);
        onClose();
      } else {
        setError(data.error || '请求失败，请稍后重试');
        setErrorCode(data.code || null);
      }
    } catch {
      setError('网络连接失败，请检查服务器状态');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecuteAuth(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              云端同步账号
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: 登录 / 注册 */}
        <div className="px-6 pt-1">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError(null);
                setErrorCode(null);
              }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                isLogin
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              已有账号登录
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError(null);
                setErrorCode(null);
              }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                !isLogin
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              注册新账号
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isLogin
              ? '登录后，所有任务跨电脑、跨手机实时云端同步'
              : '注册专属账号，数据私密加密隔离且永久保存'}
          </p>

          {/* User Not Found Smart Helper */}
          {errorCode === 'USER_NOT_FOUND' && isLogin ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-200 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>该用户名尚未注册</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                用户名 <strong>"{username}"</strong> 在服务器上还未创建。您可以直接点击下方按钮，使用已填写的密码一键创建并登录：
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleExecuteAuth(true)}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loading ? '正在注册...' : '以此信息一键注册并登录'}</span>
              </button>
            </div>
          ) : error ? (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in duration-150">
              ⚠️ {error}
            </div>
          ) : null}

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              用户名 / 手机号
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  if (error) {
                    setError(null);
                    setErrorCode(null);
                  }
                }}
                placeholder="请输入用户名或手机号 (如: 13537777960)"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                密码
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? '隐藏' : '显示密码'}</span>
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) {
                    setError(null);
                    setErrorCode(null);
                  }
                }}
                placeholder="请输入密码 (至少4位)"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer mt-2"
          >
            <span>{loading ? '正在处理...' : isLogin ? '立即登录' : '立即注册'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Toggle between Login and Register */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {isLogin ? (
              <span>
                还没有账号？{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                >
                  去注册
                </button>
              </span>
            ) : (
              <span>
                已有账号？{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                >
                  直接登录
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
