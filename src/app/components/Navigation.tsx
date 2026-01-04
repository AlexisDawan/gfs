import { Link, useLocation } from "react-router-dom";
import { Home, Search, HelpCircle, ChevronDown } from "lucide-react";
import { useState, memo, useEffect, useRef } from "react";
import { RadarLogo } from "./Logo";

export function Navigation() {
  const location = useLocation();
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [searchMenuPinned, setSearchMenuPinned] = useState(false); // Menu épinglé par clic
  const closeTimerRef = useRef<NodeJS.Timeout>();
  const menuRef = useRef<HTMLDivElement>(null); // Référence au menu

  // Fermer le menu lors du scroll
  useEffect(() => {
    const handleScroll = () => {
      if (searchMenuOpen) {
        setSearchMenuOpen(false);
        setSearchMenuPinned(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [searchMenuOpen]);

  // Fermer le menu quand on change de page
  useEffect(() => {
    setSearchMenuOpen(false);
    setSearchMenuPinned(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  }, [location.pathname]);

  // Fermer le menu quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setSearchMenuOpen(false);
        setSearchMenuPinned(false);
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
        }
      }
    };

    if (searchMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchMenuOpen]);

  // Cleanup du timer au démontage
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/support", label: "Support", icon: HelpCircle },
  ];

  const searchSubmenu = [
    { path: "/search/scrim", label: "a scrim" },
    { path: "/search/ringer", label: "a ringer" },
    { path: "/search/player", label: "a player" },
    { path: "/search/team", label: "a team" },
  ];

  const isSearchActive = location.pathname.startsWith("/search");

  // Fonction pour démarrer le timer de fermeture
  const startCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setSearchMenuOpen(false);
      setSearchMenuPinned(false);
    }, 1000); // 1 seconde
  };

  // Fonction pour annuler le timer
  const cancelCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  };

  return (
    <nav className="bg-[#0d1b2a] border-b-4 border-[#00d4ff] relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 relative">
          {/* Logo à gauche */}
          <Link to="/" className="flex items-center group z-10 transition-transform hover:scale-110">
            <RadarLogo className="w-14 h-14 md:w-16 md:h-16 transition-transform group-hover:rotate-6" />
          </Link>

          {/* Menu desktop au centre */}
          <div className="hidden md:flex space-x-1 items-center absolute left-1/2 transform -translate-x-1/2">
            {/* Home */}
            <Link
              to="/"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                location.pathname === "/"
                  ? "bg-[#00d4ff] text-[#0a0e27]"
                  : "text-white/80 hover:bg-[#00d4ff] hover:text-[#0a0e27]"
              }`}
            >
              <span>Home</span>
            </Link>

            {/* Menu Search avec dropdown */}
            <div
              ref={menuRef}
              className="relative"
              onMouseEnter={() => {
                cancelCloseTimer(); // Annuler le timer si on revient
                if (!searchMenuPinned) {
                  setSearchMenuOpen(true);
                }
              }}
              onMouseLeave={() => {
                // Démarrer le timer de 1 seconde
                startCloseTimer();
              }}
            >
              <button
                onClick={() => {
                  cancelCloseTimer(); // Annuler le timer
                  if (searchMenuOpen && searchMenuPinned) {
                    // Si déjà ouvert et épinglé, fermer
                    setSearchMenuOpen(false);
                    setSearchMenuPinned(false);
                  } else {
                    // Sinon, ouvrir et épingler
                    setSearchMenuOpen(true);
                    setSearchMenuPinned(true);
                  }
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  isSearchActive
                    ? "bg-[#00d4ff] text-[#0a0e27]"
                    : "text-white/80 hover:bg-[#00d4ff] hover:text-[#0a0e27]"
                }`}
              >
                <span>Looking for</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    searchMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown menu */}
              {searchMenuOpen && (
                <div
                  className="absolute top-full left-0 mt-1 w-56 bg-[#0d1b2a] border-2 border-[#00d4ff]/30 rounded-lg shadow-xl py-2 z-50"
                  onMouseEnter={() => {
                    cancelCloseTimer(); // Annuler le timer
                    setSearchMenuOpen(true);
                  }}
                  onMouseLeave={() => {
                    // Démarrer le timer de 1 seconde
                    startCloseTimer();
                  }}
                >
                  {searchSubmenu.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`block px-4 py-3 transition-all ${
                        location.pathname === item.path
                          ? "bg-[#00d4ff] text-[#0a0e27]"
                          : "text-white/80 hover:bg-[#00d4ff]/80 hover:text-[#0a0e27]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Roadmap */}
            <Link
              to="/roadmap"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                location.pathname === "/roadmap"
                  ? "bg-[#00d4ff] text-[#0a0e27]"
                  : "text-white/80 hover:bg-[#00d4ff] hover:text-[#0a0e27]"
              }`}
            >
              <span>Roadmap</span>
            </Link>

            {/* Support */}
            <Link
              to="/support"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                location.pathname === "/support"
                  ? "bg-[#00d4ff] text-[#0a0e27]"
                  : "text-white/80 hover:bg-[#00d4ff] hover:text-[#0a0e27]"
              }`}
            >
              <span>Support</span>
            </Link>
          </div>

          {/* Mobile menu */}
          <div className="md:hidden flex space-x-2">
            <Link
              to="/"
              className={`p-2 rounded-lg transition-all ${
                location.pathname === "/"
                  ? "bg-[#00d4ff] text-[#0a0e27]"
                  : "text-white/80 hover:bg-[#00d4ff] hover:text-[#0a0e27]"
              }`}
            >
              <span className="text-sm">Home</span>
            </Link>
            <Link
              to="/search/scrim"
              className={`p-2 rounded-lg transition-all ${
                isSearchActive
                  ? "bg-[#00d4ff] text-[#0a0e27]"
                  : "text-white/80 hover:bg-[#00d4ff] hover:text-[#0a0e27]"
              }`}
            >
              <span className="text-sm">Search</span>
            </Link>
            <Link
              to="/support"
              className={`p-2 rounded-lg transition-all ${
                location.pathname === "/support"
                  ? "bg-[#00d4ff] text-[#0a0e27]"
                  : "text-white/80 hover:bg-[#00d4ff] hover:text-[#0a0e27]"
              }`}
            >
              <span className="text-sm">Support</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}