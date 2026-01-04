import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Search, Clock, Filter, Zap, Shield, Target } from "lucide-react";
import { useHomeStats, formatStatNumber } from "../hooks/useHomeStats";
import { supabase } from "../../../utils/supabase/client";
import ScrimCard from "./ScrimCard";
import { getLatestUpdates } from "../data/updates";

// Composant carrousel de logos infini avec contrôle de vitesse
const LogoCarousel = memo(function LogoCarousel() {
  // Images placeholder monochromes pour les serveurs Discord
  const logos = [
    "https://images.unsplash.com/photo-1759701547421-2972dd046ba4?w=150&h=150&fit=crop&q=80",
    "https://images.unsplash.com/photo-1759701547797-15ee208edc40?w=150&h=150&fit=crop&q=80",
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=150&h=150&fit=crop&q=80",
    "https://images.unsplash.com/photo-1587095951604-b9d924a3fda0?w=150&h=150&fit=crop&q=80",
    "https://images.unsplash.com/photo-1725272532764-183d164c722b?w=150&h=150&fit=crop&q=80",
  ];

  // Dupliquer les logos avec l'image 1 à la fin pour un loop seamless
  const duplicatedLogos = [...logos, ...logos, logos[0]];

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="flex gap-16 py-8"
        animate={{
          x: ["0%", "-50%"], // Défilement jusqu'à la moitié (car on a dupliqué)
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 20, // Vitesse accélérée (était 30)
            ease: "linear",
          },
        }}
      >
        {duplicatedLogos.map((logo, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-[150px] h-[150px] flex items-center justify-center rounded-full overflow-hidden"
            style={{
              filter: "grayscale(100%) brightness(0.8) contrast(1.2)",
              opacity: 0.7,
            }}
          >
            <img
              src={logo}
              alt={`Server logo ${index + 1}`}
              className="w-full h-full object-cover transition-opacity duration-300 hover:opacity-100"
              draggable={false}
              loading="lazy"
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
});

// Helper pour les couleurs de rank
const getRankColor = (rank: string) => {
  const rankLower = rank?.toLowerCase() || "";
  if (rankLower.includes("bronze")) return "#cd7f32";
  if (rankLower.includes("argent") || rankLower.includes("silver")) return "#c0c0c0";
  if (rankLower.includes("or") || rankLower.includes("gold")) return "#ffd700";
  if (rankLower.includes("platine") || rankLower.includes("platinum")) return "#00d4ff";
  if (rankLower.includes("diamant") || rankLower.includes("diamond")) return "#b9f2ff";
  if (rankLower.includes("master")) return "#ff6b9d";
  if (rankLower.includes("gm") || rankLower.includes("grandmaster")) return "#ffaa00";
  if (rankLower.includes("champion") || rankLower.includes("top 500")) return "#f0e68c";
  return "#ffffff";
};

export function HomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [previewScrims, setPreviewScrims] = useState<any[]>([]);
  const [loadingScrims, setLoadingScrims] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // ✅ Récupérer les stats dynamiques depuis Supabase
  const { stats, loading: statsLoading } = useHomeStats();

  // ✅ Récupérer quelques scrims pour la preview
  useEffect(() => {
    async function fetchPreviewScrims() {
      try {
        const { data, error } = await supabase
          .from('scrims')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) throw error;
        setPreviewScrims(data || []);
      } catch (err) {
        console.error('❌ Error fetching preview scrims:', err);
      } finally {
        setLoadingScrims(false);
      }
    }

    fetchPreviewScrims();
  }, []);

  // 🎨 Background animation - Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // 🎨 Background animation - Hexagones interactifs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const hexagons: Array<{
      x: number;
      y: number;
      size: number;
      baseOpacity: number;
      currentOpacity: number;
      scale: number;
    }> = [];

    // Créer une grille d'hexagones
    const hexSize = 50;
    const cols = Math.ceil(canvas.width / (hexSize * 1.5)) + 2;
    const rows = Math.ceil(canvas.height / (hexSize * Math.sqrt(3))) + 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * hexSize * 1.5;
        const y = row * hexSize * Math.sqrt(3) + (col % 2) * (hexSize * Math.sqrt(3)) / 2;
        hexagons.push({
          x,
          y,
          size: hexSize,
          baseOpacity: 0.05,
          currentOpacity: 0.05,
          scale: 1,
        });
      }
    }

    const drawHexagon = (
      x: number,
      y: number,
      size: number,
      opacity: number,
      scale: number
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = size * Math.cos(angle);
        const hy = size * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(hx, hy);
        } else {
          ctx.lineTo(hx, hy);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`; // #00d4ff
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      hexagons.forEach((hex) => {
        const dx = mousePosition.x - hex.x;
        const dy = mousePosition.y - hex.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 150;

        if (distance < maxDistance) {
          // Effet de "pression" très subtil
          const influence = 1 - distance / maxDistance;
          hex.currentOpacity = hex.baseOpacity + influence * 0.12;
          hex.scale = 1 - influence * 0.03; // Légère compression
        } else {
          // Retour progressif à l'état normal
          hex.currentOpacity += (hex.baseOpacity - hex.currentOpacity) * 0.1;
          hex.scale += (1 - hex.scale) * 0.1;
        }

        drawHexagon(hex.x, hex.y, hex.size, hex.currentOpacity, hex.scale);
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [mousePosition]);

  return (
    <div className="relative min-h-screen bg-[#0a0e27] overflow-hidden">
      {/* Fond avec gradient subtil */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#0d1b2a] to-[#0a0e27]"></div>

      {/* Canvas hexagones interactifs - VERSION OPTIMISÉE */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Section Hero */}
      <div className="relative z-20 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          {/* Titre principal */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-5xl sm:text-6xl lg:text-7xl text-white mb-6 tracking-tight"
          >
            One hub.
            <br />
            <span className="text-[#6c63ff]">All competitive needs.</span>
          </motion.h1>

          {/* Sous-titre */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="text-xl sm:text-2xl text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Everything you need to find, organize and play.
          </motion.p>

          {/* Boutons d'action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link to="/search/scrim">
              <Button className="bg-[#6c63ff] text-white hover:bg-[#6c63ff]/80 px-8 py-6 text-lg transition-all duration-300 transform hover:scale-105 border-0">
                Browse LFS
              </Button>
            </Link>
            <Link to="/roadmap">
              <Button
                variant="outline"
                className="border-2 border-[#00d4ff] text-[#6c63ff] hover:bg-[#00d4ff] hover:text-[#0a0e27] px-8 py-6 text-lg transition-all duration-300"
              >
                Roadmap
              </Button>
            </Link>
          </motion.div>

          {/* Statistiques animées */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8"
          >
            {[
              { label: "Messages parsés", value: statsLoading ? "..." : formatStatNumber(stats.totalMessages), color: "#6c63ff" },
              { label: "Serveurs Discord", value: "10+", color: "#00d4ff" },
              { label: "Utilisateurs actifs", value: statsLoading ? "..." : formatStatNumber(stats.activeUsers), color: "#6c63ff" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1 + index * 0.1 }}
                className="p-6 bg-[#0d1b2a]/60 backdrop-blur-sm border border-[#00d4ff]/30 rounded-lg"
              >
                <div
                  className="text-3xl sm:text-4xl mb-2"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </div>
                <div className="text-white/70 text-sm uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Section 2: Find what you need */}
      <section className="relative z-20 bg-[#0d1b2a] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl text-white mb-4">
              Find exactly what you're looking for
            </h2>
            <p className="text-white/70 text-lg">
              Search by need, not by spam.
            </p>
          </motion.div>

          {/* 4 cartes de besoins */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Scrims",
                description: "Find practice matches at your level",
                icon: Target,
                link: "/search/scrim",
              },
              {
                title: "Ringers / Subs",
                description: "Fill missing roles fast",
                icon: Search,
                link: "/search/ringer",
              },
              {
                title: "Players",
                description: "Recruit competitive players",
                icon: Shield,
                link: "/search/player",
              },
              {
                title: "Teams",
                description: "Join or build a team",
                icon: Filter,
                link: "/search/team",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link to={card.link}>
                  <motion.div
                    whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(108, 99, 255, 0.3)" }}
                    className="bg-[#0a0e27] border border-[#00d4ff]/30 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:border-[#00d4ff] h-full"
                  >
                    <motion.div
                      whileHover={{ x: 2, y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="w-14 h-14 bg-[#6c63ff] rounded-xl flex items-center justify-center mb-6"
                    >
                      <card.icon className="w-7 h-7 text-white" />
                    </motion.div>
                    <h3 className="text-2xl text-white mb-3">{card.title}</h3>
                    <p className="text-white/60 leading-relaxed">{card.description}</p>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: How it works */}
      <section className="relative z-20 bg-[#0a0e27] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl text-white text-center mb-16"
          >
            How it works
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Ligne de connexion entre les étapes */}
            <div className="hidden md:block absolute top-20 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-[#6c63ff] via-[#00d4ff] to-[#6c63ff] opacity-30"></div>

            {[
              {
                icon: Search,
                title: "We parse Discord",
                text: "Messages are automatically detected from partnered servers",
                step: "1",
              },
              {
                icon: Filter,
                title: "We structure the data",
                text: "Needs, ranks, roles, regions — everything is organized",
                step: "2",
              },
              {
                icon: Zap,
                title: "You find instantly",
                text: "Filter and jump directly to the original message",
                step: "3",
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="text-center relative"
              >
                <motion.div
                  whileHover={{ rotate: 5, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  className="relative inline-block mb-6"
                >
                  <div className="w-24 h-24 bg-[#0d1b2a] rounded-2xl flex items-center justify-center mx-auto border-2 border-[#00d4ff]/30 relative z-10">
                    <step.icon className="w-12 h-12 text-[#6c63ff]" />
                  </div>
                  <div className="absolute -top-3 -right-3 w-10 h-10 bg-[#6c63ff] text-white rounded-full flex items-center justify-center text-lg font-semibold z-20">
                    {step.step}
                  </div>
                </motion.div>

                <h3 className="text-2xl text-white mb-4">{step.title}</h3>
                <p className="text-white/60 leading-relaxed max-w-xs mx-auto">
                  {step.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Trusted by communities */}
      <section className="hidden relative z-20 bg-[#0d1b2a] p-[32px] sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Carrousel de logos infini */}
          <LogoCarousel />
        </div>
      </section>

      {/* Section 5: Built for competitive Overwatch */}
      <section className="relative z-20 bg-[#0a0e27] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl text-white text-center mb-16"
          >
            Built for competitive Overwatch
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Clock,
                title: "Save time",
                text: "No more scrolling endless Discord channels",
              },
              {
                icon: Search,
                title: "Search by need",
                text: "Scrims, players, teams — instantly",
              },
              {
                icon: Target,
                title: "Rank & role aware",
                text: "Designed for competitive play",
              },
              {
                icon: Zap,
                title: "Direct access",
                text: "Jump straight to the original Discord message",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-[#0d1b2a] rounded-2xl p-8 border border-[#00d4ff]/20 hover:border-[#00d4ff]/50 transition-all duration-300"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.3 }}
                  className="w-14 h-14 bg-[#6c63ff]/20 rounded-xl flex items-center justify-center mb-6"
                >
                  <feature.icon className="w-7 h-7 text-[#6c63ff]" />
                </motion.div>
                <h3 className="text-xl text-white mb-3">{feature.title}</h3>
                <p className="text-white/60 leading-relaxed">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5.5: What's new on the platform */}
      <section className="relative z-20 bg-[#0d1b2a] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl text-white mb-4">
              Platform Updates
            </h2>
            <p className="text-white/60 text-lg">
              Track every improvement we ship to make competitive Overwatch easier.
            </p>
          </motion.div>

          {/* Grille d'updates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {getLatestUpdates().map((update, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-[#0a0e27] border border-[#00d4ff]/20 rounded-xl p-6 transition-all duration-300 hover:border-[#00d4ff]/50 hover:shadow-lg"
              >
                {/* Badge catégorie */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="px-3 py-1 rounded-full text-xs uppercase tracking-wider"
                    style={{
                      backgroundColor: `${update.categoryColor}20`,
                      color: update.categoryColor,
                    }}
                  >
                    {update.category}
                  </span>
                  <span className="text-white/40 text-sm">{update.date}</span>
                </div>

                {/* Contenu */}
                <h3 className="text-xl text-white mb-2">{update.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {update.description}
                </p>
              </motion.div>
            ))}
          </div>

          {/* CTA discret */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-center"
          >
            <Link 
              to="/updates" 
              className="inline-flex items-center gap-2 text-[#00d4ff] hover:text-[#6c63ff] transition-colors duration-300 text-sm"
            >
              View all updates
              <span className="text-lg">→</span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Section 6: Final CTA */}
      <section className="relative z-20 bg-gradient-to-br from-[#6c63ff] to-[#00d4ff] py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-5xl sm:text-6xl text-white mb-6"
          >
            Stop searching. Start playing.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-xl text-white/90 mb-10"
          >
            Find scrims, players and teams in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link to="/search/scrim">
              <motion.div whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
                <Button className="bg-white text-[#6c63ff] hover:bg-white/90 px-12 py-7 text-xl transition-all duration-300 border-0 shadow-2xl">
                  Browse LFS
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Section 7: Footer */}
      <footer className="relative z-20 bg-[#0a0e27] border-t border-[#00d4ff]/20 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 max-w-4xl mx-auto">
            {/* Product */}
            <div>
              <h4 className="text-white mb-4 font-medium">Pages</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/search/scrim" className="text-white/60 hover:text-[#00d4ff] transition-colors text-sm">
                    Search
                  </Link>
                </li>
                <li>
                  <Link to="/updates" className="text-white/60 hover:text-[#00d4ff] transition-colors text-sm">
                    Updates
                  </Link>
                </li>
                <li>
                  <Link to="/roadmap" className="text-white/60 hover:text-[#00d4ff] transition-colors text-sm">
                    Roadmap
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white mb-4 font-medium">Company</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/support" className="text-white/60 hover:text-[#00d4ff] transition-colors text-sm">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="text-white/60 hover:text-[#00d4ff] transition-colors text-sm">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white mb-4 font-medium">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/support" className="text-white/60 hover:text-[#00d4ff] transition-colors text-sm">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="text-white/60 hover:text-[#00d4ff] transition-colors text-sm">
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bas du footer */}
          <div className="pt-8 border-t border-[#00d4ff]/10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-white/40 text-sm">
                © 2026 GoForScrim — Competitive Overwatch Hub
              </div>
              <div className="text-white/40 text-sm">
                Made for the competitive community
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}