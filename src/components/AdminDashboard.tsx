import { useState, useEffect } from 'react';
import { supabase, type Event, type User, type AdminAction, type ChabadHouse } from '../lib/supabase';
import { Shield, TrendingUp, Users, FileText, Calendar, TriangleAlert as AlertTriangle, Trash2, Eye, Hop as Home, Flag, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { EventCard } from './EventCard';
import { BackButton } from './BackButton';
import { UserAvatar } from './UserAvatar';
import { UserProfileModal } from './UserProfileModal';

interface AdminDashboardProps {
  currentUserId: string;
  onBack: () => void;
}

type TabType = 'overview' | 'events' | 'users' | 'locations' | 'logs' | 'reports';

type ReportRow = {
  id: string;
  message_id: string | null;
  channel_id: string | null;
  reporter_id: string | null;
  reported_user_id: string | null;
  message_content: string | null;
  message_type: string | null;
  status: 'open' | 'reviewed' | 'dismissed';
  created_at: string;
  reporter?: { display_name: string | null } | null;
  reported?: { display_name: string | null } | null;
};

export function AdminDashboard({ currentUserId, onBack }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalUsers: 0,
    totalLocations: 0,
    recentActions: 0,
    openReports: 0,
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<ChabadHouse[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [viewUser, setViewUser] = useState<User | null>(null);

  useEffect(() => {
    loadCurrentUser();
  }, [currentUserId]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadStats();
      if (activeTab === 'events') loadEvents();
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'locations') loadLocations();
      if (activeTab === 'logs') loadAdminActions();
      if (activeTab === 'reports') loadReports();
    }
  }, [activeTab, currentUser]);

  const loadCurrentUser = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUserId)
        .maybeSingle();

      setCurrentUser(data);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const [eventsCount, usersCount, locationsCount, actionsCount, reportsCount] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('admin_locations').select('*', { count: 'exact', head: true }),
        supabase.from('admin_actions').select('*', { count: 'exact', head: true }),
        supabase.from('message_reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ]);

      setStats({
        totalEvents: eventsCount.count || 0,
        totalUsers: usersCount.count || 0,
        totalLocations: locationsCount.count || 0,
        recentActions: actionsCount.count || 0,
        openReports: reportsCount.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('events')
        .select('*, users(*)')
        .order('created_at', { ascending: false })
        .limit(50);

      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('admin_locations')
        .select('*')
        .order('created_at', { ascending: false });

      setLocations(data || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminActions = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      setAdminActions(data || []);
    } catch (error) {
      console.error('Error loading admin actions:', error);
    } finally {
      setLoading(false);
    }
  };


  const loadReports = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('message_reports')
        .select('*, reporter:reporter_id(display_name), reported:reported_user_id(display_name)')
        .order('status', { ascending: true })   // 'open' sorts before 'dismissed'/'reviewed'
        .order('created_at', { ascending: false })
        .limit(100);
      setReports((data as ReportRow[]) || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await supabase.from('message_reports').update({ status: 'dismissed' }).eq('id', reportId);
      loadReports();
      loadStats();
    } catch (error) {
      console.error('Error dismissing report:', error);
    }
  };

  const handleDeleteReportedMessage = async (report: ReportRow) => {
    if (!confirm('למחוק את ההודעה המדווחת ולסמן את הדיווח כטופל?')) return;
    try {
      if (report.message_id) {
        await supabase.from('group_messages').delete().eq('id', report.message_id);
      }
      await supabase.from('message_reports').update({ status: 'reviewed' }).eq('id', report.id);
      await supabase.rpc('log_admin_action', {
        p_action_type: 'delete_reported_message',
        p_target_type: 'group_message',
        p_target_id: report.message_id,
        p_target_user_id: report.reported_user_id,
      });
      loadReports();
      loadStats();
    } catch (error) {
      console.error('Error handling reported message:', error);
      alert('שגיאה בטיפול בדיווח');
    }
  };

  const handleToggleAdmin = async (user: User) => {
    if (user.id === currentUserId) { alert('אי אפשר לשנות את ההרשאה של עצמך'); return; }
    const makeAdmin = user.role !== 'admin';
    if (!confirm(makeAdmin ? `להפוך את ${user.display_name} למנהל?` : `להסיר הרשאת מנהל מ-${user.display_name}?`)) return;
    try {
      const { error } = await supabase.from('users').update({ role: makeAdmin ? 'admin' : 'user' }).eq('id', user.id);
      if (error) throw error;
      await supabase.rpc('log_admin_action', {
        p_action_type: makeAdmin ? 'promote_admin' : 'demote_admin',
        p_target_type: 'user',
        p_target_id: user.id,
        p_target_user_id: user.id,
      });
      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('שגיאה בעדכון ההרשאה — ייתכן שחסרה מדיניות הרשאות ב-DB');
    }
  };

  const handleDeleteEvent = async (eventId: string, eventUserId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את האירוע?')) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action_type: 'delete_event',
        p_target_type: 'event',
        p_target_id: eventId,
        p_target_user_id: eventUserId,
      });

      loadEvents();
      loadStats();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('שגיאה במחיקת האירוע');
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את המקום?')) return;

    try {
      const { error } = await supabase.from('admin_locations').delete().eq('id', locationId);
      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action_type: 'delete_location',
        p_target_type: 'admin_location',
        p_target_id: locationId,
        p_target_user_id: null,
      });

      loadLocations();
      loadStats();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('שגיאה במחיקת המקום');
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
            אין הרשאת גישה
          </h2>
          <p className="text-gray-600 mb-6" style={{ fontFamily: 'Rubik, sans-serif' }}>
            אין לך הרשאות מנהל לצפות בעמוד זה
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-2xl font-semibold hover:shadow-lg transition-all"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'סקירה כללית', icon: TrendingUp },
    { id: 'events' as const, label: 'אירועים', icon: Calendar },
    { id: 'reports' as const, label: 'דיווחים', icon: Flag },
    { id: 'locations' as const, label: 'מקומות', icon: Home },
    { id: 'users' as const, label: 'משתמשים', icon: Users },
    { id: 'logs' as const, label: 'לוג פעולות', icon: Eye },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F4F5F7' }} dir="rtl">
      <div
        className="text-white px-4 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
          paddingTop: 'max(1.25rem, calc(env(safe-area-inset-top) + 0.5rem))',
          paddingBottom: '1.1rem',
          borderRadius: '0 0 28px 28px',
          boxShadow: '0 8px 30px rgba(234,88,12,0.28)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <BackButton onClick={onBack} variant="dark" />
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(10px)' }}>
              <Shield className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>
                פאנל ניהול
              </h1>
              <p className="text-white/75 text-[13px]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                ניהול ובקרה מלאה של המערכת
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ touchAction: 'pan-x' }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              const badge = tab.id === 'reports' && stats.openReports > 0 ? stats.openReports : null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 h-10 rounded-full font-bold whitespace-nowrap transition-all active:scale-95"
                  style={{
                    background: active ? '#fff' : 'rgba(255,255,255,0.18)',
                    color: active ? '#EA580C' : '#fff',
                    boxShadow: active ? '0 4px 14px rgba(0,0,0,0.12)' : 'none',
                    fontFamily: 'Heebo, sans-serif', fontSize: 14,
                  }}
                >
                  <tab.icon className="w-4 h-4" strokeWidth={2.2} />
                  {tab.label}
                  {badge != null && (
                    <span className="flex items-center justify-center text-[11px] font-black rounded-full" style={{ minWidth: 18, height: 18, padding: '0 5px', background: active ? '#EF4444' : '#fff', color: active ? '#fff' : '#EA580C' }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {([
              { label: 'אירועים',        value: stats.totalEvents,    icon: Calendar, tint: '#F97316', bg: '#FFF3E9', tab: 'events' as TabType },
              { label: 'משתמשים',        value: stats.totalUsers,     icon: Users,    tint: '#2563EB', bg: '#EAF1FE', tab: 'users' as TabType },
              { label: 'מקומות',         value: stats.totalLocations, icon: Home,     tint: '#16A34A', bg: '#E7F7EE', tab: 'locations' as TabType },
              { label: 'פעולות מנהל',    value: stats.recentActions,  icon: Eye,      tint: '#9333EA', bg: '#F3EAFE', tab: 'logs' as TabType },
              { label: 'דיווחים פתוחים', value: stats.openReports,    icon: Flag,     tint: '#EF4444', bg: '#FDECEC', tab: 'reports' as TabType },
            ]).map((c) => (
              <button
                key={c.label}
                onClick={() => setActiveTab(c.tab)}
                className="bg-white rounded-2xl p-4 text-right active:scale-[0.98] transition-transform"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                    <c.icon className="w-5 h-5" style={{ color: c.tint }} strokeWidth={2.2} />
                  </span>
                  <span className="text-[26px] font-black text-gray-900 leading-none" style={{ fontFamily: 'Heebo, sans-serif' }}>
                    {c.value}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-gray-500" style={{ fontFamily: 'Heebo, sans-serif' }}>{c.label}</p>
              </button>
            ))}
          </div>
        )}


        {activeTab === 'events' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center shadow-lg">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-semibold" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  אין אירועים במערכת
                </p>
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 px-4 py-3">
                  {/* emoji / image */}
                  <div className="w-12 h-12 rounded-[14px] overflow-hidden flex-shrink-0 flex items-center justify-center text-2xl"
                    style={{ background: 'linear-gradient(135deg,#F97316,#fb923c)' }}>
                    {event.emoji || '📅'}
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      {event.title}
                    </p>
                    <p className="text-sm text-gray-500 truncate" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      📍 {event.city} · 👤 {(event as any).users?.display_name || 'לא ידוע'} · 📅 {new Date(event.event_date || '').toLocaleDateString('he-IL')}
                    </p>
                  </div>

                  {/* attendees badge */}
                  <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded-lg flex-shrink-0">
                    {event.attendees?.length || 0}/{event.max_attendees}
                  </span>

                  {/* delete button */}
                  <button
                    onClick={() => handleDeleteEvent(event.id, event.user_id)}
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors active:scale-90"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : reports.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center shadow-lg">
                <Flag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-semibold" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  אין דיווחים
                </p>
              </div>
            ) : (
              reports.map((r) => {
                const statusMeta = r.status === 'open'
                  ? { label: 'פתוח', bg: '#FEE2E2', color: '#DC2626' }
                  : r.status === 'reviewed'
                    ? { label: 'טופל', bg: '#DCFCE7', color: '#16A34A' }
                    : { label: 'נדחה', bg: '#F3F4F6', color: '#6B7280' };
                return (
                  <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4" dir="rtl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: statusMeta.bg, color: statusMeta.color, fontFamily: 'Heebo, sans-serif' }}>
                        {statusMeta.label}
                      </span>
                      <span className="text-xs text-gray-400" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {new Date(r.created_at).toLocaleString('he-IL')}
                      </span>
                    </div>

                    {/* Reported message snapshot */}
                    <div className="rounded-xl px-3 py-2 mb-2" style={{ background: '#F9FAFB', borderInlineStart: '3px solid #EF4444' }}>
                      <p className="text-sm text-gray-800" style={{ fontFamily: 'Rubik, sans-serif', wordBreak: 'break-word' }}>
                        {r.message_type === 'image' ? '📷 תמונה' : r.message_type === 'location' ? '📍 מיקום' : (r.message_content || '(הודעה ריקה)')}
                      </p>
                    </div>

                    <p className="text-xs text-gray-500 mb-3" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      דווח על <span className="font-bold text-gray-700">{r.reported?.display_name || 'משתמש'}</span>
                      {' · '}ע״י <span className="font-bold text-gray-700">{r.reporter?.display_name || 'משתמש'}</span>
                    </p>

                    {r.status === 'open' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteReportedMessage(r)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold text-white"
                          style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', fontFamily: 'Heebo, sans-serif' }}
                        >
                          <Trash2 className="w-4 h-4" /> מחק הודעה
                        </button>
                        <button
                          onClick={() => handleDismissReport(r.id)}
                          className="flex-1 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          style={{ fontFamily: 'Heebo, sans-serif' }}
                        >
                          דחה דיווח
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="חיפוש לפי שם או אימייל..."
                className="w-full h-11 pr-10 pl-4 text-sm rounded-2xl outline-none bg-white focus:ring-2 focus:ring-orange-200 transition"
                style={{ fontFamily: 'Heebo, sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              />
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (() => {
              const q = userSearch.trim().toLowerCase();
              const filtered = q
                ? users.filter(u => (u.display_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
                : users;
              if (filtered.length === 0) {
                return (
                  <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-semibold" style={{ fontFamily: 'Heebo, sans-serif' }}>לא נמצאו משתמשים</p>
                  </div>
                );
              }
              return filtered.map((user) => {
                const isAdmin = user.role === 'admin';
                const isSelf = user.id === currentUserId;
                return (
                  <div key={user.id} className="bg-white rounded-2xl p-3 flex items-center gap-3" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <button onClick={() => setViewUser(user)} className="flex-shrink-0 active:scale-95 transition-transform">
                      <UserAvatar userId={user.id} displayName={user.display_name} avatarUrl={user.avatar_url} size="medium" />
                    </button>
                    <button onClick={() => setViewUser(user)} className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-gray-900 truncate" style={{ fontFamily: 'Heebo, sans-serif' }}>{user.display_name || 'ללא שם'}</p>
                        {isAdmin && (
                          <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFF3E9', color: '#EA580C', fontFamily: 'Heebo, sans-serif' }}>מנהל</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {user.email} · {new Date(user.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        title={isAdmin ? 'הסר הרשאת מנהל' : 'הפוך למנהל'}
                        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-90"
                        style={{ background: isAdmin ? '#FEE2E2' : '#FFF3E9' }}
                      >
                        {isAdmin
                          ? <ShieldOff className="w-[18px] h-[18px]" style={{ color: '#DC2626' }} strokeWidth={2} />
                          : <ShieldCheck className="w-[18px] h-[18px]" style={{ color: '#EA580C' }} strokeWidth={2} />}
                      </button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="space-y-5">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : locations.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center shadow-lg">
                <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-semibold" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  אין מקומות במערכת
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {locations.map((location) => (
                  <div key={location.id} className="bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                    {location.image_url && (
                      <img
                        src={location.image_url}
                        alt={location.name}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                        {location.name}
                      </h3>
                      {location.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                          {location.description}
                        </p>
                      )}
                      {location.city && (
                        <p className="text-sm text-gray-500 mb-2 flex items-center gap-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                          <Home className="w-4 h-4" />
                          {location.city}
                        </p>
                      )}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleDeleteLocation(location.id)}
                          className="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          מחק
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-orange-100 to-red-100 border-b-2 border-orange-200">
              <h3 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                לוג פעולות מנהל
              </h3>
              <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                כל הפעולות המנהליות מתועדות כאן לשקיפות
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {adminActions.length === 0 ? (
                <div className="p-16 text-center">
                  <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg font-semibold" style={{ fontFamily: 'Heebo, sans-serif' }}>
                    אין פעולות מנהל עדיין
                  </p>
                </div>
              ) : (
                adminActions.map((action) => (
                  <div key={action.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm font-bold"
                            style={{ fontFamily: 'Rubik, sans-serif' }}
                          >
                            {action.action_type}
                          </span>
                          <span className="text-gray-500 text-sm" style={{ fontFamily: 'Rubik, sans-serif' }}>
                            {action.target_type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Rubik, sans-serif' }}>
                          {new Date(action.created_at).toLocaleString('he-IL')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User profile preview */}
      {viewUser && (
        <UserProfileModal
          userId={viewUser.id}
          displayName={viewUser.display_name || 'משתמש'}
          avatarUrl={viewUser.avatar_url || undefined}
          instagram={viewUser.instagram || undefined}
          bio={viewUser.bio || undefined}
          age={viewUser.age || undefined}
          languages={viewUser.languages || undefined}
          interests={viewUser.interests || undefined}
          visitedCountries={viewUser.visited_countries || undefined}
          homeBase={viewUser.home_base || undefined}
          onClose={() => setViewUser(null)}
          onSendMessage={() => setViewUser(null)}
        />
      )}
    </div>
  );
}
