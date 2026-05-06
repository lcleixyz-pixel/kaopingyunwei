import { Award, Upload } from 'lucide-react';

export default function Scores() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-600" />
            成绩管理
          </h1>
          <p className="text-slate-500 mt-1">成绩录入、复核和上报</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
          <Upload className="w-4 h-4" />
          批量导入
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-lg font-medium text-slate-400">成绩管理功能开发中</p>
        <p className="text-sm text-slate-400 mt-1">Phase 2 将实现成绩录入、复核、上报功能</p>
      </div>
    </div>
  );
}
