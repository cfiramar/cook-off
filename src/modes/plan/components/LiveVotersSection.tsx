import { useState, useMemo } from 'react';
import type { Guest, Meal, Vote } from '../../../hooks/useFirebaseData';
import { Users, Search, CheckCircle2, Flame, Clock, X } from 'lucide-react';

interface Props {
  guests: Guest[];
  meals: Meal[];
  votes: Vote[];
}

type FilterType = 'all' | 'done' | 'voting' | 'pending';

/**
 * Dedicated Live Voters Section
 * Displays real-time status of all voters during the contest,
 * showing who has completed voting, who is currently voting, and who has not connected yet,
 * along with the breakdown of their medal/point awards.
 */
export default function LiveVotersSection({ guests, meals, votes }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');

  // Compute status for each guest
  const guestsWithStatus = useMemo(() => {
    return guests.map(guest => {
      const guestVotes = votes.filter(v => v.guestId === guest.id);
      let status: 'done' | 'voting' | 'pending' = 'pending';

      if (guestVotes.length >= 2 || guest.status === 'done') {
        status = 'done';
      } else if (guestVotes.length === 1 || guest.status === 'voting') {
        status = 'voting';
      }

      return {
        ...guest,
        calculatedStatus: status,
        guestVotes
      };
    });
  }, [guests, votes]);

  // Status Counts
  const stats = useMemo(() => {
    const done = guestsWithStatus.filter(g => g.calculatedStatus === 'done').length;
    const voting = guestsWithStatus.filter(g => g.calculatedStatus === 'voting').length;
    const pending = guestsWithStatus.filter(g => g.calculatedStatus === 'pending').length;
    const totalVotesCast = votes.length;
    return { done, voting, pending, totalVotesCast };
  }, [guestsWithStatus, votes]);

  // Filter & Search
  const filteredGuests = useMemo(() => {
    return guestsWithStatus.filter(g => {
      if (statusFilter !== 'all' && g.calculatedStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = g.name.toLowerCase().includes(query);
        const matchHousehold = (g.householdName || '').toLowerCase().includes(query);
        if (!matchName && !matchHousehold) return false;
      }
      return true;
    }).sort((a, b) => {
      // Done first, then voting, then pending
      const rank = { done: 1, voting: 2, pending: 3 };
      const diff = rank[a.calculatedStatus] - rank[b.calculatedStatus];
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'he');
    });
  }, [guestsWithStatus, statusFilter, searchQuery]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto admin-scroll p-4 sm:p-6 md:p-8 text-right relative flex flex-col min-h-0">
      
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Users className="text-blue-600" />
            סטטוס מצביעים חי
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            מעקב בזמן אמת אחר התחברות והצבעות האורחים באירוע
          </p>
        </div>

        <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200/60 px-3.5 py-2 rounded-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-blue-900">
            {stats.done} מתוך {guests.length} סיימו להצביע
          </span>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        
        {/* Total Guests */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-gray-500 font-bold flex items-center justify-between">
            <span>סה״כ מוזמנים</span>
            <Users size={16} className="text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-800">
            {guests.length}
          </div>
        </div>

        {/* Done Voting */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-emerald-800 font-bold flex items-center justify-between">
            <span>סיימו להצביע</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            {stats.done}
          </div>
        </div>

        {/* Currently Voting */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-blue-800 font-bold flex items-center justify-between">
            <span>מצביעים כעת</span>
            <Flame size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">
            {stats.voting}
          </div>
        </div>

        {/* Pending */}
        <div className="bg-red-50/70 border border-red-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-red-800 font-bold flex items-center justify-between">
            <span>טרם התחברו</span>
            <Clock size={16} className="text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-red-700">
            {stats.pending}
          </div>
        </div>

      </div>

      {/* Sticky Toolbar: Search & Filter Chips (remains sticky when scrolling down) */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md pt-1 pb-3 mb-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חיפוש אורח או משק בית..."
            className="w-full pl-9 pr-9 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all"
          />
          <Search size={15} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 admin-scroll">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            הכל ({guests.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('done')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'done'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            סיימו ({stats.done})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('voting')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'voting'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-blue-700 hover:bg-blue-50'
            }`}
          >
            מצביעים ({stats.voting})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'pending'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-red-700 hover:bg-red-50'
            }`}
          >
            טרם התחברו ({stats.pending})
          </button>
        </div>

      </div>

      {/* Voter Cards Grid / List */}
      <div className="pb-4">
        {filteredGuests.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <Users size={36} className="mx-auto text-gray-300 mb-2" />
            <h3 className="font-bold text-gray-700 text-sm">לא נמצאו מצביעים</h3>
            <p className="text-xs text-gray-400 mt-1">נסה לשנות את מילות החיפוש או הסינון</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredGuests.map(guest => {
              const isDone = guest.calculatedStatus === 'done';
              const isVoting = guest.calculatedStatus === 'voting';

              return (
                <div
                  key={guest.id}
                  className={`rounded-2xl p-4 border transition-all ${
                    isDone
                      ? 'border-emerald-200/90 bg-emerald-50/30 hover:border-emerald-300 shadow-2xs'
                      : isVoting
                      ? 'border-blue-200/90 bg-blue-50/30 hover:border-blue-300 shadow-2xs'
                      : 'border-gray-200 bg-gray-50/40 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-sm">{guest.name}</span>
                        {guest.householdName && (
                          <span className="text-[11px] text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-md font-medium">
                            {guest.householdName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {isDone ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>סיים להצביע</span>
                        </span>
                      ) : isVoting ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                          <Flame size={13} className="text-blue-600 animate-pulse" />
                          <span>מצביע כעת...</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                          <Clock size={13} className="text-gray-400" />
                          <span>טרם התחבר</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Votes Breakdown (if any) */}
                  {guest.guestVotes.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-gray-200/60 space-y-1.5">
                      <div className="text-[11px] font-bold text-gray-500 mb-1">דירוג המנות:</div>
                      {guest.guestVotes
                        .sort((a, b) => b.points - a.points)
                        .map(v => {
                          const meal = meals.find(m => m.id === v.mealId);
                          return (
                            <div
                              key={v.id}
                              className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1.5 border border-gray-100 shadow-2xs"
                            >
                              <div className="flex items-center gap-2">
                                {v.points === 3 ? (
                                  <img src="/medal_1st.png" alt="מקום 1" className="w-5 h-5 object-contain" />
                                ) : v.points === 2 ? (
                                  <img src="/medal_2nd.png" alt="מקום 2" className="w-5 h-5 object-contain" />
                                ) : (
                                  <img src="/medal_3rd.png" alt="מקום 3" className="w-5 h-5 object-contain" />
                                )}
                                <span className="font-semibold text-gray-800 truncate max-w-[180px]">
                                  {meal?.name || 'מנה שנמחקה'}
                                </span>
                              </div>
                              <span className="font-bold text-blue-600 text-xs">{v.points} נק׳</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-2">עדיין לא חולקו נקודות</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}
