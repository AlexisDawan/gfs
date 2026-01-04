import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { updates } from "../data/updates";
import { useEffect } from "react";

export function UpdatesPage() {
  // Scroll vers le haut au montage du composant
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Grouper par mois
  const groupedByMonth = updates.reduce((acc, update) => {
    if (!acc[update.month]) {
      acc[update.month] = [];
    }
    acc[update.month].push(update);
    return acc;
  }, {} as Record<string, typeof updates>);

  const getCategoryIcon = (category: "New" | "Improved" | "Fixed", icon: any) => {
    switch (category) {
      case "New":
        return icon;
      case "Improved":
        return icon;
      case "Fixed":
        return CheckCircle;
    }
  };

  const getImpactColor = (impact: "High" | "Medium" | "Low") => {
    switch (impact) {
      case "High":
        return "#00d4ff";
      case "Medium":
        return "#6c63ff";
      case "Low":
        return "#ffffff40";
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0e27] overflow-hidden">
      {/* Fond avec gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#0d1b2a] to-[#0a0e27]"></div>

      {/* Contenu principal */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header avec bouton retour */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <Link to="/">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-[#00d4ff] mb-8 -ml-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to homepage
            </Button>
          </Link>

          <h1 className="text-5xl sm:text-6xl text-white mb-4">
            Platform Updates
          </h1>
          <p className="text-white/60 text-xl">
            Track every improvement we ship to make competitive Overwatch easier.
          </p>
        </motion.div>

        {/* Timeline des updates groupés par mois */}
        <div className="space-y-16">
          {Object.entries(groupedByMonth).map(([month, monthUpdates], monthIndex) => (
            <motion.div
              key={month}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: monthIndex * 0.1 }}
            >
              {/* Titre du mois */}
              <h2 className="text-3xl text-white mb-8 flex items-center gap-4">
                <span className="w-12 h-0.5 bg-gradient-to-r from-[#6c63ff] to-[#00d4ff]"></span>
                {month}
              </h2>

              {/* Grille des updates du mois */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {monthUpdates.map((update, index) => {
                  const CategoryIcon = getCategoryIcon(update.category, update.icon);
                  const UpdateIcon = update.icon;

                  return (
                    <motion.div
                      key={update.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                      whileHover={{
                        y: -5,
                        boxShadow: `0 10px 30px ${update.categoryColor}30`,
                      }}
                      className="bg-[#0d1b2a] border border-[#00d4ff]/20 rounded-xl p-6 transition-all duration-300 hover:border-[#00d4ff]/50"
                    >
                      {/* Header avec badge et date */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-3 py-1 rounded-full text-xs uppercase tracking-wider flex items-center gap-1.5"
                            style={{
                              backgroundColor: `${update.categoryColor}20`,
                              color: update.categoryColor,
                            }}
                          >
                            <CategoryIcon className="w-3 h-3" />
                            {update.category}
                          </span>
                          <span
                            className="px-2 py-1 rounded text-xs uppercase tracking-wider"
                            style={{
                              backgroundColor: `${getImpactColor(update.impact)}20`,
                              color: getImpactColor(update.impact),
                            }}
                          >
                            {update.impact} impact
                          </span>
                        </div>
                        <span className="text-white/40 text-sm">{update.date}</span>
                      </div>

                      {/* Icône illustrative */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                        style={{
                          backgroundColor: `${update.categoryColor}20`,
                        }}
                      >
                        <UpdateIcon
                          className="w-6 h-6"
                          style={{ color: update.categoryColor }}
                        />
                      </div>

                      {/* Contenu */}
                      <h3 className="text-xl text-white mb-3">{update.title}</h3>
                      <p className="text-white/60 text-sm leading-relaxed mb-2">
                        {update.description}
                      </p>
                      <p className="text-white/40 text-xs leading-relaxed">
                        {update.longDescription}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer de page */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 text-center"
        >
          <div className="bg-[#0d1b2a] border border-[#00d4ff]/20 rounded-xl p-8">
            <p className="text-white/60 mb-4">
              Updates are shipped regularly. We're constantly improving the platform.
            </p>
            <Link to="/">
              <Button className="bg-[#6c63ff] text-white hover:bg-[#6c63ff]/80 px-8 py-3">
                Back to homepage
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}