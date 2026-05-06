import { FileText } from 'lucide-react';

export default function Certificates() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          证书管理
        </h1>
        <p className="text-slate-500 mt-1">证书赋码、制证、发放和补办</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-lg font-medium text-slate-400">证书管理功能开发中</p>
        <p className="text-sm text-slate-400 mt-1">Phase 2 将实现证书赋码、制证、发放功能</p>
      </div>
    </div>
  );
}
