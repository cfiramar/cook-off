import type { Guest, Meal, Vote } from '../../../hooks/useFirebaseData';
import { BarChart3, Trophy, Sparkles } from 'lucide-react';

interface Props {
  guests?: Guest[];
  meals: Meal[];
  votes: Vote[];
  mode?: 'results' | 'all';
}

/**
 * ResultsDashboard
 * Displays real-time ranking of contest meals, score progression bars,
 * and podium highlights for top dishes.
 */
export default function ResultsDashboard({ meals, votes }: Props) {
  const participatingMeals = meals.filter(m => !m.isNonParticipating);
  const nonParticipatingMeals = meals.filter(m => m.isNonParticipating);

  // Calculate scores for each participating meal
  const mealScores = participatingMeals.map(meal => {
    const mealVotes = votes.filter(v => v.mealId === meal.id);
    const score = mealVotes.reduce((sum, vote) => sum + vote.points, 0);
    const firstPlaceVotes = mealVotes.filter(v => v.points === 3).length;
    const secondPlaceVotes = mealVotes.filter(v => v.points === 2).length;
    const thirdPlaceVotes = mealVotes.filter(v => v.points === 1).length;
    return { ...meal, score, firstPlaceVotes, secondPlaceVotes, thirdPlaceVotes, totalVotes: mealVotes.length };
  }).sort((a, b) => b.score - a.score);

  const highestScore = mealScores[0]?.score || 1;
  const totalPointsAwarded = votes.reduce((sum, v) => sum + v.points, 0);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto admin-scroll p-6 md:p-8 flex flex-col text-right min-h-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Trophy className="text-amber-500" />
            תוצאות ודירוג מנות חי
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            טבלת הניקוד והמובילים בתחרות בזמן אמת על פי שקלול הצבעות האורחים
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200/80 px-4 py-2 rounded-2xl flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600" />
            <span className="text-xs font-bold text-amber-900">
              סה״כ {totalPointsAwarded} נקודות חולקו
            </span>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Highlights (if at least 2 meals and some votes exist) */}
      {mealScores.length > 0 && mealScores[0].score > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 flex-shrink-0">
          
          {/* 1st Place */}
          {mealScores[0] && (
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-100/30 to-amber-50 rounded-3xl p-5 border-2 border-amber-400 shadow-md relative overflow-hidden order-1 md:order-2">
              <div className="absolute -top-3 -right-3 w-16 h-16 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black bg-amber-500 text-white px-3 py-1 rounded-full uppercase tracking-wider">
                  מקום 1 🥇
                </span>
                <img src="/medal_1st.png" alt="מקום ראשון" className="w-10 h-10 object-contain drop-shadow" />
              </div>
              <h4 className="font-extrabold text-gray-900 text-lg mb-1 truncate">{mealScores[0].name}</h4>
              <p className="text-xs text-gray-500 mb-3 truncate">{mealScores[0].description || 'מנה משתתפת'}</p>
              <div className="flex items-baseline gap-1 text-amber-700">
                <span className="text-3xl font-black">{mealScores[0].score}</span>
                <span className="text-xs font-bold">נקודות</span>
              </div>
            </div>
          )}

          {/* 2nd Place */}
          {mealScores[1] && (
            <div className="bg-gradient-to-br from-slate-500/10 via-slate-100/30 to-slate-50 rounded-3xl p-5 border border-slate-300 shadow-xs order-2 md:order-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black bg-slate-500 text-white px-3 py-1 rounded-full uppercase tracking-wider">
                  מקום 2 🥈
                </span>
                <img src="/medal_2nd.png" alt="מקום שני" className="w-9 h-9 object-contain drop-shadow" />
              </div>
              <h4 className="font-extrabold text-gray-900 text-base mb-1 truncate">{mealScores[1].name}</h4>
              <p className="text-xs text-gray-500 mb-3 truncate">{mealScores[1].description || 'מנה משתתפת'}</p>
              <div className="flex items-baseline gap-1 text-slate-700">
                <span className="text-2xl font-black">{mealScores[1].score}</span>
                <span className="text-xs font-bold">נקודות</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {mealScores[2] && (
            <div className="bg-gradient-to-br from-amber-700/10 via-orange-100/30 to-orange-50 rounded-3xl p-5 border border-amber-300 shadow-xs order-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black bg-amber-700 text-white px-3 py-1 rounded-full uppercase tracking-wider">
                  מקום 3 🥉
                </span>
                <img src="/medal_3rd.png" alt="מקום שלישי" className="w-9 h-9 object-contain drop-shadow" />
              </div>
              <h4 className="font-extrabold text-gray-900 text-base mb-1 truncate">{mealScores[2].name}</h4>
              <p className="text-xs text-gray-500 mb-3 truncate">{mealScores[2].description || 'מנה משתתפת'}</p>
              <div className="flex items-baseline gap-1 text-amber-800">
                <span className="text-2xl font-black">{mealScores[2].score}</span>
                <span className="text-xs font-bold">נקודות</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Full Leaderboard List */}
      <div className="mb-8">
        <h3 className="text-lg font-black mb-4 text-gray-900 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-600" />
          טבלת דירוג מלאה ({participatingMeals.length} מנות)
        </h3>

        {mealScores.length === 0 ? (
          <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Trophy size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-bold text-gray-700">אין עדיין מנות בתחרות</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mealScores.map((meal, index) => {
              const percentage = Math.round((meal.score / highestScore) * 100);

              return (
                <div
                  key={meal.id}
                  className="bg-gray-50/70 hover:bg-gray-50 border border-gray-200 rounded-2xl p-4 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Position Icon / Badge */}
                    <div className="shrink-0">
                      {index === 0 ? (
                        <img src="/medal_1st.png" alt="מקום 1" className="w-10 h-10 object-contain drop-shadow" />
                      ) : index === 1 ? (
                        <img src="/medal_2nd.png" alt="מקום 2" className="w-9 h-9 object-contain drop-shadow" />
                      ) : index === 2 ? (
                        <img src="/medal_3rd.png" alt="מקום 3" className="w-9 h-9 object-contain drop-shadow" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm bg-white text-gray-700 border border-gray-200 shadow-2xs">
                          {index + 1}
                        </div>
                      )}
                    </div>

                    {/* Meal Info & Progress Bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="truncate">
                          <span className="font-extrabold text-gray-900 text-sm ml-2">{meal.name}</span>
                          {meal.description && (
                            <span className="text-xs text-gray-500 hidden sm:inline">{meal.description}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Medals Breakdown */}
                          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 font-medium">
                            {meal.firstPlaceVotes > 0 && <span>🥇 {meal.firstPlaceVotes}</span>}
                            {meal.secondPlaceVotes > 0 && <span>🥈 {meal.secondPlaceVotes}</span>}
                            {meal.thirdPlaceVotes > 0 && <span>🥉 {meal.thirdPlaceVotes}</span>}
                          </div>

                          <span className="font-black text-blue-600 text-base">
                            {meal.score} <span className="text-xs font-medium text-gray-500">נק׳</span>
                          </span>
                        </div>
                      </div>

                      {/* Bar */}
                      <div className="w-full bg-gray-200/80 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            index === 0
                              ? 'bg-gradient-to-l from-amber-400 to-amber-500'
                              : index === 1
                              ? 'bg-gradient-to-l from-slate-400 to-slate-500'
                              : index === 2
                              ? 'bg-gradient-to-l from-orange-400 to-amber-600'
                              : 'bg-gradient-to-l from-blue-400 to-blue-600'
                          }`}
                          style={{ width: `${Math.max(percentage, meal.score > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Non-participating meals section */}
        {nonParticipatingMeals.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                מנות מחוץ לתחרות ({nonParticipatingMeals.length})
              </span>
              <span className="text-xs text-gray-400">מוצגות לאורחים אך אינן משתתפות בהצבעה ובדירוג</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {nonParticipatingMeals.map(meal => (
                <div key={meal.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700 truncate">{meal.name}</span>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
                    לתצוגה בלבד
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
