import { Clock } from "lucide-react";

export function TeamSearchPage() {
  return (
    <div className="min-h-screen bg-[#0a0e27]">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#0d1b2a] to-[#0a0e27] border-b-2 border-[#00d4ff]/30 py-16 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Find a Team</h1>
          <p className="text-white/60 text-lg">
            Rejoignez une équipe compétitive Overwatch
          </p>
        </div>
      </div>

      {/* Bientôt disponible */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="flex flex-col items-center justify-center space-y-8">
          {/* Icône */}
          <div className="w-32 h-32 rounded-full bg-[#0d1b2a] border-2 border-[#00d4ff]/30 flex items-center justify-center">
            <Clock className="w-16 h-16 text-[#00d4ff]" />
          </div>

          {/* Texte */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-white">Bientôt disponible</h2>
            <p className="text-white/60 text-xl max-w-2xl">
              Nous travaillons activement sur cette fonctionnalité. Elle sera disponible très prochainement !
            </p>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#6c63ff]/20 border border-[#6c63ff]/30 rounded-full">
            <div className="w-2 h-2 rounded-full bg-[#6c63ff] animate-pulse"></div>
            <span className="text-[#6c63ff]">En développement</span>
          </div>
        </div>
      </div>
    </div>
  );
}