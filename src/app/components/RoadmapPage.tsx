import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Search, Users, Repeat, Trophy, Info, Zap, Server, Palette, Navigation, TrendingUp, MousePointer2, Smartphone } from "lucide-react";
import { Button } from "./ui/button";

interface Feature {
  icon: React.ReactNode;
  name: string;
  description: string;
}

interface Phase {
  quarter: string;
  year: string;
  status: "completed" | "in-progress" | "planned" | "future";
  statusLabel: string;
  progress: number; // 0-100
  features: Feature[];
  tooltip: string;
}

export function RoadmapPage() {
  const [expandedPhases, setExpandedPhases] = useState<number[]>([0]); // Phase 1 ouverte par défaut

  const togglePhase = (index: number) => {
    setExpandedPhases((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const phases: Phase[] = [
    {
      quarter: "Q4",
      year: "2025",
      status: "completed",
      statusLabel: "Complété",
      progress: 100,
      tooltip: "Cette phase est terminée et déployée en production",
      features: [
        {
          icon: <Search className="w-5 h-5" />,
          name: "Plateforme de Recherche Unifiée",
          description: "Lancement du hub centralisé permettant de rechercher des scrims, joueurs, équipes et ringers depuis 17 salons Discord avec filtres avancés et synchronisation temps réel.",
        },
        {
          icon: <Server className="w-5 h-5" />,
          name: "Infrastructure Backend Scalable",
          description: "Migration vers une architecture moderne avec Supabase et Edge Functions pour garantir des temps de réponse rapides et une fiabilité maximale.",
        },
        {
          icon: <Palette className="w-5 h-5" />,
          name: "Identité Visuelle & Expérience Utilisateur",
          description: "Établissement du design system 'Cyber Minimal' avec animations interactives et statistiques en temps réel pour une expérience professionnelle et engageante.",
        },
      ],
    },
    {
      quarter: "Q1",
      year: "2026",
      status: "in-progress",
      statusLabel: "En cours",
      progress: 0,
      tooltip: "Développement actif en cours, sortie prévue ce trimestre",
      features: [
        {
          icon: <Users className="w-5 h-5" />,
          name: "Écosystème de Matchmaking Complet",
          description: "Lancement des fonctionnalités Find a Player, Find a Ringer et Find a Team avec profils détaillés, système de matching intelligent et filtres avancés par division et région.",
        },
        {
          icon: <Trophy className="w-5 h-5" />,
          name: "Système de Profils & Réputation",
          description: "Création de profils joueurs enrichis avec historique de performance, badges de réputation et système de reviews pour établir la confiance dans la communauté.",
        },
        {
          icon: <Repeat className="w-5 h-5" />,
          name: "Outils de Gestion d'Équipe",
          description: "Dashboard complet pour les capitaines d'équipe permettant de gérer le roster, planifier les entraînements et suivre la progression collective.",
        },
      ],
    },
    {
      quarter: "Q2",
      year: "2026",
      status: "planned",
      statusLabel: "Planifié",
      progress: 0,
      tooltip: "Phase en cours de planification, détails bientôt disponibles",
      features: [
        {
          icon: <Info className="w-5 h-5" />,
          name: "Prochainement disponible",
          description: "Les fonctionnalités de cette phase seront annoncées prochainement. Restez connectés !",
        },
      ],
    },
    {
      quarter: "Q3",
      year: "2026",
      status: "future",
      statusLabel: "Futur",
      progress: 0,
      tooltip: "Vision à long terme, détails seront affinés au fil du temps",
      features: [
        {
          icon: <Info className="w-5 h-5" />,
          name: "Prochainement disponible",
          description: "Les fonctionnalités de cette phase seront annoncées prochainement. Restez connectés !",
        },
      ],
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        );
      case "in-progress":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
        );
      case "planned":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "future":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400 bg-green-400/10 border-green-400/30";
      case "in-progress":
        return "text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30";
      case "planned":
        return "text-[#6c63ff] bg-[#6c63ff]/10 border-[#6c63ff]/30";
      case "future":
        return "text-white/40 bg-white/5 border-white/10";
      default:
        return "";
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-400";
      case "in-progress":
        return "bg-[#00d4ff]";
      case "planned":
        return "bg-[#6c63ff]";
      case "future":
        return "bg-white/20";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#0d1b2a] to-[#0a0e27] border-b-2 border-[#00d4ff]/30 py-16 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            Notre Vision pour GoForScrim
          </h1>
          <p className="text-white/60 text-lg">
            Découvrez les fonctionnalités à venir et suivez notre progression en temps réel
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-[#00d4ff] to-white/20"></div>

          {/* Phases */}
          <div className="space-y-12">
            {phases.map((phase, index) => (
              <div key={index} className="relative pl-20">
                {/* Badge statut avec tooltip */}
                <div className="absolute left-0 top-0 group">
                  <div
                    className={`w-16 h-16 rounded-full border-2 ${getStatusColor(
                      phase.status
                    )} flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 cursor-help`}
                  >
                    {getStatusIcon(phase.status)}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute left-20 top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    <div className="bg-[#0d1b2a] border border-[#00d4ff]/30 rounded-lg px-3 py-2 text-sm text-white/80 whitespace-nowrap shadow-xl">
                      {phase.tooltip}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#0d1b2a] border-l border-t border-[#00d4ff]/30 rotate-45"></div>
                    </div>
                  </div>
                </div>

                {/* Card Phase */}
                <div className="bg-[#0d1b2a] border border-[#00d4ff]/20 rounded-lg overflow-hidden hover:border-[#00d4ff] transition-all duration-300">
                  {/* Header */}
                  <button
                    onClick={() => togglePhase(index)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#00d4ff]/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold text-white">
                            {phase.quarter} {phase.year}
                          </h2>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                              phase.status
                            )}`}
                          >
                            {phase.statusLabel}
                          </span>
                        </div>
                        {/* Barre de progression */}
                        <div className="mt-3 w-64">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressColor(
                                  phase.status
                                )} transition-all duration-500 rounded-full`}
                                style={{ width: `${phase.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-white/60 text-sm font-medium min-w-[3ch]">
                              {phase.progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-white/60 transition-transform duration-300 ${
                        expandedPhases.includes(index) ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Features (expandable) */}
                  {expandedPhases.includes(index) && (
                    <div className="border-t border-[#00d4ff]/10 px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                      {phase.features.map((feature, featureIndex) => (
                        <div
                          key={featureIndex}
                          className="flex gap-4 p-4 bg-[#0a0e27] rounded-lg border border-[#00d4ff]/10 hover:border-[#00d4ff]/30 transition-all duration-200"
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center text-[#00d4ff]">
                            {feature.icon}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold mb-1">
                              {feature.name}
                            </h3>
                            <p className="text-white/60 text-sm leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-t from-[#0d1b2a] to-[#0a0e27] border-t-2 border-[#00d4ff]/30 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Une idée de fonctionnalité ?
          </h2>
          <p className="text-white/60 mb-8 max-w-2xl mx-auto">
            Votre feedback est essentiel pour façonner l'avenir de GoForScrim. Partagez vos suggestions et aidez-nous à construire la meilleure plateforme pour la communauté compétitive Overwatch.
          </p>
          <Link to="/support">
            <Button className="bg-[#6c63ff] hover:bg-[#6c63ff]/80 text-white px-8 py-6 text-lg border-0">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Suggérer une fonctionnalité
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}