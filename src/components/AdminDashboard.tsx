import { useState, useEffect } from 'react';
import { supabase, type Event, type User, type AdminAction, type ChabadHouse } from '../lib/supabase';
import { Shield, TrendingUp, Users, FileText, Calendar, TriangleAlert as AlertTriangle, ArrowLeft, Trash2, Eye, Hop as Home } from 'lucide-react';
import { EventCard } from './EventCard';

interface AdminDashboardProps {
  currentUserId: string;
  onBack: () => void;
}

type TabType = 'overview' | 'events' | 'users' | 'locations' | 'logs';

export function AdminDashboard({ currentUserId, onBack }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalUsers: 0,
    totalLocations: 0,
    recentActions: 0,
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<ChabadHouse[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
      const [eventsCount, usersCount, locationsCount, actionsCount] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('admin_locations').select('*', { count: 'exact', head: true }),
        supabase.from('admin_actions').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalEvents: eventsCount.count || 0,
        totalUsers: usersCount.count || 0,
        totalLocations: locationsCount.count || 0,
        recentActions: actionsCount.count || 0,
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
    { id: 'locations' as const, label: 'מקומות', icon: Home },
    { id: 'users' as const, label: 'משתמשים', icon: Users },
    { id: 'logs' as const, label: 'לוג פעולות', icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-brand-100" dir="rtl">
      <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 text-white px-4 py-6 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center">
                <Shield className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  פאנל ניהול
                </h1>
                <p className="text-white/80 text-sm" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  ניהול ובקרה מלאה של המערכת
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-brand-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                style={{ fontFamily: 'Rubik, sans-serif' }}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-brand-200">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-10 h-10 text-brand-500" />
                <span className="text-3xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  {stats.totalEvents}
                </span>
              </div>
              <p className="text-gray-600 font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>סך האירועים</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-10 h-10 text-blue-600" />
                <span className="text-3xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  {stats.totalUsers}
                </span>
              </div>
              <p className="text-gray-600 font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>סך המשתמשים</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-green-100">
              <div className="flex items-center justify-between mb-2">
                <Home className="w-10 h-10 text-green-600" />
                <span className="text-3xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  {stats.totalLocations}
                </span>
              </div>
              <p className="text-gray-600 font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>סך המקומות</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-orange-100">
              <div className="flex items-center justify-between mb-2">
                <Eye className="w-10 h-10 text-orange-600" />
                <span className="text-3xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  {stats.recentActions}
                </span>
              </div>
              <p className="text-gray-600 font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>פעולות מנהל</p>
            </div>
          </div>
        )}


        {activeTab === 'events' && (
          <div className="space-y-5">
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
                <EventCard
                  key={event.id}
                  event={event}
                  currentUserId={currentUserId}
                  onAttendClick={() => {}}
                  onDelete={() => handleDeleteEvent(event.id, event.user_id)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-brand-100 to-brand-200">
                  <tr>
                    <th className="px-6 py-4 text-right font-bold text-gray-700" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      שם
                    </th>
                    <th className="px-6 py-4 text-right font-bold text-gray-700" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      אימייל
                    </th>
                    <th className="px-6 py-4 text-right font-bold text-gray-700" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      תפקיד
                    </th>
                    <th className="px-6 py-4 text-right font-bold text-gray-700" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      תאריך הצטרפות
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => (
                    <tr key={user.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {user.display_name}
                      </td>
                      <td className="px-6 py-4 text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${
                            user.role === 'admin'
                              ? 'bg-brand-100 text-brand-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                          style={{ fontFamily: 'Rubik, sans-serif' }}
                        >
                          {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {new Date(user.created_at).toLocaleDateString('he-IL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
