export function RadarLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cercles concentriques du radar */}
      <circle cx="50" cy="50" r="45" stroke="#00d4ff" strokeWidth="1.5" opacity="0.2" />
      <circle cx="50" cy="50" r="35" stroke="#00d4ff" strokeWidth="1.5" opacity="0.3" />
      <circle cx="50" cy="50" r="25" stroke="#00d4ff" strokeWidth="1.5" opacity="0.4" />
      <circle cx="50" cy="50" r="15" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5" />
      
      {/* Lignes de grille (croix) */}
      <line x1="50" y1="5" x2="50" y2="95" stroke="#00d4ff" strokeWidth="1" opacity="0.15" />
      <line x1="5" y1="50" x2="95" y2="50" stroke="#00d4ff" strokeWidth="1" opacity="0.15" />
      
      {/* Lignes diagonales */}
      <line x1="15" y1="15" x2="85" y2="85" stroke="#00d4ff" strokeWidth="0.8" opacity="0.1" />
      <line x1="85" y1="15" x2="15" y2="85" stroke="#00d4ff" strokeWidth="0.8" opacity="0.1" />
      
      {/* Balayage radar statique (faisceau) */}
      <defs>
        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6c63ff" stopOpacity="0" />
          <stop offset="50%" stopColor="#6c63ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path
        d="M 50 50 L 50 5 A 45 45 0 0 1 85.36 21.46 Z"
        fill="url(#radarGradient)"
      />
      
      {/* Points de détection (targets) - statiques */}
      <g>
        {/* Point 1 - proche */}
        <circle cx="65" cy="35" r="2.5" fill="#00d4ff" opacity="0.9" />
        <circle cx="65" cy="35" r="5" fill="none" stroke="#00d4ff" strokeWidth="1" opacity="0.4" />
        
        {/* Point 2 - moyen */}
        <circle cx="38" cy="60" r="2" fill="#6c63ff" opacity="0.8" />
        <circle cx="38" cy="60" r="4" fill="none" stroke="#6c63ff" strokeWidth="1" opacity="0.3" />
        
        {/* Point 3 - loin */}
        <circle cx="72" cy="68" r="1.5" fill="#00d4ff" opacity="0.7" />
      </g>
      
      {/* Centre du radar (origine) */}
      <circle cx="50" cy="50" r="3" fill="#6c63ff" opacity="0.9" />
      <circle cx="50" cy="50" r="2" fill="#fff" opacity="1" />
    </svg>
  );
}