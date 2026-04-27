import { formatDateTime, type IDiaryEntry } from "@second-brain/shared";

type TimelineListProps = {
  entries: IDiaryEntry[];
};

const moodConfig = {
  GREAT: {
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    label: "Great",
    emoji: "😊",
  },
  GOOD: {
    color: "bg-blue-500",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "Good",
    emoji: "🙂",
  },
  NEUTRAL: {
    color: "bg-amber-500",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "Neutral",
    emoji: "😐",
  },
  BAD: {
    color: "bg-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    label: "Bad",
    emoji: "😔",
  },
  TERRIBLE: {
    color: "bg-red-500",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "Terrible",
    emoji: "😢",
  },
};

export function TimelineList({ entries }: TimelineListProps) {
  return (
    <div className="relative">
      {/* Timeline vertical line */}
      <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200" />
      
      <ul className="space-y-6">
        {entries.map((entry, index) => {
          const mood = moodConfig[entry.mood as keyof typeof moodConfig] || moodConfig.NEUTRAL;
          
          return (
            <li key={entry.id} className="relative pl-14">
              {/* Timeline dot */}
              <div className={`absolute left-0 top-6 w-10 h-10 rounded-full ${mood.color} shadow-lg flex items-center justify-center text-white font-bold border-4 border-white z-10`}>
                <span className="text-lg">{mood.emoji}</span>
              </div>
              
              {/* Card */}
              <div className={`group relative rounded-2xl border-2 ${mood.borderColor} bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
                {/* Mood badge */}
                <div className="absolute -top-3 right-6">
                  <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold ${mood.bgColor} ${mood.textColor} border ${mood.borderColor} shadow-sm`}>
                    <span className="w-2 h-2 rounded-full ${mood.color}"></span>
                    {mood.label}
                  </span>
                </div>
                
                {/* Header */}
                <div className="flex flex-col gap-2 mb-4">
                  <h3 className="text-xl font-bold text-slate-900 pr-24">
                    {entry.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <time className="font-medium">{formatDateTime(entry.createdAt)}</time>
                  </div>
                </div>
                
                {/* Content */}
                <div className="relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-full ${mood.color} opacity-50`}></div>
                  <p className="pl-4 text-base text-slate-700 leading-relaxed">
                    {entry.content}
                  </p>
                </div>
                
                {/* Footer decoration */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span>Entry #{entries.length - index}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      
      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No entries yet</h3>
          <p className="text-slate-500">Start by creating your first diary entry</p>
        </div>
      )}
    </div>
  );
}
