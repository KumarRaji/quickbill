import React from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        <div className="text-5xl font-bold text-slate-900">404</div>
        <div className="text-lg font-semibold text-slate-800">Page not found</div>
        <p className="text-sm text-slate-500">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <button
          onClick={() => navigate("/dashboard", { replace: true })}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Home size={16} />
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default NotFound;
